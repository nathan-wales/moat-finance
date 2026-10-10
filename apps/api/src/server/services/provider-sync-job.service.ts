import type {
	FinancialDataProvider,
	SyncTrigger,
} from "@moat/financial-data-providers";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { runAsElevatedServiceActor } from "~/server/db-actor";
import { scheduleProviderSyncJobKick } from "~/server/lib/provider-sync-job-kick";
import { runConnectionSyncJob } from "./connection-sync-orchestrator.service";
import {
	decideExistingProviderSyncJobAction,
	isStaleRunningProviderSyncJob,
} from "./provider-sync-job-enqueue";
import type { SyncReason, SyncType } from "./sync-types";

const MAX_JOBS_PER_RUN = 25;

/**
 * ProviderSyncJob is service-only under FORCE RLS. User-actor callers
 * (app-open sync) must elevate; webhook/cron paths are already service.
 */
export async function enqueueProviderSyncJob(input: {
	userId: string;
	connectionId: string;
	provider: FinancialDataProvider;
	syncType: SyncType;
	syncMode?: "cached" | "realtime";
	trigger: SyncTrigger;
	reason: SyncReason;
	webhookEventId?: string;
	scheduledAt?: Date;
}): Promise<{ id: string }> {
	const job = await runAsElevatedServiceActor(async () => {
		const existingForEvent = input.webhookEventId
			? await db.providerSyncJob.findFirst({
					where: {
						webhookEventId: input.webhookEventId,
						status: { in: ["PENDING", "RUNNING"] },
					},
					select: { id: true },
				})
			: null;
		if (existingForEvent) return existingForEvent;

		const existingPending = await db.providerSyncJob.findFirst({
			where: {
				connectionId: input.connectionId,
				syncType: input.syncType,
				status: "PENDING",
			},
			orderBy: { scheduledAt: "asc" },
			select: { id: true, status: true, scheduledAt: true, startedAt: true },
		});
		const existingRunning = existingPending
			? null
			: await db.providerSyncJob.findFirst({
					where: {
						connectionId: input.connectionId,
						syncType: input.syncType,
						status: "RUNNING",
					},
					orderBy: { scheduledAt: "asc" },
					select: {
						id: true,
						status: true,
						scheduledAt: true,
						startedAt: true,
					},
				});
		const existingForConnection = existingPending ?? existingRunning;
		if (existingForConnection) {
			const decision = decideExistingProviderSyncJobAction(
				existingForConnection,
			);
			if (decision.action === "reuse") {
				if (decision.bumpScheduledAt || decision.reclaimStale) {
					await db.providerSyncJob.update({
						where: { id: existingForConnection.id },
						data: {
							scheduledAt: new Date(),
							...(decision.reclaimStale ? { status: "PENDING" } : {}),
						},
					});
				}
				if (decision.reclaimStale) {
					logger.warn("Reclaimed stale RUNNING provider sync job", {
						feature: "financial_connections",
						operation: "enqueueProviderSyncJob",
						jobId: existingForConnection.id,
						syncType: input.syncType,
					});
				}
				return { id: existingForConnection.id };
			}
		}

		return db.providerSyncJob.create({
			data: {
				userId: input.userId,
				connectionId: input.connectionId,
				provider: input.provider,
				webhookEventId: input.webhookEventId,
				syncType: input.syncType,
				syncMode: input.syncMode ?? "cached",
				trigger: input.trigger,
				reason: input.reason,
				scheduledAt: input.scheduledAt ?? new Date(),
			},
			select: { id: true },
		});
	});

	scheduleProviderSyncJobKick(job.id);
	return job;
}

export type ProcessProviderSyncJobResult =
	| { outcome: "processed" }
	| { outcome: "failed" }
	| { outcome: "skipped" }
	| { outcome: "not_found" };

type ProcessJobDb = {
	providerSyncJob: {
		findFirst: (args: { where: { id: string } }) => Promise<{
			id: string;
			userId: string;
			connectionId: string;
			webhookEventId: string | null;
			syncType: string;
			syncMode: string | null;
			trigger: SyncTrigger;
			reason: string | null;
			status: string;
			attempts: number;
			maxAttempts: number;
			scheduledAt: Date;
			startedAt: Date | null;
		} | null>;
		updateMany: (args: {
			where: { id: string; status: "PENDING" };
			data: {
				status: "RUNNING";
				startedAt: Date;
				attempts: { increment: number };
			};
		}) => Promise<{ count: number }>;
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
	};
	providerWebhookEvent: {
		update: (args: {
			where: { id: string };
			data: Record<string, unknown>;
		}) => Promise<unknown>;
	};
};

