import type { SyncTrigger } from "@moat/financial-data-providers";
import { db } from "~/server/db";
import { runConnectionSyncJob } from "./connection-sync-orchestrator.service";
import type { ConnectionSyncResult, SyncReason, SyncType } from "./sync-types";

export async function syncFinancialConnectionJob(input: {
	connectionId: string;
	trigger: SyncTrigger;
	syncType?: SyncType;
	reason?: SyncReason;
	webhookEventId?: string;
	force?: boolean;
	skipRateLimit?: boolean;
}): Promise<ConnectionSyncResult | undefined> {
	return withFinancialConnectionLock(input.connectionId, async () => {
		const connection = await db.financialConnection.findUnique({
			where: { id: input.connectionId },
			select: { userId: true, status: true },
		});
		if (!connection || connection.status === "DISCONNECTED") return undefined;

		const syncType = input.syncType ?? "transactions";
		return runConnectionSyncJob({
			connectionId: input.connectionId,
			userId: connection.userId,
			syncType,
			syncMode: syncType === "realtime_balances" ? "realtime" : "cached",
			trigger: input.trigger,
			reason: input.reason ?? "provider_webhook",
			webhookEventId: input.webhookEventId,
			skipRateLimit: input.skipRateLimit,
		});
	});
}

async function withFinancialConnectionLock<T>(
	connectionId: string,
	fn: () => Promise<T>,
): Promise<T> {
	const lockKey = deriveAdvisoryLockKey(`financial-connection:${connectionId}`);
	await db.$executeRaw`SELECT pg_advisory_lock(${BigInt(lockKey)})`;
	try {
		return await fn();
	} finally {
		await db.$executeRaw`SELECT pg_advisory_unlock(${BigInt(lockKey)})`.catch(
			() => {},
		);
	}
}

function deriveAdvisoryLockKey(value: string): number {
	let hash = 5381;
	for (let index = 0; index < value.length; index++) {
		hash = ((hash << 5) + hash) ^ (value.charCodeAt(index) ?? 0);
		hash = hash | 0;
	}
	return hash;
}

export async function syncFinancialConnectionForProvider(input: {
	provider: import("@moat/financial-data-providers").FinancialDataProvider;
	providerConnectionId: string;
	trigger: SyncTrigger;
	syncType?: SyncType;
	reason?: SyncReason;
	webhookEventId?: string;
}) {
	const connection = await db.financialConnection.findUnique({
		where: {
			provider_providerConnectionId: {
				provider: input.provider,
				providerConnectionId: input.providerConnectionId,
			},
		},
		select: { id: true },
	});
	if (!connection) return;
	await syncFinancialConnectionJob({
		connectionId: connection.id,
		trigger: input.trigger,
		syncType: input.syncType,
		reason: input.reason,
		webhookEventId: input.webhookEventId,
		skipRateLimit: true,
	});
}
