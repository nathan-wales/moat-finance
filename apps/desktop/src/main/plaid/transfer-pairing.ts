/**
 * Desktop SQLite adapter for internal transfer pairing.
 *
 * Matching is shared via `@moat/domain`. This module loads unpaired
 * Transfer / Credit card payment legs from local SQLite, persists pairs,
 * persists pairs, and reconciles broken ones after Plaid sync or CSV import.
 */

import { randomUUID } from "node:crypto";
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	type AccountTypeKind,
	isPairableCategory,
	matchTransferLegs,
	resolveAccountTypeKind,
	TRANSFER_MATCH_WINDOW_DAYS,
	type TransferMatch,
	type TransferMatchLeg,
	transferHideUpdate,
	transferLookbackBounds,
	transferPairStillValid,
} from "@moat/domain";
import { remoteLogger } from "../lib/remote-logger";

const pairingInProgress = new Map<string, Promise<unknown>>();

async function withUserPairingLock<T>(
	userId: string,
	task: () => Promise<T>,
): Promise<T> {
	const previous = pairingInProgress.get(userId) ?? Promise.resolve();
	let release!: () => void;
	const gate = new Promise<void>((resolve) => {
		release = resolve;
	});
	const queued = previous.then(
		() => gate,
		() => gate,
	);
	pairingInProgress.set(userId, queued);
	try {
		await previous.catch(() => undefined);
		return await task();
	} finally {
		release();
		if (pairingInProgress.get(userId) === queued) {
			pairingInProgress.delete(userId);
		}
	}
}

export async function detectAndPairTransfers(params: {
	db: SqliteDbClient;
	userId: string;
	candidateTransactionIds?: string[];
	fullHistory?: boolean;
}): Promise<{ pairsCreated: number; pairsReconciled: number }> {
	return withUserPairingLock(params.userId, () =>
		runDetectAndPairTransfers(params),
	);
}

async function runDetectAndPairTransfers(params: {
	db: SqliteDbClient;
	userId: string;
	candidateTransactionIds?: string[];
	fullHistory?: boolean;
}): Promise<{ pairsCreated: number; pairsReconciled: number }> {
	const { db, userId, candidateTransactionIds, fullHistory = false } = params;
	const startedAt = Date.now();

	const pairsReconciled = await reconcileBrokenTransferPairs(db, userId, {
		candidateTransactionIds,
		fullHistory,
	});

	const legs = await loadTransferCandidateLegs(db, userId, {
		candidateTransactionIds,
		fullHistory,
	});
	const matches = matchTransferLegs(legs, TRANSFER_MATCH_WINDOW_DAYS);
	const pairsCreated = await persistTransferPairs(db, userId, matches);

	if (pairsCreated > 0 || pairsReconciled > 0) {
		remoteLogger.info("Desktop transfer pairing completed", {
			event: "desktop.transfer_pairing.completed",
			feature: "transfer-pairing",
			operation: "detectAndPairTransfers",
			metadata: {
				pairsCreated,
				pairsReconciled,
				candidateCount: candidateTransactionIds?.length ?? 0,
				fullHistory,
				durationMs: Date.now() - startedAt,
			},
		});
	}

	return { pairsCreated, pairsReconciled };
}

type AccountTypeFields = {
	type: string | null;
	subtype: string | null;
	currency?: string | null;
};

type CandidateRow = {
	id: string;
	type: string;
	amount: number;
	accountId: string | null;
	plaidAccountId: string | null;
	date: Date | string | number;
	postedDate: Date | string | number | null;
	hidden: boolean | number;
	autoHiddenAsTransfer: boolean | number;
	category: { name: string } | null;
	account: AccountTypeFields | null;
	plaidAccount: AccountTypeFields | null;
};

const CANDIDATE_SELECT = {
	id: true,
	type: true,
	amount: true,
	accountId: true,
	plaidAccountId: true,
	date: true,
	postedDate: true,
	hidden: true,
	autoHiddenAsTransfer: true,
	category: { select: { name: true } },
	account: { select: { type: true, subtype: true, currency: true } },
	plaidAccount: { select: { type: true, subtype: true, currency: true } },
} as const;

