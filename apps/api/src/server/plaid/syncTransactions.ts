/**
 * Main Plaid transaction sync engine.
 *
 * Uses /transactions/sync exclusively — /transactions/get is never called here.
 *
 * Critical correctness guarantees enforced by this module:
 *   1. Full pagination completes BEFORE any DB writes begin
 *   2. Transaction rows are written in chunked transactions; cursor advancement
 *      happens only in the final chunk after all row writes succeed
 *   3. On TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION, resets to original cursor
 *      and restarts the pagination loop from scratch
 *   4. Removed transactions are soft-deleted via removedAt=now() — never hard-deleted
 *   5. Per-item advisory lock prevents overlapping syncs from corrupting cursor state
 *   6. Cursor only advances inside the same DB transaction as the row writes
 *
 * Server-side only — never import from client code.
 */
import {
	buildTransactionSyncAudit,
	shouldSkipDisabledAccountTransaction,
	shouldSkipHistoricalAddedTransaction,
	type TransactionSyncAudit,
	toUtcDateKey,
} from "@moat/domain";
import type { Transaction as PlaidTransaction } from "plaid";
import { logger } from "~/lib/logger";
import { db } from "../db";
import { decrypt } from "../lib/encryption";
import { getPlaidClient } from "../lib/plaidClient";
import { loadCategoryNameToIdMap } from "../services/category-import.service";
import type { ProviderEndpointCall } from "../services/sync-types";
import { applyRulesToSyncedTransactions } from "../services/transaction-rules-on-import.service";
import { detectAndPairTransfers } from "../services/transfer-pairing.service";
import { logUncategorizedPlaidTransactionImport } from "../services/uncategorized-transaction-import-logging";
import {
	getPlaidErrorDetails,
	isPlaidMutationDuringPagination,
	isPlaidReconnectRequired,
} from "./errors";
import { refreshPlaidInvestmentContributionInputs } from "./investment-forecast-inputs";
import { withPlaidItemLock } from "./lock";
import {
	mapPlaidCategory,
	mapPlaidTransactionToDbInput,
	parsePlaidDate,
} from "./mapping";
import { trackPlaidProviderCall } from "./provider-calls";
import {
	loadPlaidProviderContext,
	type PlaidProviderContext,
} from "./provider-context";
import { syncAccountsForItem } from "./syncAccounts";
import {
	advanceTransactionSyncWatermarks,
	loadHistoricalOverlapWindowsForPlaidAccounts,
	loadTransactionSyncWatermarks,
	seedTransactionSyncWatermarksForItem,
} from "./transaction-sync-watermarks";
import type { ExistingTransactionLike } from "./types";

const SYNC_WRITE_CHUNK_SIZE = 100;
const SYNC_WRITE_TX_TIMEOUT_MS = 20_000;

type PlaidSyncTransaction = PlaidTransaction;

type TransactionUpsertEntry = {
	tx: PlaidSyncTransaction;
	kind: "added" | "modified";
};

type TransactionClient = Parameters<Parameters<typeof db.$transaction>[0]>[0];

// ─── Account Map Helpers ──────────────────────────────────────────────────────

/**
 * Loads the Plaid account_id → internal PlaidAccount.id mapping from database.
 * Used for transaction linking without calling Plaid API.
 */
async function loadAccountMapFromDatabase(
	userId: string,
	plaidItemDbId: string,
): Promise<Map<string, { id: string; name: string }>> {
	const accounts = await db.plaidAccount.findMany({
		where: {
			plaidItemId: plaidItemDbId,
			userId,
			isActive: true,
			syncEnabled: true,
		},
		select: {
			plaidAccountId: true,
			id: true,
			name: true,
		},
	});

	const accountIdMap = new Map<string, { id: string; name: string }>();
	for (const acct of accounts) {
		accountIdMap.set(acct.plaidAccountId, { id: acct.id, name: acct.name });
	}

	if (accountIdMap.size === 0) {
		logger.warn("No active accounts found for item", {
			feature: "plaid",
			operation: "loadAccountMap",
			userId,
			itemId: plaidItemDbId.slice(0, 8),
		});
	}

	return accountIdMap;
}

