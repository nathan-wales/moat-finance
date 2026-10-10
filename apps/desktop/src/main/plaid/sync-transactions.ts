/**
 * Main Plaid transaction sync engine for the desktop app.
 * Adapted from apps/api/src/server/plaid/syncTransactions.ts.
 *
 * Key differences from the API version:
 *   - In-process Map mutex instead of Postgres advisory lock
 *   - Uses SQLite Prisma client directly
 *   - Upsert uses userId_externalTransactionId compound key (auto-named)
 *   - No split transactions, no investment contribution refresh
 *   - Rules engine and transfer pairing applied after sync
 *
 * Main-process only — never import from the renderer.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	buildTransactionSyncAudit,
	shouldSkipDisabledAccountTransaction,
	shouldSkipHistoricalAddedTransaction,
	type TransactionSyncAudit,
	toUtcDateKey,
} from "@moat/domain";
import { remoteLogger } from "../lib/remote-logger";
import { livePlaidAccessToken } from "./access-state";
import { applyRulesAfterDesktopPlaidSync } from "./apply-synced-transaction-rules";
import { getPlaidClient } from "./client";
import {
	getPlaidErrorDetails,
	isPlaidMutationDuringPagination,
	isPlaidReconnectRequired,
} from "./errors";
import {
	type ExistingTransactionLike,
	mapPlaidTransactionToDbInput,
	parsePlaidDate,
} from "./mapping";
import { syncAccountsForItem } from "./sync-accounts";
import {
	chunkArray,
	DESKTOP_SYNC_WRITE_CHUNK_SIZE,
	externalIdsNeedingPrefetch,
	removedTransactionIds,
} from "./sync-transaction-write-helpers";
import {
	advanceDesktopTransactionSyncWatermarks,
	loadDesktopHistoricalOverlapWindows,
	loadDesktopTransactionSyncWatermarks,
	seedDesktopTransactionSyncWatermarks,
} from "./transaction-sync-watermarks";
import { detectAndPairTransfers } from "./transfer-pairing";

type PersistedExistingTransaction = ExistingTransactionLike & {
	id?: string;
	externalTransactionId?: string | null;
};

type TransactionUpsertEntry = {
	tx: Awaited<
		ReturnType<ReturnType<typeof getPlaidClient>["transactionsSync"]>
	>["data"]["added"][number];
	kind: "added" | "modified";
};

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SyncTransactionsResult {
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	nextCursor: string | null;
	skippedHistoricalCount: number;
	skippedDisabledAccountCount: number;
	reconnectOverlapSkipped: number;
	audit: TransactionSyncAudit;
}

// ─── In-process sync mutex ─────────────────────────────────────────────────────

// Prevents overlapping syncs on the same item (replaces Postgres advisory lock).
// Concurrent callers await the in-flight sync instead of silently no-oping.
// Single-threaded Electron main process makes this safe.
const syncInProgress = new Map<string, Promise<SyncTransactionsResult>>();

// ─── Account map loader ───────────────────────────────────────────────────────

async function loadAccountMapFromDatabase(
	plaidItemDbId: string,
	db: SqliteDbClient,
): Promise<Map<string, { id: string; name: string }>> {
	const accounts = (await db.plaidAccount.findMany({
		where: { plaidItemId: plaidItemDbId, isActive: true, syncEnabled: true },
		select: { plaidAccountId: true, id: true, name: true },
	})) as Array<{ plaidAccountId: string; id: string; name: string }>;

	const map = new Map<string, { id: string; name: string }>();
	for (const acct of accounts) {
		map.set(acct.plaidAccountId, { id: acct.id, name: acct.name });
	}
	return map;
}

// ─── Category map loader ──────────────────────────────────────────────────────

async function loadCategoryNameToIdMap(
	userId: string,
	db: SqliteDbClient,
): Promise<{
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
}> {
	const categories = (await db.category.findMany({
		where: { OR: [{ userId: null }, { userId }] },
		select: { id: true, name: true },
	})) as Array<{ id: string; name: string }>;

	const categoryNameToId = new Map<string, string>(
		categories.map((c) => [c.name.toLowerCase(), c.id]),
	);

	const uncategorizedCategoryId = categoryNameToId.get("uncategorized");
	if (!uncategorizedCategoryId) {
		throw new Error(
			`No "Uncategorized" category found for userId ${userId}; ` +
				"run seedDefaultCategories() before syncing.",
		);
	}

	return { categoryNameToId, uncategorizedCategoryId };
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Runs a full cursor-based incremental sync for one PlaidItem.
 * Concurrent callers for the same item await the in-flight sync.
 */