/**
 * Claims and runs a single PENDING job. Safe under concurrent kicks —
 * a lost claim race returns `skipped`.
 */
export async function processProviderSyncJobById(
	jobId: string,
	options?: {
		db?: ProcessJobDb;
		runSync?: typeof runConnectionSyncJob;
	},
): Promise<ProcessProviderSyncJobResult> {
	const dbClient = options?.db ?? db;
	const runSync = options?.runSync ?? runConnectionSyncJob;

	const job = await dbClient.providerSyncJob.findFirst({
		where: { id: jobId },
	});
	if (!job) return { outcome: "not_found" };
	if (isStaleRunningProviderSyncJob(job)) {
		await dbClient.providerSyncJob.update({
			where: { id: job.id },
			data: { status: "PENDING", scheduledAt: new Date() },
		});
		logger.warn("Reclaimed stale RUNNING provider sync job", {
			feature: "financial_connections",
			operation: "processProviderSyncJobById",
			jobId: job.id,
			syncType: job.syncType,
		});
	} else if (job.status !== "PENDING") {
		return { outcome: "skipped" };
	}
	if (job.scheduledAt > new Date()) {
		return { outcome: "skipped" };
	}

	const claimed = await dbClient.providerSyncJob.updateMany({
		where: { id: job.id, status: "PENDING" },
		data: {
			status: "RUNNING",
			startedAt: new Date(),
			attempts: { increment: 1 },
		},
	});
	if (claimed.count === 0) {
		return { outcome: "skipped" };
	}

	try {
		await runSync({
			connectionId: job.connectionId,
			userId: job.userId,
			syncType: job.syncType as SyncType,
			syncMode: (job.syncMode as "cached" | "realtime" | null) ?? "cached",
			trigger: job.trigger,
			reason: (job.reason as SyncReason | null) ?? "provider_webhook",
			webhookEventId: job.webhookEventId ?? undefined,
			skipRateLimit: true,
		});

		await dbClient.providerSyncJob.update({
			where: { id: job.id },
			data: { status: "SUCCESS", completedAt: new Date() },
		});

		if (job.webhookEventId) {
			await dbClient.providerWebhookEvent.update({
				where: { id: job.webhookEventId },
				data: { status: "PROCESSED", processedAt: new Date() },
			});
		}

		return { outcome: "processed" };
	} catch (error) {
		const attempts = job.attempts + 1;
		const shouldRetry = attempts < job.maxAttempts;
		await dbClient.providerSyncJob.update({
			where: { id: job.id },
			data: {
				status: shouldRetry ? "PENDING" : "FAILED",
				completedAt: shouldRetry ? null : new Date(),
				scheduledAt: shouldRetry
					? new Date(Date.now() + attempts * 60_000)
					: undefined,
				errorMessage:
					error instanceof Error ? error.message : "Sync job failed",
			},
		});

		if (!shouldRetry) {
			if (job.webhookEventId) {
				await dbClient.providerWebhookEvent.update({
					where: { id: job.webhookEventId },
					data: {
						status: "FAILED",
						processedAt: new Date(),
						errorMessage:
							error instanceof Error ? error.message : "Sync job failed",
					},
				});
			}
			logger.logError("Provider sync job failed", error, {
				feature: "financial_connections",
				operation: "processProviderSyncJobById",
				jobId: job.id,
				connectionId: job.connectionId,
				syncType: job.syncType,
			});
			return { outcome: "failed" };
		}

		return { outcome: "skipped" };
	}
}

export async function processProviderSyncJobs(): Promise<{
	processed: number;
	failed: number;
	skipped: number;
}> {
	const jobs = await db.providerSyncJob.findMany({
		where: {
			status: "PENDING",
			scheduledAt: { lte: new Date() },
		},
		orderBy: { scheduledAt: "asc" },
		take: MAX_JOBS_PER_RUN,
		select: { id: true },
	});

	let processed = 0;
	let failed = 0;
	let skipped = 0;

	for (const job of jobs) {
		const result = await processProviderSyncJobById(job.id);
		if (result.outcome === "processed") processed++;
		else if (result.outcome === "failed") failed++;
		else skipped++;
	}

	return { processed, failed, skipped };
}