function toTimeMs(value: Date | string | number): number {
	if (value instanceof Date) return value.getTime();
	return new Date(value).getTime();
}

function toMatchLeg(row: CandidateRow): TransferMatchLeg {
	const currency = (
		row.plaidAccount?.currency ??
		row.account?.currency ??
		"USD"
	).toUpperCase();
	return {
		id: row.id,
		type: row.type === "INCOME" ? "INCOME" : "EXPENSE",
		amountKey: Number(row.amount).toFixed(2),
		currency,
		accountKey: row.plaidAccountId ?? row.accountId ?? null,
		timeMs: toTimeMs(row.postedDate ?? row.date),
		hidden: Boolean(row.hidden),
		autoHiddenAsTransfer: Boolean(row.autoHiddenAsTransfer),
		categoryName: (row.category?.name ?? "").trim(),
		accountTypeKind: resolveRowAccountTypeKind(row),
	};
}

function resolveRowAccountTypeKind(row: CandidateRow): AccountTypeKind {
	const fromPlaid = row.plaidAccount;
	if (fromPlaid?.type || fromPlaid?.subtype) {
		return resolveAccountTypeKind(fromPlaid.type, fromPlaid.subtype);
	}
	const fromAccount = row.account;
	if (fromAccount?.type || fromAccount?.subtype) {
		return resolveAccountTypeKind(fromAccount.type, fromAccount.subtype);
	}
	return "unknown";
}

async function loadPairableCategoryIds(
	db: SqliteDbClient,
	userId: string,
): Promise<string[]> {
	const categories = (await db.category.findMany({
		where: { OR: [{ userId: null }, { userId }] },
		select: { id: true, name: true },
	})) as Array<{ id: string; name: string }>;
	return categories
		.filter((category) => isPairableCategory(category.name))
		.map((category) => category.id);
}

function buildCandidateWhere(
	userId: string,
	pairableCategoryIds: string[],
	dateFilter?: { gte: Date; lte: Date },
): Record<string, unknown> {
	return {
		userId,
		removedAt: null,
		transferPairId: null,
		pending: false,
		categoryId: { in: pairableCategoryIds },
		...(dateFilter ? { date: dateFilter } : {}),
	};
}

async function loadTransferCandidateLegs(
	db: SqliteDbClient,
	userId: string,
	options: { candidateTransactionIds?: string[]; fullHistory: boolean },
): Promise<TransferMatchLeg[]> {
	const pairableCategoryIds = await loadPairableCategoryIds(db, userId);
	if (pairableCategoryIds.length === 0) return [];

	let dateFilter: { gte: Date; lte: Date } | undefined;

	if (!options.fullHistory) {
		const candidateTransactionIds = options.candidateTransactionIds ?? [];
		if (candidateTransactionIds.length === 0) return [];

		const candidateRows = (await db.transaction.findMany({
			where: { userId, id: { in: candidateTransactionIds } },
			select: { date: true, postedDate: true },
		})) as Array<{
			date: Date | string | number;
			postedDate: Date | string | number | null;
		}>;
		if (candidateRows.length === 0) return [];

		const bounds = transferLookbackBounds(
			candidateRows.map((row) => toTimeMs(row.postedDate ?? row.date)),
		);
		if (!bounds) return [];
		dateFilter = bounds;
	}

	const rows = (await db.transaction.findMany({
		where: buildCandidateWhere(userId, pairableCategoryIds, dateFilter),
		select: CANDIDATE_SELECT,
	})) as CandidateRow[];

	return rows.map(toMatchLeg);
}

async function persistTransferPairs(
	db: SqliteDbClient,
	userId: string,
	matches: TransferMatch[],
): Promise<number> {
	if (matches.length === 0) return 0;

	await db.$transaction(async (tx) => {
		for (const match of matches) {
			const pairId = randomUUID();
			await applyPairLeg(tx, userId, match.expense, pairId);
			await applyPairLeg(tx, userId, match.income, pairId);
		}
	});

	return matches.length;
}

