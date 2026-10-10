/**
 * Internal transfer pairing (Postgres adapter).
 *
 * Detects opposite-direction legs of equal amount and soft-hides them.
 * Matching lives in `@moat/domain`; this module loads candidates, persists
 * pairs, and reconciles broken ones.
 *
 * Correctness guarantees:
 *   - Only rows with a resolvable account are considered. Same-account pairs
 *     are allowed (CSV imports often assign both legs to one account).
 *   - Hides performed here set autoHiddenAsTransfer=true. User-initiated hides
 *     are never overwritten, and reconciliation only un-hides our own auto-hides.
 *   - Delayed legs are handled: matching runs on every sync over a lookback
 *     window, so a Transfer/CC leg that arrives on a later day pairs with the
 *     earlier one within 5 days.
 */

import { randomUUID } from "node:crypto";
import {
	type AccountTypeKind,
	matchTransferLegs,
	PAIRABLE_CATEGORY_NAMES,
	resolveAccountTypeKind,
	TRANSFER_MATCH_WINDOW_DAYS,
	type TransferMatch,
	type TransferMatchLeg,
	transferHideUpdate,
	transferLookbackBounds,
	transferPairStillValid,
} from "@moat/domain";
import type { Prisma } from "../../../generated/prisma";
import { logger } from "../../lib/logger";
import { db } from "../db";

/**
 * Restrict pairing to Transfer / Credit card payment classified rows to avoid
 * pairing unrelated equal-amount charges. Flip to false to match purely on
 * amount + account + direction + time.
 */
const REQUIRE_PAIRABLE_CLASSIFICATION = true;

type PairingCandidateOptions = {
	candidateExternalIds?: string[];
	candidateTransactionIds?: string[];
	fullHistory: boolean;
};

/**
 * Detects and hides internal transfer pairs for a user. Also reconciles
 * previously paired legs whose partner has since been removed or changed.
 */
export async function detectAndPairTransfers(params: {
	userId: string;
	candidateExternalIds?: string[];
	candidateTransactionIds?: string[];
	fullHistory?: boolean;
}): Promise<{ pairsCreated: number; pairsReconciled: number }> {
	const {
		userId,
		candidateExternalIds,
		candidateTransactionIds,
		fullHistory = false,
	} = params;
	const startedAt = Date.now();
	const candidateOptions: PairingCandidateOptions = {
		candidateExternalIds,
		candidateTransactionIds,
		fullHistory,
	};

	const pairsReconciled = await reconcileBrokenTransferPairs(
		userId,
		candidateOptions,
	);

	const legs = await loadTransferCandidateLegs(userId, candidateOptions);
	const matches = matchTransferLegs(legs, TRANSFER_MATCH_WINDOW_DAYS);
	const pairsCreated = await persistTransferPairs(userId, matches);

	if (pairsCreated > 0 || pairsReconciled > 0) {
		logger.info("Transfer pairing completed", {
			feature: "transfer-pairing",
			operation: "detectAndPairTransfers",
			userId,
			pairsCreated,
			pairsReconciled,
			candidateCount:
				(candidateExternalIds?.length ?? 0) +
				(candidateTransactionIds?.length ?? 0),
			fullHistory,
			durationMs: Date.now() - startedAt,
		});
	}

	return { pairsCreated, pairsReconciled };
}

type AccountTypeFields = {
	type: string | null;
	subtype: string | null;
};

type CandidateRow = {
	id: string;
	type: "INCOME" | "EXPENSE";
	amount: Prisma.Decimal;
	isoCurrencyCode: string | null;
	financialAccountId: string | null;
	plaidAccountId: string | null;
	date: Date;
	postedDate: Date | null;
	hidden: boolean;
	autoHiddenAsTransfer: boolean;
	category: string | null;
	categoryRef: { name: string } | null;
	financialAccount: AccountTypeFields | null;
	plaidAccount: AccountTypeFields | null;
};

function resolveCategoryName(row: CandidateRow): string {
	return (row.categoryRef?.name ?? row.category ?? "").trim();
}

function resolveRowAccountTypeKind(row: CandidateRow): AccountTypeKind {
	const fromFinancial = row.financialAccount;
	if (fromFinancial?.type || fromFinancial?.subtype) {
		return resolveAccountTypeKind(fromFinancial.type, fromFinancial.subtype);
	}
	const fromPlaid = row.plaidAccount;
	if (fromPlaid?.type || fromPlaid?.subtype) {
		return resolveAccountTypeKind(fromPlaid.type, fromPlaid.subtype);
	}
	return "unknown";
}

function toMatchLeg(row: CandidateRow): TransferMatchLeg {
	return {
		id: row.id,
		type: row.type,
		amountKey: row.amount.toFixed(2),
		currency: (row.isoCurrencyCode ?? "USD").toUpperCase(),
		accountKey: row.financialAccountId ?? row.plaidAccountId ?? null,
		timeMs: (row.postedDate ?? row.date).getTime(),
		hidden: row.hidden,
		autoHiddenAsTransfer: row.autoHiddenAsTransfer,
		categoryName: resolveCategoryName(row),
		accountTypeKind: resolveRowAccountTypeKind(row),
	};
}

const CANDIDATE_SELECT = {
	id: true,
	type: true,
	amount: true,
	isoCurrencyCode: true,
	financialAccountId: true,
	plaidAccountId: true,
	date: true,
	postedDate: true,
	hidden: true,
	autoHiddenAsTransfer: true,
	category: true,
	categoryRef: { select: { name: true } },
	financialAccount: { select: { type: true, subtype: true } },
	plaidAccount: { select: { type: true, subtype: true } },
} as const;

