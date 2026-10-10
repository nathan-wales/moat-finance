import { startOfDay } from "date-fns";
import { logger } from "~/lib/logger";
import type { Prisma, PrismaClient } from "../../../generated/prisma";

type DbClient = PrismaClient | Prisma.TransactionClient;

async function upsertHistoryRow(
	db: DbClient,
	row: {
		userId: string;
		date: Date;
		source: "PLAID" | "APPLE_FINANCEKIT" | "INVESTMENT";
		sourceId: string;
		balance: number;
	},
): Promise<void> {
	await db.accountBalanceHistory.upsert({
		where: {
			userId_date_source_sourceId: {
				userId: row.userId,
				date: row.date,
				source: row.source,
				sourceId: row.sourceId,
			},
		},
		create: row,
		update: { balance: row.balance },
	});
}

/**
 * Records today's display balance for every active Plaid and Apple Wallet account.
 */
export async function recordSyncedAccountHistory(
	userId: string,
	db: PrismaClient,
	now: Date = new Date(),
): Promise<{ recorded: number }> {
	const today = startOfDay(now);

	const [plaidAccounts, appleAccounts] = await Promise.all([
		db.plaidAccount.findMany({
			where: {
				userId,
				isActive: true,
				accountHidden: false,
				syncEnabled: true,
			},
			select: { id: true, currentBalance: true, availableBalance: true },
		}),
		db.appleFinanceKitAccount.findMany({
			where: { userId, isActive: true, status: "ACTIVE", accountHidden: false },
			select: { id: true, currentBalance: true, availableBalance: true },
		}),
	]);

	const rows = [
		...plaidAccounts.map((account) => ({
			userId,
			date: today,
			source: "PLAID" as const,
			sourceId: account.id,
			balance: account.currentBalance ?? account.availableBalance ?? 0,
		})),
		...appleAccounts.map((account) => ({
			userId,
			date: today,
			source: "APPLE_FINANCEKIT" as const,
			sourceId: account.id,
			balance: account.currentBalance ?? account.availableBalance ?? 0,
		})),
	];

	await Promise.all(rows.map((row) => upsertHistoryRow(db, row)));
	return { recorded: rows.length };
}

/**
 * Records a single investment balance point (monthly accrual).
 */
export async function recordInvestmentHistory(
	userId: string,
	investmentId: string,
	balance: number,
	date: Date,
	db: PrismaClient,
): Promise<void> {
	await upsertHistoryRow(db, {
		userId,
		date: startOfDay(date),
		source: "INVESTMENT",
		sourceId: investmentId,
		balance,
	});
}

/**
 * Nightly sweep: users with synced accounts but no history row for today.
 * Covers connections skipped by scheduled balance sync as non-stale.
 */
export async function sweepSyncedAccountHistoryForToday(
	db: PrismaClient,
	now: Date = new Date(),
): Promise<{ users: number; recorded: number }> {
	const today = startOfDay(now);

	const [plaidUserIds, appleUserIds] = await Promise.all([
		db.plaidAccount.findMany({
			where: { isActive: true, accountHidden: false, syncEnabled: true },
			select: { userId: true },
			distinct: ["userId"],
		}),
		db.appleFinanceKitAccount.findMany({
			where: { isActive: true, status: "ACTIVE", accountHidden: false },
			select: { userId: true },
			distinct: ["userId"],
		}),
	]);

	const userIds = [
		...new Set([
			...plaidUserIds.map((row) => row.userId),
			...appleUserIds.map((row) => row.userId),
		]),
	];

	let recorded = 0;
	let users = 0;

	for (const userId of userIds) {
		const existing = await db.accountBalanceHistory.findFirst({
			where: {
				userId,
				date: today,
				source: { in: ["PLAID", "APPLE_FINANCEKIT"] },
			},
			select: { id: true },
		});
		if (existing) continue;

		try {
			const result = await recordSyncedAccountHistory(userId, db, now);
			recorded += result.recorded;
			users += 1;
		} catch (error) {
			logger.logError("Synced account history sweep failed", error, {
				feature: "account-balance-history",
				operation: "sweep",
				userId,
			});
		}
	}

	return { users, recorded };
}
