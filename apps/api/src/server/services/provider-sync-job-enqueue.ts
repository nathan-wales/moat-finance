export const STALE_RUNNING_JOB_MS = 3 * 60 * 1000;

export type ExistingProviderSyncJob = {
	id: string;
	status: string;
	scheduledAt: Date;
	startedAt: Date | null;
};

export type ExistingProviderSyncJobDecision =
	| {
			action: "reuse";
			jobId: string;
			bumpScheduledAt: boolean;
			reclaimStale: boolean;
	  }
	| { action: "create_follow_up" };

export function isStaleRunningProviderSyncJob(
	job: {
		status: string;
		startedAt?: Date | null;
	},
	now = new Date(),
): boolean {
	if (job.status !== "RUNNING") return false;
	if (!job.startedAt) return true;
	return now.getTime() - job.startedAt.getTime() >= STALE_RUNNING_JOB_MS;
}

/**
 * A second webhook for the same connection+syncType must not be swallowed by a
 * live RUNNING job. INITIAL_UPDATE often still holds the lock when
 * HISTORICAL_UPDATE arrives; coalescing into that running job skips the
 * historical pages. PENDING jobs are still reused so we never queue more than
 * one follow-up.
 */
export function decideExistingProviderSyncJobAction(
	existing: ExistingProviderSyncJob,
	now = new Date(),
): ExistingProviderSyncJobDecision {
	if (existing.status === "PENDING") {
		return {
			action: "reuse",
			jobId: existing.id,
			bumpScheduledAt: existing.scheduledAt > now,
			reclaimStale: false,
		};
	}
	if (isStaleRunningProviderSyncJob(existing, now)) {
		return {
			action: "reuse",
			jobId: existing.id,
			bumpScheduledAt: true,
			reclaimStale: true,
		};
	}
	return { action: "create_follow_up" };
}