export async function syncTransactionsForItem(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	refreshBalances?: boolean;
}): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, db, refreshBalances = false } = params;

	const inFlight = syncInProgress.get(plaidItemDbId);
	if (inFlight) {
		return inFlight;
	}

	const syncPromise = runSync({
		userId,
		plaidItemDbId,
		db,
		refreshBalances,
	}).finally(() => {
		syncInProgress.delete(plaidItemDbId);
	});
	syncInProgress.set(plaidItemDbId, syncPromise);
	return syncPromise;
}

async function runSync(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	refreshBalances: boolean;
}): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, db, refreshBalances } = params;
	const client = getPlaidClient();

	const item = (await db.plaidItem.findFirstOrThrow({
		where: { id: plaidItemDbId, userId },
		select: {
			id: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			cursor: true,
		},
	})) as {
		id: string;
		accessTokenEncrypted: Buffer | null;
		accessRevokedAt: Date | null;
		cursor: string | null;
	};

	const accessTokenEncrypted = livePlaidAccessToken(item);
	if (!accessTokenEncrypted) {
		throw new Error(
			"Bank access for this institution was removed. Reconnect it to resume sync.",
		);
	}

	// Decrypt using token-storage (dynamic import to avoid safeStorage at module load)
	const { decryptAccessToken } = await import("./token-storage");
	const accessToken = decryptAccessToken(accessTokenEncrypted);
	// Treat empty string as null — Plaid returns "" when product is not ready.
	const startingCursor = item.cursor || null;

	let accountIdMap: Map<string, { id: string; name: string }>;
	if (refreshBalances) {
		accountIdMap = await syncAccountsForItem({
			db,
			plaidItemDbId,
			accessToken,
		});
	} else {
		accountIdMap = await loadAccountMapFromDatabase(plaidItemDbId, db);
	}

	const { categoryNameToId, uncategorizedCategoryId } =
		await loadCategoryNameToIdMap(userId, db);

	try {
		return await paginateAndPersist({
			client,
			accessToken,
			startingCursor,
			userId,
			plaidItemDbId,
			accountIdMap,
			categoryNameToId,
			uncategorizedCategoryId,
			db,
		});
	} catch (err) {
		const { code, message } = getPlaidErrorDetails(err);
		await db.plaidItem.update({
			where: { id: plaidItemDbId },
			data: {
				lastSyncAt: new Date(),
				lastErrorCode: code,
				lastErrorMessage: message,
				requiresReconnect: isPlaidReconnectRequired(err),
			},
		});
		throw err;
	}
}

// ─── Pagination + atomic DB write ────────────────────────────────────────────

