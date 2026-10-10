import type { SyncTrigger } from "@moat/financial-data-providers";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { decrypt } from "~/server/lib/encryption";
import {
	isPlaidItemAccessLive,
	livePlaidAccessToken,
} from "~/server/plaid/access-state";
import {
	getPlaidErrorDetails,
	isPlaidInvestmentsProductUnavailable,
} from "~/server/plaid/errors";
import { shouldSyncPlaidInvestmentsHoldings } from "~/server/plaid/item-capabilities";
import { persistPlaidItemProductCapabilities } from "~/server/plaid/persist-item-capabilities";
import { syncHoldingsForItem } from "~/server/plaid/syncHoldings";
import { syncRealtimeBalancesForItem } from "~/server/plaid/syncRealtimeBalances";
import { recordSyncedAccountHistory } from "./account-balance-history.service";
import { takeSnapshot } from "./balance-snapshot.service";
import { ensureFinancialConnectionForPlaidItem } from "./financial-connections.service";
import {
	runManualCachedSyncForPlaidItem,
	syncCachedBalancesForPlaidItem,
	syncTransactionsForPlaidItem,
} from "./plaid-connection-sync.service";
import { syncMxOrFinicityConnection } from "./provider-adapter-sync.service";
import {
	beginProviderSyncAttempt,
	completeProviderSyncAttempt,
} from "./provider-sync-attempt.service";
import { assertRealtimeBalanceRateLimit } from "./sync-realtime-rate-limit.service";
import type {
	ConnectionSyncResult,
	ProviderEndpointCall,
	SyncReason,
	SyncType,
} from "./sync-types";

export async function runConnectionSyncJob(input: {
	connectionId: string;
	userId: string;
	syncType: SyncType;
	syncMode?: "cached" | "realtime";
	trigger: SyncTrigger;
	reason: SyncReason;
	webhookEventId?: string;
	skipRateLimit?: boolean;
}): Promise<ConnectionSyncResult | undefined> {
	const connection = await db.financialConnection.findFirst({
		where: { id: input.connectionId, userId: input.userId },
	});
	if (!connection || connection.status === "DISCONNECTED") return undefined;

	if (connection.provider === "PLAID") {
		const plaidItem = await resolvePlaidItemForConnection(connection);
		if (
			!plaidItem ||
			plaidItem.requiresReconnect ||
			!isPlaidItemAccessLive(plaidItem)
		) {
			return undefined;
		}

		switch (input.syncType) {
			case "transactions": {
				const txResult = await syncTransactionsForPlaidItem({
					plaidItemDbId: plaidItem.id,
					userId: input.userId,
					trigger: input.trigger,
					reason: input.reason,
					refreshBalances: false,
					webhookEventId: input.webhookEventId,
					skipRateLimit: input.skipRateLimit,
				});
				if (!txResult) return undefined;
				return {
					success: true,
					addedCount: txResult.addedCount,
					modifiedCount: txResult.modifiedCount,
					removedCount: txResult.removedCount,
					accountCount: 0,
					balancesRefreshed: false,
					holdingsSynced: false,
				};
			}
			case "cached_balances": {
				const balanceResult = await syncCachedBalancesForPlaidItem({
					plaidItemDbId: plaidItem.id,
					userId: input.userId,
					trigger: input.trigger,
					reason: input.reason,
					webhookEventId: input.webhookEventId,
					skipRateLimit: input.skipRateLimit,
				});
				return {
					success: true,
					addedCount: 0,
					modifiedCount: 0,
					removedCount: 0,
					accountCount: balanceResult.accountCount,
					balancesRefreshed: !balanceResult.skipped,
					holdingsSynced: false,
				};
			}
			case "cached_manual": {
				const manualResult = await runManualCachedSyncForPlaidItem({
					itemId: plaidItem.id,
					userId: input.userId,
					reason: input.reason,
					skipRateLimit: input.skipRateLimit,
				});
				const holdingsSynced = await syncPlaidHoldings({
					plaidItemDbId: plaidItem.id,
					userId: input.userId,
					trigger: input.trigger,
					reason: input.reason,
					webhookEventId: input.webhookEventId,
				});
				return {
					success: true,
					addedCount: manualResult.addedCount,
					modifiedCount: manualResult.modifiedCount,
					removedCount: manualResult.removedCount,
					accountCount: manualResult.accountCount,
					balancesRefreshed: manualResult.balancesRefreshed,
					holdingsSynced,
				};
			}
			case "realtime_balances":
				await syncPlaidRealtimeBalances({
					plaidItemDbId: plaidItem.id,
					userId: input.userId,
					trigger: input.trigger,
					reason: input.reason,
					webhookEventId: input.webhookEventId,
					skipRateLimit: input.skipRateLimit,
				});
				return {
					success: true,
					addedCount: 0,
					modifiedCount: 0,
					removedCount: 0,
					accountCount: 0,
					balancesRefreshed: true,
					holdingsSynced: false,
				};
			case "holdings": {
				const holdingsSynced = await syncPlaidHoldings({
					plaidItemDbId: plaidItem.id,
					userId: input.userId,
					trigger: input.trigger,
					reason: input.reason,
					webhookEventId: input.webhookEventId,
				});
				return {
					success: true,
					addedCount: 0,
					modifiedCount: 0,
					removedCount: 0,
					accountCount: 0,
					balancesRefreshed: false,
					holdingsSynced,
				};
			}
		}
	}

	const adapterResult = await syncMxOrFinicityConnection({
		connectionId: connection.id,
		userId: input.userId,
		syncType: input.syncType,
		trigger: input.trigger,
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});
	if (adapterResult.skipped) return undefined;
	return {
		success: true,
		addedCount: 0,
		modifiedCount: 0,
		removedCount: 0,
		accountCount: 0,
		balancesRefreshed: input.syncType === "cached_balances",
		holdingsSynced: false,
	};
}

