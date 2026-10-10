import { AsyncLocalStorage } from "node:async_hooks";
import { logger } from "~/lib/logger";
import { resolveInternalApiOrigin } from "./internal-api-origin";

type DeferredKickStore = {
	jobIds: Set<string>;
};

/**
 * Collects job IDs while an interactive database-actor transaction is open.
 * Kicks must not fire until after commit — otherwise the worker cannot see the row.
 */
export const deferredProviderSyncJobKickStore =
	new AsyncLocalStorage<DeferredKickStore>();

export function createDeferredProviderSyncJobKickStore(): DeferredKickStore {
	return { jobIds: new Set() };
}

/**
 * Fire-and-forget HTTP kick so a pending job starts in a fresh invocation
 * (new duration budget) instead of waiting for the daily Hobby cron.
 */
export function kickProviderSyncJob(jobId: string): void {
	if (process.env.MOAT_E2E === "1") {
		logger.warn("provider_sync_job_kick_skipped_e2e", {
			feature: "financial_connections",
			operation: "kickProviderSyncJob",
			jobId,
		});
		return;
	}

	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret) {
		logger.warn("provider_sync_job_kick_skipped_missing_secret", {
			feature: "financial_connections",
			operation: "kickProviderSyncJob",
			jobId,
		});
		return;
	}

	const url = `${resolveInternalApiOrigin()}/api/cron/process-provider-sync-jobs`;

	void fetch(url, {
		method: "POST",
		headers: {
			Authorization: `Bearer ${cronSecret}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({ jobId }),
	}).catch((error: unknown) => {
		logger.warn("provider_sync_job_kick_failed", {
			feature: "financial_connections",
			operation: "kickProviderSyncJob",
			jobId,
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
	});
}

/**
 * Defer the kick while an actor TX is open; otherwise kick immediately
 * (session-scoped service clients / no interactive TX).
 */
export function scheduleProviderSyncJobKick(jobId: string): void {
	const deferred = deferredProviderSyncJobKickStore.getStore();
	if (deferred) {
		deferred.jobIds.add(jobId);
		return;
	}
	kickProviderSyncJob(jobId);
}

export function flushDeferredProviderSyncJobKicks(
	store: DeferredKickStore,
): void {
	for (const jobId of store.jobIds) {
		kickProviderSyncJob(jobId);
	}
	store.jobIds.clear();
}