function pairableCategoryWhere(): Prisma.TransactionWhereInput[] {
	return PAIRABLE_CATEGORY_NAMES.flatMap((name) => [
		{
			category: {
				equals: name,
				mode: "insensitive" as const,
			},
		},
		{
			categoryRef: {
				is: {
					name: {
						equals: name,
						mode: "insensitive" as const,
					},
				},
			},
		},
	]);
}

function buildCandidateWhere(
	userId: string,
	dateFilter?: Prisma.DateTimeFilter,
): Prisma.TransactionWhereInput {
	return {
		userId,
		removedAt: null,
		transferPairId: null,
		splitGroupId: null,
		splitParentId: null,
		// Only pair posted rows: pending legs can flip sign or be replaced by a
		// new posted row (different id), which would cause churn and mispairs.
		pending: false,
		...(dateFilter ? { date: dateFilter } : {}),
		...(REQUIRE_PAIRABLE_CLASSIFICATION ? { OR: pairableCategoryWhere() } : {}),
	};
}

async function loadCandidateDateRows(
	userId: string,
	options: PairingCandidateOptions,
): Promise<Array<{ date: Date; postedDate: Date | null }>> {
	const candidateExternalIds = options.candidateExternalIds ?? [];
	const candidateTransactionIds = options.candidateTransactionIds ?? [];
	if (
		candidateExternalIds.length === 0 &&
		candidateTransactionIds.length === 0
	) {
		return [];
	}

	const orFilters: Prisma.TransactionWhereInput[] = [];
	if (candidateExternalIds.length > 0) {
		orFilters.push({ externalTransactionId: { in: candidateExternalIds } });
	}
	if (candidateTransactionIds.length > 0) {
		orFilters.push({ id: { in: candidateTransactionIds } });
	}

	return db.transaction.findMany({
		where: { userId, OR: orFilters },
		select: { date: true, postedDate: true },
	});
}

async function loadTransferCandidateLegs(
	userId: string,
	options: PairingCandidateOptions,
): Promise<TransferMatchLeg[]> {
	let dateFilter: Prisma.DateTimeFilter | undefined;

	if (!options.fullHistory) {
		const candidateRows = await loadCandidateDateRows(userId, options);
		if (candidateRows.length === 0) return [];

		const bounds = transferLookbackBounds(
			candidateRows.map((row) => (row.postedDate ?? row.date).getTime()),
		);
		if (!bounds) return [];
		dateFilter = bounds;
	}

	const rows = await db.transaction.findMany({
		where: buildCandidateWhere(userId, dateFilter),
		select: CANDIDATE_SELECT,
	});

	return rows.map(toMatchLeg);
}

async function persistTransferPairs(
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
	tx: Prisma.TransactionClient,
	userId: string,
	leg: TransferMatchLeg,
	pairId: string,
): Promise<void> {
	const data: Prisma.TransactionUpdateManyMutationInput = {
		transferPairId: pairId,
		...(transferHideUpdate(leg) ?? {}),
	};
	await tx.transaction.updateMany({ where: { id: leg.id, userId }, data });
}

type PairValidationRow = CandidateRow & {
	transferPairId: string | null;
	removedAt: Date | null;
};

async function collectBrokenPairIds(
	userId: string,
	options: PairingCandidateOptions,
): Promise<Set<string>> {
	const pairIdsToCheck = new Set<string>();

	const removedPaired = await db.transaction.findMany({
		where: {
			userId,
			transferPairId: { not: null },
			removedAt: { not: null },
		},
		select: { transferPairId: true },
	});
	for (const row of removedPaired) {
		if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
	}

	if (options.fullHistory) {
		const allPaired = await db.transaction.findMany({
			where: { userId, transferPairId: { not: null } },
			select: { transferPairId: true },
		});
		for (const row of allPaired) {
			if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
		}
	} else {
		const candidateExternalIds = options.candidateExternalIds ?? [];
		const candidateTransactionIds = options.candidateTransactionIds ?? [];
		const orFilters: Prisma.TransactionWhereInput[] = [];
		if (candidateExternalIds.length > 0) {
			orFilters.push({ externalTransactionId: { in: candidateExternalIds } });
		}
		if (candidateTransactionIds.length > 0) {
			orFilters.push({ id: { in: candidateTransactionIds } });
		}
		if (orFilters.length > 0) {
			const candidatePaired = await db.transaction.findMany({
				where: {
					userId,
					transferPairId: { not: null },
					OR: orFilters,
				},
				select: { transferPairId: true },
			});
			for (const row of candidatePaired) {
				if (row.transferPairId) pairIdsToCheck.add(row.transferPairId);
			}
		}
	}

	if (pairIdsToCheck.size === 0) return new Set();

	const legs = await db.transaction.findMany({
		where: { userId, transferPairId: { in: [...pairIdsToCheck] } },
		select: { ...CANDIDATE_SELECT, transferPairId: true, removedAt: true },
	});

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
		if (
			!transferPairStillValid(
				group.map((row) => ({ ...toMatchLeg(row), removedAt: row.removedAt })),
			)
		) {
			broken.add(pairId);
		}
	}
	return broken;
}

async function reconcileBrokenTransferPairs(
	userId: string,
	options: PairingCandidateOptions,
): Promise<number> {
	const brokenPairIds = await collectBrokenPairIds(userId, options);
	if (brokenPairIds.size === 0) return 0;

	const legs = await db.transaction.findMany({
		where: { userId, transferPairId: { in: [...brokenPairIds] } },
		select: { id: true, autoHiddenAsTransfer: true },
	});

	const autoHiddenIds = legs
		.filter((leg) => leg.autoHiddenAsTransfer)
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