async function applyPairLeg(
	tx: SqliteDbClient,
	userId: string,
	leg: TransferMatchLeg,
	pairId: string,
): Promise<void> {
	await tx.transaction.updateMany({
		where: { id: leg.id, userId },
		data: {
			transferPairId: pairId,
			...(transferHideUpdate(leg) ?? {}),
		},
	});
}

type PairValidationRow = CandidateRow & {
	transferPairId: string | null;
	removedAt: Date | string | number | null;
};

async function collectBrokenPairIds(
	db: SqliteDbClient,
	userId: string,
	options: { candidateTransactionIds?: string[]; fullHistory: boolean },
): Promise<Set<string>> {
	const pairIdsToCheck = new Set<string>();

	const removedPaired = (await db.transaction.findMany({
		where: {
			userId,
			transferPairId: { not: null },
			removedAt: { not: null },
		},
		select: { transferPairId: true },
	})) as Array<{ transferPairId: string | null }>;
	for (const row of removedPaired) {
		if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
	}

	if (options.fullHistory) {
		const allPaired = (await db.transaction.findMany({
			where: { userId, transferPairId: { not: null } },
			select: { transferPairId: true },
		})) as Array<{ transferPairId: string | null }>;
		for (const row of allPaired) {
			if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
		}
	} else {
		const candidateTransactionIds = options.candidateTransactionIds ?? [];
		if (candidateTransactionIds.length > 0) {
			const candidatePaired = (await db.transaction.findMany({
				where: {
					userId,
					id: { in: candidateTransactionIds },
					transferPairId: { not: null },
				},
				select: { transferPairId: true },
			})) as Array<{ transferPairId: string | null }>;
			for (const row of candidatePaired) {
				if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
			}
		}
	}

	if (pairIdsToCheck.size === 0) return new Set();

	const legs = (await db.transaction.findMany({
		where: { userId, transferPairId: { in: [...pairIdsToCheck] } },
		select: { ...CANDIDATE_SELECT, transferPairId: true, removedAt: true },
	})) as PairValidationRow[];

	const byPair = new Map<string, PairValidationRow[]>();
	for (const leg of legs) {
		if (!leg.transferPairId) continue;
		const bucket = byPair.get(leg.transferPairId);
		if (bucket) {
			bucket.push(leg);
		} else {
			byPair.set(leg.transferPairId, [leg]);
		}
	}

	const broken = new Set<string>();
	for (const [pairId, group] of byPair) {
		const mapped = group.map((row) => ({
			...toMatchLeg(row),
			removedAt: row.removedAt ? new Date(row.removedAt) : null,
		}));
		if (!transferPairStillValid(mapped)) broken.add(pairId);
	}
	return broken;
}

async function reconcileBrokenTransferPairs(
	db: SqliteDbClient,
	userId: string,
	options: { candidateTransactionIds?: string[]; fullHistory: boolean },
): Promise<number> {
	const brokenPairIds = await collectBrokenPairIds(db, userId, options);
	if (brokenPairIds.size === 0) return 0;

	const legs = (await db.transaction.findMany({
		where: { userId, transferPairId: { in: [...brokenPairIds] } },
		select: { id: true, autoHiddenAsTransfer: true },
	})) as Array<{ id: string; autoHiddenAsTransfer: boolean | number }>;

	const autoHiddenIds = legs
		.filter((leg) => Boolean(leg.autoHiddenAsTransfer))
		.map((leg) => leg.id);
	const userManagedIds = legs
		.filter((leg) => !leg.autoHiddenAsTransfer)
		.map((leg) => leg.id);

	await db.$transaction(async (tx) => {
		if (autoHiddenIds.length > 0) {
			await tx.transaction.updateMany({
				where: { id: { in: autoHiddenIds }, userId },
				data: {
					transferPairId: null,
					hidden: false,
					autoHiddenAsTransfer: false,
				},
			});
		}
		if (userManagedIds.length > 0) {
			await tx.transaction.updateMany({
				where: { id: { in: userManagedIds }, userId },
				data: { transferPairId: null },
			});
		}
	});

	return brokenPairIds.size;
}