async function resolvePlaidItemForConnection(connection: {
	providerConnectionId: string;
	metadata: unknown;
}) {
	const metadata =
		typeof connection.metadata === "object" && connection.metadata !== null
			? (connection.metadata as Record<string, unknown>)
			: {};
	const legacyId =
		typeof metadata.legacyPlaidItemDbId === "string"
			? metadata.legacyPlaidItemDbId
			: null;
	if (legacyId) {
		return db.plaidItem.findUnique({
			where: { id: legacyId },
			select: {
				id: true,
				accessTokenEncrypted: true,
				accessRevokedAt: true,
				requiresReconnect: true,
			},
		});
	}
	return db.plaidItem.findUnique({
		where: { plaidItemId: connection.providerConnectionId },
		select: {
			id: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			requiresReconnect: true,
		},
	});
}

async function syncPlaidRealtimeBalances(input: {
	plaidItemDbId: string;
	userId: string;
	trigger: SyncTrigger;
	reason: SyncReason;
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
	if (!item || item.requiresReconnect || !accessTokenEncrypted) return;

	const { connectionId } = await ensureFinancialConnectionForPlaidItem({
		plaidItemDbId: item.id,
	});

	if (!input.skipRateLimit) {
		await assertRealtimeBalanceRateLimit({
			userId: input.userId,
			connectionId,
		});
	}

	const callLog: ProviderEndpointCall[] = [];
	const attempt = await beginProviderSyncAttempt({
		connectionId,
		provider: "PLAID",
		trigger: input.trigger,
		userId: input.userId,
		syncType: "realtime_balances",
		syncMode: "realtime",
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});

	try {
		const accessToken = decrypt(accessTokenEncrypted);
		const result = await syncRealtimeBalancesForItem({
			db,
			userId: input.userId,
			plaidItemDbId: item.id,
			accessToken,
			callLog,
		});
		await ensureFinancialConnectionForPlaidItem({ plaidItemDbId: item.id });
		await db.financialConnection.update({
			where: { id: connectionId },
			data: {
				lastBalanceSyncAt: new Date(),
				lastRealtimeBalanceSyncAt: new Date(),
			},
		});
		try {
			await takeSnapshot(input.userId, db);
		} catch (error) {
			logger.logError("Snapshot failed after realtime balance sync", error, {
				feature: "plaid",
				operation: "syncPlaidRealtimeBalances",
				userId: input.userId,
				itemId: item.id,
			});
		}
		try {
			await recordSyncedAccountHistory(input.userId, db);
		} catch (error) {
			logger.logError(
				"Account history failed after realtime balance sync",
				error,
				{
					feature: "account-balance-history",
					operation: "syncPlaidRealtimeBalances",
					userId: input.userId,
					itemId: item.id,
				},
			);
		}
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "SUCCESS",
			endpointsCalled: callLog,
			accountCount: result.accountCount,
			providerRequestCount: callLog.length,
		});
	} catch (error) {
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "FAILED",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
			errorMessage:
				error instanceof Error ? error.message : "Realtime balance sync failed",
		});
		throw error;
	}
}

