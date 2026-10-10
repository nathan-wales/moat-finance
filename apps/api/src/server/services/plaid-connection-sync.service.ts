import { isCachedPlaidItemStale } from "@moat/domain";
import type { SyncTrigger } from "@moat/financial-data-providers";
import { PLAID_INVESTMENTS_PRODUCT } from "@moat/financial-data-providers/plaid-investments";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { decrypt } from "~/server/lib/encryption";
import {
	LIVE_PLAID_ITEM_WHERE,
	livePlaidAccessToken,
} from "~/server/plaid/access-state";
import { syncAccountsForItem } from "~/server/plaid/syncAccounts";
import { syncTransactionsForItem } from "~/server/plaid/syncTransactions";
import {
	recordSyncedAccountHistory,
	sweepSyncedAccountHistoryForToday,
} from "./account-balance-history.service";
import { takeSnapshot } from "./balance-snapshot.service";
import { runConnectionSyncJob } from "./connection-sync-orchestrator.service";
import { ensureFinancialConnectionForPlaidItem } from "./financial-connections.service";
import {
	beginProviderSyncAttempt,
	completeProviderSyncAttempt,
} from "./provider-sync-attempt.service";
import { enqueueProviderSyncJob } from "./provider-sync-job.service";
import type { ProviderEndpointCall, SyncReason, SyncType } from "./sync-types";

const SCHEDULED_BALANCE_STALE_MS = 12 * 60 * 60 * 1000;
const SCHEDULED_TRANSACTION_STALE_MS = 8 * 60 * 60 * 1000;

export async function syncCachedBalancesForPlaidItem(input: {
	plaidItemDbId: string;
	userId: string;
	trigger: SyncTrigger;
	reason: SyncReason;
	syncType?: SyncType;
	webhookEventId?: string;
	skipRateLimit?: boolean;
}) {
	const item = await db.plaidItem.findFirst({
		where: { id: input.plaidItemDbId, userId: input.userId },
		select: {
			id: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			requiresReconnect: true,
		},
	});
	const accessTokenEncrypted = item ? livePlaidAccessToken(item) : null;
	if (!item || item.requiresReconnect || !accessTokenEncrypted) {
		return { accountCount: 0, skipped: true as const };
	}

	const { connectionId } = await ensureFinancialConnectionForPlaidItem({
		plaidItemDbId: item.id,
	});

	const callLog: ProviderEndpointCall[] = [];
	const attempt = await beginProviderSyncAttempt({
		connectionId,
		provider: "PLAID",
		trigger: input.trigger,
		userId: input.userId,
		syncType: input.syncType ?? "cached_balances",
		syncMode: "cached",
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});

	try {
		const accessToken = decrypt(accessTokenEncrypted);
		const accountMap = await syncAccountsForItem({
			db,
			userId: input.userId,
			plaidItemDbId: item.id,
			accessToken,
			callLog,
		});
		await ensureFinancialConnectionForPlaidItem({ plaidItemDbId: item.id });
		try {
			await takeSnapshot(input.userId, db);
		} catch (err) {
			logger.logError("Snapshot failed after balance sync", err, {
				feature: "plaid",
				operation: "syncCachedBalances",
				userId: input.userId,
				itemId: item.id,
			});
		}
		try {
			await recordSyncedAccountHistory(input.userId, db);
		} catch (err) {
			logger.logError("Account history failed after balance sync", err, {
				feature: "account-balance-history",
				operation: "syncCachedBalances",
				userId: input.userId,
				itemId: item.id,
			});
		}

		await db.financialConnection.update({
			where: { id: connectionId },
			data: {
				lastBalanceSyncAt: new Date(),
				status: "ACTIVE",
				lastErrorAt: null,
				lastErrorCode: null,
				lastErrorMessage: null,
				consecutiveFailures: 0,
			},
		});

		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "SUCCESS",
			endpointsCalled: callLog,
			accountCount: accountMap.size,
			providerRequestCount: callLog.length,
		});
		return { accountCount: accountMap.size, skipped: false as const };
	} catch (error) {
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "FAILED",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
			errorMessage:
				error instanceof Error ? error.message : "Balance sync failed",
		});
		throw error;
	}
}

