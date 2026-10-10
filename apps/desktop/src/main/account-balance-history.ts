/**
 * Records per-account balance history rows in desktop SQLite.
 * Main-process only.
 */
import { randomUUID } from "node:crypto";
import type { SqliteDbClient } from "@moat/db-sqlite";

function startOfDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

type HistoryAccountRow = {
	id: string;
	currentBalance: number | null;
	availableBalance: number | null;
};

async function upsertHistoryRow(
	db: SqliteDbClient,
	row: {
		userId: string;
		date: Date;
		source: "PLAID" | "APPLE_FINANCEKIT" | "INVESTMENT";
		sourceId: string;
		balance: number;
	},
): Promise<void> {
	const date = startOfDay(row.date);
	await db.accountBalanceHistory.upsert({
		where: {
			userId_date_source_sourceId: {
				userId: row.userId,
				date,
				source: row.source,
				sourceId: row.sourceId,
			},
		},
		create: {
			id: randomUUID(),
			userId: row.userId,
			date,
			source: row.source,
			sourceId: row.sourceId,
			balance: row.balance,
		},
		update: { balance: row.balance },
	});
}

export async function recordDesktopSyncedAccountHistory(input: {
	db: SqliteDbClient;
	userId: string;
	now?: Date;
}): Promise<void> {
	const now = input.now ?? new Date();
	const today = startOfDay(now);

	const plaidAccounts = (await input.db.plaidAccount.findMany({
		where: {
			item: { userId: input.userId },
			isActive: true,
			isHidden: false,
			syncEnabled: true,
		},
		select: { id: true, currentBalance: true, availableBalance: true },
	})) as HistoryAccountRow[];

	await Promise.all(
		plaidAccounts.map((account) =>
			upsertHistoryRow(input.db, {
				userId: input.userId,
				date: today,
				source: "PLAID",
				sourceId: account.id,
				balance: account.currentBalance ?? account.availableBalance ?? 0,
			}),
		),
	);
}

export async function recordDesktopInvestmentHistory(input: {
	db: SqliteDbClient;
	userId: string;
	investmentId: string;
	balance: number;
	date: Date;
}): Promise<void> {
	await upsertHistoryRow(input.db, {
		userId: input.userId,
		date: input.date,
		source: "INVESTMENT",
		sourceId: input.investmentId,
		balance: input.balance,
	});
}
