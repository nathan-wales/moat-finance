/**
 * Plaid sync orchestration — backward-compatible facade.
 *
 * This module re-exports the same function signatures as before so that the
 * existing router and any other callers continue to work without changes.
 */
import { logger } from "~/lib/logger";
import { db } from "../db";
import {
	disconnectItem,
	exchangePublicTokenForItem,
	runReconnectForItem,
	runSyncForItem,
} from "../plaid/service";
import { syncFinancialConnectionJob } from "./financial-sync.service";
import {
	beginProviderSyncAttempt,
	completeProviderSyncAttempt,
} from "./provider-sync-attempt.service";

export {
	disconnectItem,
	runReconnectForItem as reconnectItem,
	runSyncForItem as syncItem,
};

// ─── ConnectItemParams / Result types (kept for callers) ─────────────────────

export interface ConnectItemParams {
	userId: string;
	publicToken: string;
	metadata?: { institution?: { name?: string; institution_id?: string } };
}

export interface ConnectItemResult {
	plaidItemId: string;
	institutionName: string;
	accountCount: number;
	transactionCount: number;
}

/**
 * Wraps exchangePublicTokenForItem to keep the legacy { transactionCount } shape
 * expected by the existing router and component.
 */
export async function connectItem(
	params: ConnectItemParams,
): Promise<ConnectItemResult> {
	const result = await exchangePublicTokenForItem(
		params.userId,
		params.publicToken,
		params.metadata,
	);
	return {
		plaidItemId: result.plaidItemId,
		institutionName: result.institutionName,
		accountCount: result.accountCount,
		transactionCount: result.addedCount,
	};
}

/**
 * Syncs all connected items for a user.
 * Runs sequentially to avoid Plaid rate-limit pressure.
 * Manual "sync all" should refresh balances for all items.
 */
export async function syncAllItemsForUser(userId: string): Promise<void> {
	const connections = await db.financialConnection.findMany({
		where: {
			userId,
			provider: "PLAID",
			status: { in: ["ACTIVE", "DEGRADED"] },
		},
		select: { id: true },
	});

	const firstConnection = await db.financialConnection.findFirst({
		where: { userId, provider: "PLAID", status: { not: "DISCONNECTED" } },
		select: { id: true },
		orderBy: { updatedAt: "desc" },
	});

	let syncAllAttemptId: string | undefined;
	if (firstConnection) {
		const attempt = await beginProviderSyncAttempt({
			connectionId: firstConnection.id,
			provider: "PLAID",
			trigger: "USER_REFRESH",
			userId,
			syncType: "cached_balances",
			syncMode: "cached",
			reason: "manual_sync_all",
		});
		syncAllAttemptId = attempt.id;
	}

	let successCount = 0;
	let failureCount = 0;

	for (const connection of connections) {
		try {
			await syncFinancialConnectionJob({
				connectionId: connection.id,
				syncType: "cached_balances",
				reason: "manual_sync_all",
				trigger: "USER_REFRESH",
				skipRateLimit: true,
			});
			successCount++;
		} catch (err) {
			failureCount++;
			logger.logError("Failed to sync connection during syncAll", err, {
				feature: "plaid",
				operation: "syncAllItems",
				userId,
				connectionId: connection.id,
			});
		}
	}

	if (syncAllAttemptId) {
		await completeProviderSyncAttempt({
			attemptId: syncAllAttemptId,
			status: failureCount > 0 && successCount === 0 ? "FAILED" : "SUCCESS",
			accountCount: successCount,
			metadata: {
				successCount,
				failureCount,
				connectionCount: connections.length,
			},
		});
	}
}