async function syncPlaidHoldings(input: {
	plaidItemDbId: string;
	userId: string;
	trigger: SyncTrigger;
	reason: SyncReason;
	webhookEventId?: string;
}): Promise<boolean> {
	const item = await db.plaidItem.findFirst({
		where: { id: input.plaidItemDbId, userId: input.userId },
		select: {
			id: true,
			accessTokenEncrypted: true,
			accessRevokedAt: true,
			requiresReconnect: true,
			billedProducts: true,
			availableProducts: true,
			consentedProducts: true,
		},
	});
	const accessTokenEncrypted = item ? livePlaidAccessToken(item) : null;
	if (!item || item.requiresReconnect || !accessTokenEncrypted) return false;

	if (!shouldSyncPlaidInvestmentsHoldings(item)) {
		logger.info(
			"Skipping Plaid holdings sync — Investments not consented or billed on item",
			{
				feature: "plaid",
				operation: "syncPlaidHoldings",
				userId: input.userId,
				itemId: item.id,
				billedProducts: item.billedProducts,
				availableProducts: item.availableProducts,
				consentedProducts: item.consentedProducts,
			},
		);
		return false;
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
		syncType: "holdings",
		syncMode: "cached",
		reason: input.reason,
		webhookEventId: input.webhookEventId,
	});

	try {
		const accessToken = decrypt(accessTokenEncrypted);
		const result = await syncHoldingsForItem({
			db,
			userId: input.userId,
			plaidItemDbId: item.id,
			accessToken,
			callLog,
		});
		await persistPlaidItemProductCapabilities({
			plaidItemDbId: item.id,
			accessToken,
		});
		await ensureFinancialConnectionForPlaidItem({ plaidItemDbId: item.id });
		await db.financialConnection.update({
			where: { id: connectionId },
			data: { lastHoldingsSyncAt: new Date() },
		});
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "SUCCESS",
			endpointsCalled: callLog,
			holdingCount: result.holdingCount,
			accountCount: result.accountCount,
			providerRequestCount: callLog.length,
		});
		return true;
	} catch (error) {
		if (isPlaidInvestmentsProductUnavailable(error)) {
			const { code } = getPlaidErrorDetails(error);
			const accessToken = decrypt(accessTokenEncrypted);
			await persistPlaidItemProductCapabilities({
				plaidItemDbId: item.id,
				accessToken,
			});
			logger.warn(
				"Skipping Plaid holdings sync — Investments product not available on item",
				{
					feature: "plaid",
					operation: "syncPlaidHoldings",
					userId: input.userId,
					itemId: item.id,
					errorCode: code ?? undefined,
				},
			);
			await completeProviderSyncAttempt({
				attemptId: attempt.id,
				status: "SKIPPED",
				endpointsCalled: callLog,
				providerRequestCount: callLog.length,
				errorCode: code,
				errorMessage: "Investments product not available on item",
			});
			return false;
		}
		await completeProviderSyncAttempt({
			attemptId: attempt.id,
			status: "FAILED",
			endpointsCalled: callLog,
			providerRequestCount: callLog.length,
			errorMessage:
				error instanceof Error ? error.message : "Holdings sync failed",
		});
		throw error;
	}
}