export async function syncTransactionsForPlaidItem(input: {
	plaidItemDbId: string;
	userId: string;
	trigger: SyncTrigger;
	reason: SyncReason;
	refreshBalances?: boolean;
	webhookEventId?: string;
	skipRateLimit?: boolean;
}) {
	const item = await db.plaidItem.findFirst({
		where: { id: input.plaidItemDbId, userId: input.userId },
		select: {
			id: true,
			requiresReconnect: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
		},
	});
	if (!item || item.requiresReconnect || !livePlaidAccessToken(item)) {
		return null;
	}

	const { connectionId } = await ensureFinancialConnectionForPlaidItem({
		plaidItemDbId: item.id,
	});

	const callLog: ProviderEndpointCall[] = [];
	const attempt = await beginProviderSyncAttempt({
		connectionId,
		provider: "PLAID",
		trigger: input.trigger,
		userId: input.userId,
		syncType: "transactions",
		syncMode: "cached",
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});

	try {
		const result = await syncTransactionsForItem({
			userId: input.userId,
			plaidItemDbId: item.id,
			refreshBalances: input.refreshBalances ?? false,
			callLog,
		});
		await ensureFinancialConnectionForPlaidItem({ plaidItemDbId: item.id });

		await db.financialConnection.update({
			where: { id: connectionId },
			data: {
				lastSuccessfulSyncAt: new Date(),
				lastTransactionSyncAt: new Date(),
				status: "ACTIVE",
				lastErrorAt: null,
				lastErrorCode: null,
				lastErrorMessage: null,
				consecutiveFailures: 0,
			},
		});

		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "SUCCESS",
			endpointsCalled: callLog,
			addedCount: result.addedCount,
			modifiedCount: result.modifiedCount,
			removedCount: result.removedCount,
			providerRequestCount: callLog.length,
		});
		return result;
	} catch (error) {
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "FAILED",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
			errorMessage:
				error instanceof Error ? error.message : "Transaction sync failed",
		});
		throw error;
	}
}

export async function runManualCachedSyncForPlaidItem(input: {
	itemId: string;
	userId: string;
	reason?: SyncReason;
	skipRateLimit?: boolean;
	trigger?: SyncTrigger;
}) {
	const reason = input.reason ?? "manual_sync_button";
	const trigger = input.trigger ?? "USER_REFRESH";
	const txResult = await syncTransactionsForPlaidItem({
		plaidItemDbId: input.itemId,
		userId: input.userId,
		trigger,
		reason,
		refreshBalances: false,
		skipRateLimit: input.skipRateLimit,
	});

	const balanceResult = await syncCachedBalancesForPlaidItem({
		plaidItemDbId: input.itemId,
		userId: input.userId,
		trigger,
		reason,
		syncType: "cached_manual",
		skipRateLimit: true,
	});

	return {
		addedCount: txResult?.addedCount ?? 0,
		modifiedCount: txResult?.modifiedCount ?? 0,
		removedCount: txResult?.removedCount ?? 0,
		accountCount: balanceResult.accountCount,
		balancesRefreshed: !balanceResult.skipped && balanceResult.accountCount > 0,
	};
}

export async function runAppOpenCachedSyncForUser(userId: string): Promise<{
	syncedItemCount: number;
}> {
	const liveItems = await db.plaidItem.findMany({
		where: {
			userId,
			requiresReconnect: false,
			...LIVE_PLAID_ITEM_WHERE,
		},
		select: {
			id: true,
			institutionName: true,
			lastSuccessfulSyncAt: true,
			plaidAccounts: {
				where: { isActive: true },
				select: { lastBalanceSyncAt: true },
			},
		},
	});

	const staleItems = liveItems.filter((item) =>
		isCachedPlaidItemStale({
			lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
			accountLastBalanceSyncAts: item.plaidAccounts.map(
				(account) => account.lastBalanceSyncAt,
			),
		}),
	);

	if (staleItems.length === 0) {
		return { syncedItemCount: 0 };
	}

	logger.info("Queueing app-open cached Plaid sync", {
		feature: "plaid",
		operation: "runAppOpenCachedSyncForUser",
		userId,
		staleItemCount: staleItems.length,
	});

	return {
		syncedItemCount: await enqueueAppOpenCachedSyncJobs({
			userId,
			staleItemIds: staleItems.map((item) => item.id),
		}),
	};
}

/** Enqueues one cached_manual job per stale Plaid item. Injectable for tests. */
export async function enqueueAppOpenCachedSyncJobs(
	input: {
		userId: string;
		staleItemIds: string[];
	},
	deps?: {
		ensureConnection?: typeof ensureFinancialConnectionForPlaidItem;
		enqueueJob?: typeof enqueueProviderSyncJob;
	},
): Promise<number> {
	const ensureConnection =
		deps?.ensureConnection ?? ensureFinancialConnectionForPlaidItem;
	const enqueueJob = deps?.enqueueJob ?? enqueueProviderSyncJob;

	let syncedItemCount = 0;
	for (const itemId of input.staleItemIds) {
		try {
			const { connectionId } = await ensureConnection({
				plaidItemDbId: itemId,
			});
			await enqueueJob({
				userId: input.userId,
				connectionId,
				provider: "PLAID",
				syncType: "cached_manual",
				syncMode: "cached",
				trigger: "SCHEDULED",
				reason: "app_open_cached_sync",
			});
			syncedItemCount += 1;
		} catch (error) {
			logger.logError(
				"App-open cached Plaid sync enqueue failed for item",
				error,
				{
					feature: "plaid",
					operation: "runAppOpenCachedSyncForUser",
					userId: input.userId,
					itemId,
				},
			);
		}
	}

	return syncedItemCount;
}