function chunkArray<T>(array: T[], size: number): T[][] {
	if (array.length === 0) return [[]];
	const chunks: T[][] = [];
	for (let index = 0; index < array.length; index += size) {
		chunks.push(array.slice(index, index + size));
	}
	return chunks;
}

async function prefetchExistingByExternalId(
	tx: TransactionClient,
	userId: string,
	externalIds: string[],
): Promise<Map<string, ExistingTransactionLike>> {
	if (externalIds.length === 0) return new Map();

	const rows = await tx.transaction.findMany({
		where: {
			userId,
			externalTransactionId: { in: externalIds },
		},
		select: {
			externalTransactionId: true,
			categoryId: true,
			category: true,
			splitGroupId: true,
		},
	});

	const existingByExternalId = new Map<string, ExistingTransactionLike>();
	for (const row of rows) {
		if (!row.externalTransactionId) continue;
		existingByExternalId.set(row.externalTransactionId, {
			categoryId: row.categoryId,
			category: row.category,
			splitGroupId: row.splitGroupId,
		});
	}

	return existingByExternalId;
}

function resolveProviderContextForPlaidAccount(
	providerContext: PlaidProviderContext,
	plaidAccountExternalId: string,
) {
	if (!providerContext.financialConnectionId) return undefined;

	return {
		financialConnectionId: providerContext.financialConnectionId,
		account:
			providerContext.accountsByPlaidAccountId.get(plaidAccountExternalId) ??
			null,
	};
}

async function upsertPlaidTransactionRow(input: {
	tx: TransactionClient;
	plaidTx: PlaidSyncTransaction;
	userId: string;
	plaidItemDbId: string;
	accountIdMap: Map<string, { id: string; name: string }>;
	categoryNameToId: Map<string, string>;
	uncategorizedCategoryId: string;
	providerContext: PlaidProviderContext;
	existingTransaction: ExistingTransactionLike | null;
	warnLabel: string;
	importKind: "added" | "modified";
}): Promise<void> {
	const {
		tx,
		plaidTx,
		userId,
		plaidItemDbId,
		accountIdMap,
		categoryNameToId,
		uncategorizedCategoryId,
		providerContext,
		existingTransaction,
		warnLabel,
	} = input;

	const accountEntry = accountIdMap.get(plaidTx.account_id) ?? null;
	const plaidAccountDbId = accountEntry?.id ?? null;
	const accountName = accountEntry?.name ?? null;

	if (!plaidAccountDbId) {
		logger.warn(`${warnLabel} references unknown account`, {
			feature: "plaid",
			operation: "sync",
			userId,
			transactionIdPrefix: plaidTx.transaction_id.slice(0, 8),
		});
		return;
	}

	const { create, update } = mapPlaidTransactionToDbInput({
		tx: plaidTx,
		userId,
		plaidItemDbId,
		plaidAccountDbId,
		accountName,
		existingTransaction,
		categoryNameToId,
		uncategorizedCategoryId,
		providerContext: resolveProviderContextForPlaidAccount(
			providerContext,
			plaidTx.account_id,
		),
	});

	const hasUserCategory =
		!!existingTransaction?.categoryId &&
		existingTransaction.categoryId !== uncategorizedCategoryId;
	const mappedCategory = mapPlaidCategory(plaidTx);

	logUncategorizedPlaidTransactionImport({
		userId,
		plaidTx,
		mappedCategory,
		resolvedCategoryId: create.categoryId as string,
		uncategorizedCategoryId,
		importKind: input.importKind,
		preservesExistingCategory: hasUserCategory,
	});

	await tx.transaction.upsert({
		where: {
			unique_external_tx: {
				userId,
				externalTransactionId: plaidTx.transaction_id,
			},
		},
		create,
		update,
	});
}

async function softDeleteRemovedTransactions(input: {
	tx: TransactionClient;
	userId: string;
	removed: Array<{ transaction_id?: string | null }>;
	now: Date;
}): Promise<number> {
	const removedIds = input.removed
		.map((removedTx) => removedTx.transaction_id)
		.filter((transactionId): transactionId is string => !!transactionId);

	if (removedIds.length === 0) return 0;

	const result = await input.tx.transaction.updateMany({
		where: {
			userId: input.userId,
			externalTransactionId: { in: removedIds },
			removedAt: null,
		},
		data: { removedAt: input.now },
	});

	return result.count;
}