async function paginateAndPersist(params: {
	client: ReturnType<typeof getPlaidClient>;
	accessToken: string;
	startingCursor: string | null;
	userId: string;
	plaidItemDbId: string;
	accountIdMap: Map<string, { id: string; name: string }>;
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
	db: SqliteDbClient;
}): Promise<SyncTransactionsResult> {
	const {
		client,
		accessToken,
		userId,
		plaidItemDbId,
		accountIdMap,
		categoryNameToId,
		uncategorizedCategoryId,
		db,
	} = params;
	let { startingCursor } = params;

	type AddedOrModified = Awaited<
		ReturnType<(typeof client)["transactionsSync"]>
	>["data"]["added"][number];
	type Removed = Awaited<
		ReturnType<(typeof client)["transactionsSync"]>
	>["data"]["removed"][number];

	let added: AddedOrModified[] = [];
	let modified: AddedOrModified[] = [];
	let removed: Removed[] = [];
	let nextCursor: string | null = null;

	// ── Phase 1: Paginate completely before writing ───────────────────────────
	const plaidStartedAt = Date.now();
	let pageCount = 0;
	let restartNeeded = true;
	while (restartNeeded) {
		restartNeeded = false;
		added = [];
		modified = [];
		removed = [];
		let cursor: string | null = startingCursor;
		let hasMore = true;
		pageCount = 0;

		while (hasMore) {
			let response: Awaited<ReturnType<typeof client.transactionsSync>>;
			try {
				response = await client.transactionsSync({
					access_token: accessToken,
					...(cursor ? { cursor } : {}),
					count: 500,
					options: { include_original_description: true },
				});
				pageCount += 1;
			} catch (err) {
				if (isPlaidMutationDuringPagination(err)) {
					startingCursor = params.startingCursor;
					restartNeeded = true;
					break;
				}
				throw err;
			}

			const data = response.data;
			added.push(...data.added);
			modified.push(...data.modified);
			removed.push(...data.removed);
			hasMore = data.has_more;
			// Plaid returns "" when transactions are not ready yet — normalize to null.
			nextCursor = data.next_cursor || null;
			cursor = nextCursor;
		}
	}
	const plaidMs = Date.now() - plaidStartedAt;

	// ── Phase 2: Chunked DB writes ────────────────────────────────────────────
	const writeStartedAt = Date.now();
	const isFirstHistoricalSync = params.startingCursor === null;
	if (isFirstHistoricalSync) {
		await seedDesktopTransactionSyncWatermarks({ db, plaidItemDbId });
	}
	const plaidAccountIds = Array.from(accountIdMap.values()).map(
		(account) => account.id,
	);
	const existingWatermarks = await loadDesktopTransactionSyncWatermarks({
		db,
		plaidAccountIds,
	});
	const overlapWindows = await loadDesktopHistoricalOverlapWindows({
		db,
		plaidAccountIds,
		currentPlaidItemDbId: plaidItemDbId,
	});
	const persistedThroughByPlaidAccountId = new Map<string, Date>();
	let skippedHistoricalCount = 0;
	let skippedDisabledAccountCount = 0;
	let persistedNew = 0;
	let persistedUpdated = 0;
	let oldestPostedDate: string | undefined;
	let newestPostedDate: string | undefined;

	const upsertEntries: TransactionUpsertEntry[] = [
		...added.map((tx) => ({ tx, kind: "added" as const })),
		...modified.map((tx) => ({ tx, kind: "modified" as const })),
	];
	const chunks = chunkArray(upsertEntries, DESKTOP_SYNC_WRITE_CHUNK_SIZE);

	let prefetchMs = 0;
	let dbWriteMs = 0;
	let addedCount = 0;
	let modifiedCount = 0;
	let removedCount = 0;
	const syncedTransactionIds: string[] = [];

	function notePostedDate(
		plaidAccountDbId: string | null,
		postedDate: Date | null,
	): void {
		if (!postedDate) return;
		const postedDateKey = toUtcDateKey(postedDate);
		if (!oldestPostedDate || postedDateKey < oldestPostedDate) {
			oldestPostedDate = postedDateKey;
		}
		if (!newestPostedDate || postedDateKey > newestPostedDate) {
			newestPostedDate = postedDateKey;
		}
		if (!plaidAccountDbId) return;
		const current = persistedThroughByPlaidAccountId.get(plaidAccountDbId);
		if (!current || postedDate.getTime() > current.getTime()) {
			persistedThroughByPlaidAccountId.set(plaidAccountDbId, postedDate);
		}
	}

	for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex += 1) {
		const chunk = chunks[chunkIndex];
		if (!chunk) continue;
		const isFinalChunk = chunkIndex === chunks.length - 1;
		const chunkWriteStartedAt = Date.now();

		const chunkResult = await db.$transaction(async (tx) => {
			let chunkAddedCount = 0;
			let chunkModifiedCount = 0;
			let chunkRemovedCount = 0;
			let chunkSkippedDisabledCount = 0;
			const chunkSyncedIds: string[] = [];

			const prefetchIds = externalIdsNeedingPrefetch(
				chunk.map((entry) => ({
					kind: entry.kind,
					transactionId: entry.tx.transaction_id,
				})),
			);
			const existingByExternalId = new Map<
				string,
				PersistedExistingTransaction
			>();
			if (prefetchIds.length > 0) {
				const prefetchStartedAt = Date.now();
				const rows = (await tx.transaction.findMany({
					where: {
						userId,
						externalTransactionId: { in: prefetchIds },
					},
					select: {
						id: true,
						categoryId: true,
						splitGroupId: true,
						externalTransactionId: true,
					},
				})) as PersistedExistingTransaction[];
				prefetchMs += Date.now() - prefetchStartedAt;
				for (const row of rows) {
					if (!row.externalTransactionId) continue;
					existingByExternalId.set(row.externalTransactionId, row);
				}
			}

			for (const { tx: plaidTx, kind } of chunk) {
				if (
					shouldSkipDisabledAccountTransaction({
						plaidAccountId: plaidTx.account_id,
						enabledAccountIds: accountIdMap,
					})
				) {
					chunkSkippedDisabledCount += 1;
					continue;
				}

				const accountEntry = accountIdMap.get(plaidTx.account_id) ?? null;
				const plaidAccountDbId = accountEntry?.id ?? null;
				const postedDate = parsePlaidDate(plaidTx.date);
				const existing =
					existingByExternalId.get(plaidTx.transaction_id) ?? null;

				if (
					!existing &&
					shouldSkipHistoricalAddedTransaction({
						kind: kind === "modified" ? "added" : kind,
						postedDate,
						overlap: plaidAccountDbId
							? overlapWindows.get(plaidAccountDbId)
							: undefined,
					})
				) {
					skippedHistoricalCount += 1;
					continue;
				}

				const { create, update } = mapPlaidTransactionToDbInput({
					tx: plaidTx,
					userId,
					plaidItemDbId,
					plaidAccountDbId,
					existingTransaction: existing,
					categoryNameToId,
					uncategorizedCategoryId,
				});

				await tx.transaction.upsert({
					where: {
						userId_externalTransactionId: {
							userId,
							externalTransactionId: plaidTx.transaction_id,
						},
					},
					create,
					update,
				});
				chunkSyncedIds.push(existing?.id ?? create.id);
				if (kind === "added") chunkAddedCount += 1;
				else chunkModifiedCount += 1;
				if (existing) persistedUpdated += 1;
				else persistedNew += 1;
				notePostedDate(plaidAccountDbId, postedDate);
			}

			if (isFinalChunk) {
				const now = new Date();
				const removedIds = removedTransactionIds(removed);
				if (removedIds.length > 0) {
					const result = await tx.transaction.updateMany({
						where: {
							userId,
							externalTransactionId: { in: removedIds },
							removedAt: null,
						},
						data: { removedAt: now },
					});
					chunkRemovedCount = result.count;
				}

				const productNotReady =
					addedCount + chunkAddedCount === 0 &&
					modifiedCount + chunkModifiedCount === 0 &&
					chunkRemovedCount === 0 &&
					!nextCursor;

				await tx.plaidItem.update({
					where: { id: plaidItemDbId },
					data: {
						cursor: nextCursor,
						lastSyncAt: now,
						...(productNotReady ? {} : { lastSuccessfulSyncAt: now }),
						requiresReconnect: false,
						lastErrorCode: null,
						lastErrorMessage: null,
					},
				});

				if (!productNotReady) {
					await advanceDesktopTransactionSyncWatermarks({
						db: tx as unknown as SqliteDbClient,
						persistedThroughByPlaidAccountId,
						existingByPlaidAccountId: existingWatermarks,
					});
				}
			}

			return {
				addedCount: chunkAddedCount,
				modifiedCount: chunkModifiedCount,
				removedCount: chunkRemovedCount,
				skippedDisabledAccountCount: chunkSkippedDisabledCount,
				syncedTransactionIds: chunkSyncedIds,
			};
		});

		dbWriteMs += Date.now() - chunkWriteStartedAt;
		addedCount += chunkResult.addedCount;
		modifiedCount += chunkResult.modifiedCount;
		removedCount += chunkResult.removedCount;
		skippedDisabledAccountCount += chunkResult.skippedDisabledAccountCount;
		syncedTransactionIds.push(...chunkResult.syncedTransactionIds);
	}

	const totalMs = Date.now() - writeStartedAt;
	remoteLogger.info("Plaid transaction sync persisted", {
		event: "plaid.sync_transactions_timing",
		feature: "plaid",
		operation: "syncTransactions",
		metadata: {
			addedCount,
			modifiedCount,
			removedCount,
			skippedHistoricalCount,
			skippedDisabledAccountCount,
			prefetchMs,
			dbWriteMs,
			plaidMs,
			totalMs,
			pageCount,
			chunkCount: chunks.length,
			isFirstHistoricalSync,
			...(oldestPostedDate ? { oldestPostedDate } : {}),
			...(newestPostedDate ? { newestPostedDate } : {}),
		},
	});
	if (skippedDisabledAccountCount > 0) {
		remoteLogger.warn(
			"Skipped Plaid transactions for accounts not in the enabled map",
			{
				event: "plaid.sync_disabled_account_skipped",
				feature: "plaid",
				operation: "syncTransactions",
				metadata: { skippedDisabledAccountCount },
			},
		);
	}

	await applyRulesAfterDesktopPlaidSync(syncedTransactionIds);

	let transferPairsCreated = 0;
	let transferPairsRemoved = 0;
	try {
		const pairing = await detectAndPairTransfers({
			db,
			userId,
			candidateTransactionIds: syncedTransactionIds,
		});
		transferPairsCreated = pairing.pairsCreated;
		transferPairsRemoved = pairing.pairsReconciled;
	} catch (error) {
		remoteLogger.error("Desktop transfer pairing failed after sync", {
			event: "desktop.transfer_pairing.failed",
			feature: "transfer-pairing",
			operation: "syncTransactions",
			metadata: {
				errorMessage: error instanceof Error ? error.message : String(error),
			},
		});
	}

	const receivedFromPlaid = added.length + modified.length + removed.length;
	const audit = buildTransactionSyncAudit({
		receivedFromPlaid,
		added: added.length,
		modified: modified.length,
		removed: removed.length,
		persistedNew,
		persistedUpdated,
		reconnectOverlapSkipped: skippedHistoricalCount,
		disabledAccountSkipped: skippedDisabledAccountCount,
		markedRemoved: removedCount,
		removedNoOp: Math.max(0, removed.length - removedCount),
		seededCategories: persistedNew,
		rulesApplied: 0,
		transferPairsCreated,
		transferPairsRemoved,
	});

	return {
		addedCount,
		modifiedCount,
		removedCount,
		nextCursor,
		skippedHistoricalCount,
		skippedDisabledAccountCount,
		reconnectOverlapSkipped: skippedHistoricalCount,
		audit,
	};
}