export async function runScheduledBalanceSync(): Promise<{
	processed: number;
	skipped: number;
	failed: number;
}> {
	const staleThreshold = new Date(Date.now() - SCHEDULED_BALANCE_STALE_MS);
	const connections = await db.financialConnection.findMany({
		where: {
			status: { in: ["ACTIVE", "DEGRADED"] },
			OR: [
				{ lastBalanceSyncAt: null },
				{ lastBalanceSyncAt: { lt: staleThreshold } },
			],
		},
		select: { id: true, userId: true },
		take: 200,
	});

	let processed = 0;
	const skipped = 0;
	let failed = 0;

	for (const connection of connections) {
		try {
			await runConnectionSyncJob({
				connectionId: connection.id,
				userId: connection.userId,
				syncType: "cached_balances",
				trigger: "SCHEDULED",
				reason: "scheduled_balance_sync",
				skipRateLimit: true,
			});
			processed++;
		} catch (error) {
			failed++;
			logger.logError("Scheduled balance sync failed for connection", error, {
				feature: "plaid",
				operation: "scheduledBalanceSync",
				userId: connection.userId,
				connectionId: connection.id,
			});
		}
	}

	try {
		await sweepSyncedAccountHistoryForToday(db);
	} catch (error) {
		logger.logError("Nightly synced account history sweep failed", error, {
			feature: "account-balance-history",
			operation: "scheduledBalanceSyncSweep",
		});
	}

	return { processed, skipped, failed };
}

/**
 * Refreshes positions for Items that have consented to or already billed
 * Investments, including ones that have never had a holdings sync.
 */
export async function runScheduledHoldingsSync(): Promise<{
	processed: number;
	skipped: number;
	failed: number;
}> {
	const staleThreshold = new Date(Date.now() - SCHEDULED_BALANCE_STALE_MS);
	const items = await db.plaidItem.findMany({
		where: {
			requiresReconnect: false,
			...LIVE_PLAID_ITEM_WHERE,
			AND: [
				{
					OR: [
						{ billedProducts: { has: PLAID_INVESTMENTS_PRODUCT } },
						{ consentedProducts: { has: PLAID_INVESTMENTS_PRODUCT } },
					],
				},
				{
					OR: [
						{ lastHoldingsSyncAt: null },
						{ lastHoldingsSyncAt: { lt: staleThreshold } },
					],
				},
			],
		},
		select: { id: true, userId: true },
		take: 200,
	});

	let processed = 0;
	let skipped = 0;
	let failed = 0;

	for (const item of items) {
		try {
			const { connectionId } = await ensureFinancialConnectionForPlaidItem({
				plaidItemDbId: item.id,
			});
			const result = await runConnectionSyncJob({
				connectionId,
				userId: item.userId,
				syncType: "holdings",
				trigger: "SCHEDULED",
				reason: "scheduled_holdings_sync",
				skipRateLimit: true,
			});
			if (result?.holdingsSynced) processed++;
			else skipped++;
		} catch (error) {
			failed++;
			logger.logError("Scheduled holdings sync failed for item", error, {
				feature: "plaid",
				operation: "scheduledHoldingsSync",
				userId: item.userId,
				itemId: item.id,
			});
		}
	}

	return { processed, skipped, failed };
}

export async function hasPendingSyncJob(input: {
	connectionId: string;
	syncType: SyncType;
}): Promise<boolean> {
	const pending = await db.providerSyncJob.findFirst({
		where: {
			connectionId: input.connectionId,
			syncType: input.syncType,
			status: { in: ["PENDING", "RUNNING"] },
		},
		select: { id: true },
	});
	return pending !== null;
}

export async function runScheduledTransactionFallback(): Promise<{
	processed: number;
	skipped: number;
	failed: number;
}> {
	const staleThreshold = new Date(Date.now() - SCHEDULED_TRANSACTION_STALE_MS);
	const connections = await db.financialConnection.findMany({
		where: {
			status: { in: ["ACTIVE", "DEGRADED"] },
			OR: [
				{ lastTransactionSyncAt: null },
				{ lastTransactionSyncAt: { lt: staleThreshold } },
			],
		},
		select: { id: true, userId: true },
		take: 200,
	});

	let processed = 0;
	let skipped = 0;
	let failed = 0;

	for (const connection of connections) {
		if (
			await hasPendingSyncJob({
				connectionId: connection.id,
				syncType: "transactions",
			})
		) {
			skipped++;
			continue;
		}

		try {
			await runConnectionSyncJob({
				connectionId: connection.id,
				userId: connection.userId,
				syncType: "transactions",
				trigger: "SCHEDULED",
				reason: "scheduled_transaction_fallback",
				skipRateLimit: true,
			});
			processed++;
		} catch (error) {
			failed++;
			logger.logError(
				"Scheduled transaction fallback failed for connection",
				error,
				{
					feature: "plaid",
					operation: "scheduledTransactionFallback",
					userId: connection.userId,
					connectionId: connection.id,
				},
			);
		}
	}

	return { processed, skipped, failed };
}