// ─── Result type ──────────────────────────────────────────────────────────────

export interface SyncTransactionsResult {
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	nextCursor: string | null;
	skippedDisabledAccountCount: number;
	reconnectOverlapSkipped: number;
	audit: TransactionSyncAudit;
}

// ─── Main sync function ───────────────────────────────────────────────────────

/**
 * Runs a full cursor-based incremental sync for one PlaidItem.
 */
export async function syncTransactionsForItem(params: {
	userId: string;
	plaidItemDbId: string;
	refreshBalances?: boolean;
	callLog?: ProviderEndpointCall[];
}): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, refreshBalances = false, callLog } = params;

	return withPlaidItemLock({
		db,
		plaidItemDbId,
		fn: () =>
			runSyncUnderLock({ userId, plaidItemDbId, refreshBalances, callLog }),
	});
}

// ─── Internal sync logic (runs inside advisory lock) ─────────────────────────

async function runSyncUnderLock(params: {
	userId: string;
	plaidItemDbId: string;
	refreshBalances: boolean;
	callLog?: ProviderEndpointCall[];
}): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, refreshBalances, callLog } = params;
	const client = getPlaidClient();

	const item = await db.plaidItem.findFirstOrThrow({
		where: { id: plaidItemDbId, userId },
		select: {
			id: true,
			plaidItemId: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			cursor: true,
		},
	});

	if (!item.accessTokenEncrypted || item.accessRevokedAt) {
		throw new Error("Plaid access has been revoked for this institution");
	}
	const accessToken = decrypt(item.accessTokenEncrypted);
	const startingCursor = item.cursor || null;

	let accountIdMap: Map<string, { id: string; name: string }>;

	if (refreshBalances) {
		accountIdMap = await syncAccountsForItem({
			db,
			userId,
			plaidItemDbId,
			accessToken,
			callLog,
		});
		logger.info("Refreshed account balances", {
			feature: "plaid",
			operation: "sync",
			userId,
			accountCount: accountIdMap.size,
		});
	} else {
		accountIdMap = await loadAccountMapFromDatabase(userId, plaidItemDbId);
		logger.info("Loaded account mappings from DB", {
			feature: "plaid",
			operation: "sync",
			userId,
			accountCount: accountIdMap.size,
		});
	}

	const { categoryNameToId, uncategorizedCategoryId } =
		await loadCategoryNameToIdMap(userId);

	const providerContext = await loadPlaidProviderContext({
		userId,
		plaidItemExternalId: item.plaidItemId,
	});

	try {
		const result = await paginateAndPersist({
			client,
			accessToken,
			startingCursor,
			userId,
			plaidItemDbId,
			accountIdMap,
			categoryNameToId,
			uncategorizedCategoryId,
			providerContext,
			callLog,
		});

		return result;
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
	providerContext: PlaidProviderContext;
	callLog?: ProviderEndpointCall[];
}): Promise<SyncTransactionsResult> {
	const {
		client,
		accessToken,
		userId,
		plaidItemDbId,
		accountIdMap,
		categoryNameToId,
		uncategorizedCategoryId,
		providerContext,
	} = params;
	let { startingCursor } = params;

	type Removed = Awaited<
		ReturnType<(typeof client)["transactionsSync"]>
	>["data"]["removed"][number];

	let added: PlaidSyncTransaction[] = [];
	let modified: PlaidSyncTransaction[] = [];
	let removed: Removed[] = [];
	let nextCursor: string | null = null;

	let restartNeeded = true;
	while (restartNeeded) {
		restartNeeded = false;
		added = [];
		modified = [];
		removed = [];
		let cursor: string | null = startingCursor;
		let hasMore = true;

		while (hasMore) {
			let response: Awaited<ReturnType<typeof client.transactionsSync>>;

			try {
				response = await trackPlaidProviderCall({
					endpoint: "/transactions/sync",
					costCategory: "cached_or_included",
					userId: params.userId,
					plaidItemDbId: params.plaidItemDbId,
					operation: "syncTransactions",
					callLog: params.callLog,
					fn: () =>
						client.transactionsSync({
							access_token: accessToken,
							...(cursor !== null ? { cursor } : {}),
							count: 500,
							options: { include_original_description: true },
						}),
				});
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
			nextCursor = data.next_cursor || null;
			cursor = nextCursor;
		}
	}

	const syncStartedAt = Date.now();
	const isFirstHistoricalSync = params.startingCursor === null;
	if (isFirstHistoricalSync) {
		await seedTransactionSyncWatermarksForItem(db, {
			userId,
			plaidItemDbId,
		});
	}
	const plaidAccountDbIds = Array.from(accountIdMap.values()).map(
		(account) => account.id,
	);
	const existingWatermarks = await loadTransactionSyncWatermarks(
		db,
		plaidAccountDbIds,
	);
	const overlapWindows = await loadHistoricalOverlapWindowsForPlaidAccounts(
		db,
		{
			userId,
			plaidAccountIds: plaidAccountDbIds,
			currentPlaidItemDbId: plaidItemDbId,
		},
	);
	const persistedThroughByPlaidAccountId = new Map<string, Date>();
	const financialAccountIdByPlaidAccountId = new Map<string, string>();
	for (const [externalId, account] of accountIdMap) {
		const providerAccount =
			providerContext.accountsByPlaidAccountId.get(externalId);
		if (providerAccount) {
			financialAccountIdByPlaidAccountId.set(
				account.id,
				providerAccount.financialAccountId,
			);
		}
	}

	const upsertEntries: TransactionUpsertEntry[] = [
		...added.map((tx) => ({ tx, kind: "added" as const })),
		...modified.map((tx) => ({ tx, kind: "modified" as const })),
	];
	const chunks = chunkArray(upsertEntries, SYNC_WRITE_CHUNK_SIZE);

	let prefetchMs = 0;
	let dbWriteMs = 0;
	let addedCount = 0;
	let modifiedCount = 0;
	let removedCount = 0;
	let skippedDisabledAccountCount = 0;
	let reconnectOverlapSkipped = 0;
	let persistedNew = 0;
	let persistedUpdated = 0;
	let oldestPostedDate: string | undefined;
	let newestPostedDate: string | undefined;
	const syncedExternalIds: string[] = [];

	for (let chunkIndex = 0; chunkIndex < chunks.length; chunkIndex++) {
		const chunk = chunks[chunkIndex];
		if (!chunk) continue;

		const isFinalChunk = chunkIndex === chunks.length - 1;
		const chunkWriteStartedAt = Date.now();

		const chunkResult = await db.$transaction(
			async (tx) => {
				let existingByExternalId = new Map<string, ExistingTransactionLike>();

				const externalIdsNeedingPrefetch = chunk
					.filter(({ kind }) => !isFirstHistoricalSync || kind === "modified")
					.map(({ tx: plaidTx }) => plaidTx.transaction_id);

				if (externalIdsNeedingPrefetch.length > 0) {
					const prefetchStartedAt = Date.now();
					existingByExternalId = await prefetchExistingByExternalId(
						tx,
						userId,
						externalIdsNeedingPrefetch,
					);
					prefetchMs += Date.now() - prefetchStartedAt;
				}

				let chunkAddedCount = 0;
				let chunkModifiedCount = 0;
				let chunkSkippedDisabledCount = 0;
				const chunkSyncedExternalIds: string[] = [];

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

					const postedDate = parsePlaidDate(plaidTx.date);
					const plaidAccountDbId =
						accountIdMap.get(plaidTx.account_id)?.id ?? null;
					if (
						shouldSkipHistoricalAddedTransaction({
							kind,
							postedDate,
							overlap: plaidAccountDbId
								? overlapWindows.get(plaidAccountDbId)
								: undefined,
						})
					) {
						reconnectOverlapSkipped += 1;
						continue;
					}

					const existingTransaction =
						isFirstHistoricalSync && kind === "added"
							? null
							: (existingByExternalId.get(plaidTx.transaction_id) ?? null);

					await upsertPlaidTransactionRow({
						tx,
						plaidTx,
						userId,
						plaidItemDbId,
						accountIdMap,
						categoryNameToId,
						uncategorizedCategoryId,
						providerContext,
						existingTransaction,
						warnLabel:
							kind === "added" ? "Transaction" : "Modified transaction",
						importKind: kind,
					});

					chunkSyncedExternalIds.push(plaidTx.transaction_id);
					if (kind === "added") chunkAddedCount++;
					else chunkModifiedCount++;
					if (existingTransaction) persistedUpdated += 1;
					else persistedNew += 1;

					if (postedDate) {
						const postedDateKey = toUtcDateKey(postedDate);
						if (!oldestPostedDate || postedDateKey < oldestPostedDate) {
							oldestPostedDate = postedDateKey;
						}
						if (!newestPostedDate || postedDateKey > newestPostedDate) {
							newestPostedDate = postedDateKey;
						}
					}

					if (plaidAccountDbId && postedDate) {
						const current =
							persistedThroughByPlaidAccountId.get(plaidAccountDbId);
						if (!current || postedDate.getTime() > current.getTime()) {
							persistedThroughByPlaidAccountId.set(
								plaidAccountDbId,
								postedDate,
							);
						}
					}
				}

				let chunkRemovedCount = 0;
				if (isFinalChunk) {
					const now = new Date();
					chunkRemovedCount = await softDeleteRemovedTransactions({
						tx,
						userId,
						removed,
						now,
					});

					await refreshPlaidInvestmentContributionInputs({
						db: tx,
						userId,
						plaidAccountIds: Array.from(
							new Set(
								Array.from(accountIdMap.values()).map((account) => account.id),
							),
						),
					});

					await tx.plaidItem.update({
						where: { id: plaidItemDbId },
						data: {
							cursor: nextCursor ?? undefined,
							lastSyncAt: now,
							lastSuccessfulSyncAt: now,
							lastTransactionSyncAt: now,
							requiresReconnect: false,
							lastErrorCode: null,
							lastErrorMessage: null,
						},
					});

					await advanceTransactionSyncWatermarks(tx, {
						persistedThroughByPlaidAccountId,
						existingByPlaidAccountId: existingWatermarks,
						financialAccountIdByPlaidAccountId,
					});
				}

				return {
					addedCount: chunkAddedCount,
					modifiedCount: chunkModifiedCount,
					removedCount: chunkRemovedCount,
					skippedDisabledAccountCount: chunkSkippedDisabledCount,
					syncedExternalIds: chunkSyncedExternalIds,
				};
			},
			{ timeout: SYNC_WRITE_TX_TIMEOUT_MS },
		);

		dbWriteMs += Date.now() - chunkWriteStartedAt;
		addedCount += chunkResult.addedCount;
		modifiedCount += chunkResult.modifiedCount;
		removedCount += chunkResult.removedCount;
		skippedDisabledAccountCount += chunkResult.skippedDisabledAccountCount;
		syncedExternalIds.push(...chunkResult.syncedExternalIds);
	}

	const totalMs = Date.now() - syncStartedAt;
	logger.info("Plaid transaction sync persisted", {
		feature: "plaid",
		operation: "syncTransactions",
		userId,
		addedCount,
		modifiedCount,
		removedCount,
		skippedDisabledAccountCount,
		prefetchMs,
		dbWriteMs,
		totalMs,
		chunkCount: chunks.length,
		isFirstHistoricalSync,
		oldestPostedDate,
		newestPostedDate,
	});
	if (skippedDisabledAccountCount > 0) {
		logger.warn(
			"Skipped Plaid transactions for accounts not in the enabled map",
			{
				feature: "plaid",
				operation: "sync",
				userId,
				skippedDisabledAccountCount,
			},
		);
	}

	await applyRulesToSyncedTransactions(userId, syncedExternalIds);

	let transferPairsCreated = 0;
	let transferPairsRemoved = 0;
	try {
		const pairing = await detectAndPairTransfers({
			userId,
			candidateExternalIds: syncedExternalIds,
		});
		transferPairsCreated = pairing.pairsCreated;
		transferPairsRemoved = pairing.pairsReconciled;
	} catch (error) {
		logger.error("Transfer pairing failed after sync", {
			feature: "transfer-pairing",
			operation: "syncTransactions",
			userId,
			errorMessage: error instanceof Error ? error.message : String(error),
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
		reconnectOverlapSkipped,
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
		skippedDisabledAccountCount,
		reconnectOverlapSkipped,
		audit,
	};
}
