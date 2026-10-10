import type {
	FinancialDataProvider,
	SyncTrigger,
} from "@moat/financial-data-providers";
import { db } from "~/server/db";
import { runAsElevatedServiceActor } from "~/server/db-actor";
import type {
	ProviderEndpointCall,
	SyncMode,
	SyncReason,
	SyncType,
} from "./sync-types";
import { highestCostCategory } from "./sync-types";

/**
 * ProviderSyncAttempt is fully service-only under FORCE RLS. Manual sync and
 * rate-limit paths run as user actors, so all access elevates for the write
 * (or read) and restores immediately after.
 */
export async function beginProviderSyncAttempt(input: {
	connectionId: string;
	provider: FinancialDataProvider;
	trigger: SyncTrigger;
	userId?: string;
	syncType: SyncType;
	syncMode?: SyncMode;
	reason?: SyncReason;
	webhookEventId?: string;
}) {
	return runAsElevatedServiceActor(() =>
		db.providerSyncAttempt.create({
			data: {
				connectionId: input.connectionId,
				provider: input.provider,
				trigger: input.trigger,
				webhookEventId: input.webhookEventId,
				userId: input.userId,
				syncType: input.syncType,
				syncMode: input.syncMode,
				reason: input.reason,
				status: "RUNNING",
				startedAt: new Date(),
			},
			select: { id: true },
		}),
	);
}

export async function completeProviderSyncAttempt(input: {
	attemptId: string;
	status: "SUCCESS" | "FAILED" | "SKIPPED" | "PARTIAL_SUCCESS";
	endpointsCalled?: ProviderEndpointCall[];
	addedCount?: number;
	modifiedCount?: number;
	removedCount?: number;
	accountCount?: number;
	holdingCount?: number;
	providerRequestCount?: number;
	errorCode?: string | null;
	errorMessage?: string | null;
	metadata?: Record<string, unknown>;
}) {
	const estimatedCostCategory = input.endpointsCalled?.length
		? highestCostCategory(input.endpointsCalled)
		: undefined;

	await runAsElevatedServiceActor(() =>
		db.providerSyncAttempt.update({
			where: { id: input.attemptId },
			data: {
				status: input.status,
				completedAt: new Date(),
				endpointsCalled: input.endpointsCalled as never,
				estimatedCostCategory,
				addedCount: input.addedCount,
				modifiedCount: input.modifiedCount,
				removedCount: input.removedCount,
				accountCount: input.accountCount,
				holdingCount: input.holdingCount,
				providerRequestCount: input.providerRequestCount,
				errorCode: input.errorCode ?? undefined,
				errorMessage: input.errorMessage ?? undefined,
				metadata: input.metadata as never,
			},
		}),
	);
}
