import {
	composeNetWorthComponents,
	ensureCurrentMonthPoint,
	type NetWorthProfileAccount,
	type NetWorthProfileAsset,
	rollupLastPerMonth,
} from "@moat/domain";
import { startOfDay } from "date-fns";
import type {
	BalanceSnapshotSource,
	PrismaClient,
} from "../../../generated/prisma";

function parseProfileAssets(value: unknown): NetWorthProfileAsset[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((asset) => {
		if (
			typeof asset !== "object" ||
			asset === null ||
			!("id" in asset) ||
			!("type" in asset) ||
			!("estimatedValue" in asset) ||
			!("includeInNetWorth" in asset) ||
			typeof asset.id !== "string" ||
			typeof asset.type !== "string" ||
			typeof asset.estimatedValue !== "number" ||
			typeof asset.includeInNetWorth !== "boolean"
		) {
			return [];
		}
		return [asset as NetWorthProfileAsset];
	});
}

function parseProfileAccounts(value: unknown): NetWorthProfileAccount[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((account) => {
		if (
			typeof account !== "object" ||
			account === null ||
			!("id" in account) ||
			!("includedInNetWorth" in account) ||
			typeof account.id !== "string" ||
			typeof account.includedInNetWorth !== "boolean"
		) {
			return [];
		}
		return [account as NetWorthProfileAccount];
	});
}

/**
 * Takes a full balance snapshot for the user across all sources:
 * active Plaid accounts, manual investments, and real estate.
 *
 * All sources are captured with the same date so each snapshot day
 * represents a complete picture of the user's net worth. Upserts by
 * (userId, date, source, sourceId) so multiple syncs in a day are
 * idempotent — only the latest balance is kept. Today's rows for
 * sources that no longer exist (or are excluded from net worth) are
 * deleted so disconnect/delete shrinks the current total.
 *
 * Credit and loan Plaid accounts are stored as negative balances so
 * a simple SUM over any date gives the correct net worth.
 */
export async function takeSnapshot(
	userId: string,
	db: PrismaClient,
): Promise<void> {
	const today = startOfDay(new Date());

	const [plaidAccounts, investments, realEstate, financialProfileData] =
		await Promise.all([
			db.plaidAccount.findMany({
				where: { userId, isActive: true, syncEnabled: true },
				select: { id: true, type: true, subtype: true, currentBalance: true },
			}),
			db.investment.findMany({
				where: { userId },
				select: { id: true, startingBalance: true },
			}),
			db.realEstateInvestment.findMany({
				where: { userId },
				select: {
					id: true,
					currentEstimatedValue: true,
					currentLoanBalance: true,
				},
			}),
			db.financialProfileData.findUnique({
				where: { userId },
				select: { accounts: true, assets: true },
			}),
		]);

	const snapshots = composeNetWorthComponents({
		plaidAccounts,
		profileAccounts: parseProfileAccounts(financialProfileData?.accounts),
		investments,
		realEstate,
		profileAssets: parseProfileAssets(financialProfileData?.assets),
	});

	// Drop today's rows for sources that are gone or no longer included.
	// Upserts alone cannot shrink net worth after disconnect/delete.
	const keepKeys = new Set(
		snapshots.map((snapshot) => `${snapshot.source}:${snapshot.sourceId}`),
	);
	const existingToday = await db.balanceSnapshot.findMany({
		where: { userId, date: today },
		select: { id: true, source: true, sourceId: true },
	});
	const orphanIds = existingToday
		.filter((row) => !keepKeys.has(`${row.source}:${row.sourceId}`))
		.map((row) => row.id);
	if (orphanIds.length > 0) {
		await db.balanceSnapshot.deleteMany({
			where: { id: { in: orphanIds } },
		});
	}

	await Promise.all(
		snapshots.map((s) =>
			db.balanceSnapshot.upsert({
				where: {
					userId_date_source_sourceId: {
						userId,
						date: today,
						source: s.source,
						sourceId: s.sourceId,
					},
				},
				create: { userId, date: today, ...s },
				update: { balance: s.balance },
			}),
		),
	);
}

export async function sumSnapshotsOnOrBefore(
	db: PrismaClient,
	userId: string,
	asOfDate?: Date,
): Promise<number> {
	const latestSnapshot = await db.balanceSnapshot.findFirst({
		where: {
			userId,
			...(asOfDate ? { date: { lte: asOfDate } } : {}),
		},
		orderBy: { date: "desc" },
		select: { date: true },
	});
	if (!latestSnapshot) return 0;

	const daySnapshots = await db.balanceSnapshot.findMany({
		where: { userId, date: latestSnapshot.date },
		select: { balance: true },
	});
	return daySnapshots.reduce((sum, row) => sum + row.balance, 0);
}

export type AssetHistoryResult = {
	current: number;
	points: Array<{ month: string; total: number }>;
};

async function loadCurrentAssetValue(
	db: PrismaClient,
	userId: string,
	source: BalanceSnapshotSource,
	sourceId: string,
): Promise<number | null> {
	if (source === "PLAID") {
		const account = await db.plaidAccount.findFirst({
			where: { id: sourceId, userId, isActive: true, syncEnabled: true },
			select: { currentBalance: true },
		});
		if (!account) return null;
		return account.currentBalance ?? 0;
	}

	if (source === "INVESTMENT") {
		const investment = await db.investment.findFirst({
			where: { id: sourceId, userId },
			select: { startingBalance: true },
		});
		return investment?.startingBalance ?? null;
	}

	const property = await db.realEstateInvestment.findFirst({
		where: { id: sourceId, userId },
		select: {
			currentEstimatedValue: true,
			currentLoanBalance: true,
		},
	});
	if (!property) return null;
	return property.currentEstimatedValue - property.currentLoanBalance;
}

export async function getAssetHistory(
	db: PrismaClient,
	input: {
		userId: string;
		source: BalanceSnapshotSource;
		sourceId: string;
		months?: number;
		now?: Date;
	},
): Promise<AssetHistoryResult | null> {
	const months = input.months ?? 24;
	const now = input.now ?? new Date();
	const current = await loadCurrentAssetValue(
		db,
		input.userId,
		input.source,
		input.sourceId,
	);
	if (current === null) return null;

	const startDate = new Date(now);
	startDate.setMonth(startDate.getMonth() - months);
	startDate.setHours(0, 0, 0, 0);

	const snapshots = await db.balanceSnapshot.findMany({
		where: {
			userId: input.userId,
			source: input.source,
			sourceId: input.sourceId,
			date: { gte: startDate },
		},
		orderBy: { date: "asc" },
		select: { date: true, balance: true },
	});

	const rolled = rollupLastPerMonth(
		snapshots.map((snapshot) => ({
			date: snapshot.date.toISOString().slice(0, 10),
			value: snapshot.balance,
		})),
	);

	return {
		current,
		points: ensureCurrentMonthPoint(rolled, current, now),
	};
}
