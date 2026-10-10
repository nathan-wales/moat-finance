import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import { createFinancialConnectionLinkSession } from "~/server/services/financial-connections.service";
import { syncFinancialConnectionJob } from "~/server/services/financial-sync.service";
import { isRealtimeBalanceSyncEnabled } from "~/server/services/sync-feature-flags";
import { getRealtimeBalanceQuota } from "~/server/services/sync-realtime-rate-limit.service";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { requireAdminUser } from "../lib/admin-access";

const providerSchema = z.enum(["PLAID", "MX", "FINICITY"]);
const productSchema = z.enum([
	"transactions",
	"investments",
	"liabilities",
	"identity",
]);

const createLinkSessionInput = z.object({
	canonicalInstitutionId: z.string().min(1),
	provider: providerSchema.optional(),
	products: z.array(productSchema).min(1).default(["transactions"]),
});

const syncConnectionInput = z.object({
	connectionId: z.string().min(1),
	trigger: z
		.enum([
			"WEBHOOK",
			"SCHEDULED",
			"USER_REFRESH",
			"INITIAL_LINK",
			"BACKFILL",
			"PROVIDER_SWITCH",
		])
		.default("USER_REFRESH"),
});

const connectionIdInput = z.object({
	connectionId: z.string().min(1),
});

const adminListInput = z.object({
	limit: z.coerce.number().int().min(1).max(250).default(100),
	provider: providerSchema.optional(),
});

const listWebhookEventsInput = adminListInput.extend({
	status: z
		.enum([
			"RECEIVED",
			"VERIFIED",
			"REJECTED",
			"QUEUED",
			"PROCESSED",
			"FAILED",
			"IGNORED_DUPLICATE",
		])
		.optional(),
});

const listSyncAttemptsInput = adminListInput.extend({
	status: z
		.enum([
			"PENDING",
			"RUNNING",
			"SUCCESS",
			"FAILED",
			"PARTIAL_SUCCESS",
			"SKIPPED",
		])
		.optional(),
});

const listConnectionsInput = adminListInput.extend({
	status: z
		.enum([
			"ACTIVE",
			"DEGRADED",
			"REAUTH_REQUIRED",
			"DISCONNECTED",
			"ERROR",
			"MIGRATING",
		])
		.optional(),
});

export const financialConnections = {
	createLinkSession: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = createLinkSessionInput.parse(body);
			try {
				return await createFinancialConnectionLinkSession({
					userId: ctx.userId,
					canonicalInstitutionId: input.canonicalInstitutionId,
					provider: input.provider,
					products: input.products,
				});
			} catch (error) {
				logger.logError(
					"Failed to create financial connection link session",
					error,
					{
						feature: "financial_connections",
						operation: "createLinkSession",
						userId: ctx.userId,
					},
				);
				throw new Error(
					error instanceof Error
						? error.message
						: "Failed to start connection flow",
				);
			}
		},
	),

	syncConnection: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = syncConnectionInput.parse(body);
		const connection = await ctx.db.financialConnection.findFirst({
			where: { id: input.connectionId, userId: ctx.userId },
			select: { id: true },
		});
		if (!connection) throw new Error("Connection not found");
		try {
			const result = await syncFinancialConnectionJob({
				connectionId: input.connectionId,
				syncType: "cached_manual",
				reason: "manual_sync_button",
				trigger: input.trigger,
			});
			return (
				result ?? {
					success: true,
					addedCount: 0,
					modifiedCount: 0,
					removedCount: 0,
					accountCount: 0,
					balancesRefreshed: false,
					holdingsSynced: false,
				}
			);
		} catch (error) {
			if (isApiErrorWithStatus(error, 429)) throw error;
			throw error;
		}
	}),

	refreshRealtimeBalance: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = connectionIdInput.parse(body);
			if (!isRealtimeBalanceSyncEnabled(ctx.userId)) {
				throw createApiError(
					"Real-time balance refresh is not enabled for this account.",
					403,
				);
			}
			const connection = await ctx.db.financialConnection.findFirst({
				where: {
					id: input.connectionId,
					userId: ctx.userId,
					provider: "PLAID",
				},
				select: { id: true },
			});
			if (!connection) throw new Error("Plaid connection not found");
			try {
				await syncFinancialConnectionJob({
					connectionId: connection.id,
					syncType: "realtime_balances",
					reason: "manual_realtime_balance_refresh",
					trigger: "USER_REFRESH",
				});
				return { success: true };
			} catch (error) {
				if (isApiErrorWithStatus(error, 429)) throw error;
				throw error;
			}
		},
	),

	getRealtimeBalanceQuota: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = connectionIdInput.parse(body);
			const connection = await ctx.db.financialConnection.findFirst({
				where: { id: input.connectionId, userId: ctx.userId },
				select: { id: true },
			});
			if (!connection) throw new Error("Connection not found");
			return getRealtimeBalanceQuota({
				userId: ctx.userId,
				connectionId: connection.id,
				enabled: isRealtimeBalanceSyncEnabled(ctx.userId),
			});
		},
	),

	listWebhookEvents: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdminUser(ctx.db, ctx.actorUserId);
			const input = listWebhookEventsInput.parse(body ?? {});
			return ctx.db.providerWebhookEvent.findMany({
				where: {
					provider: input.provider,
					status: input.status,
				},
				orderBy: { receivedAt: "desc" },
				take: input.limit,
			});
		},
	),

	listSyncAttempts: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdminUser(ctx.db, ctx.actorUserId);
			const input = listSyncAttemptsInput.parse(body ?? {});
			return ctx.db.providerSyncAttempt.findMany({
				where: {
					provider: input.provider,
					status: input.status,
				},
				orderBy: { startedAt: "desc" },
				take: input.limit,
			});
		},
	),

	listConnections: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			await requireAdminUser(ctx.db, ctx.actorUserId);
			const input = listConnectionsInput.parse(body ?? {});
			return ctx.db.financialConnection.findMany({
				where: {
					provider: input.provider,
					status: input.status,
				},
				orderBy: { updatedAt: "desc" },
				take: input.limit,
				include: {
					accounts: true,
					canonicalInstitution: true,
				},
			});
		},
	),
};

function isApiErrorWithStatus(error: unknown, status: number): boolean {
	return (
		error instanceof Error &&
		"status" in error &&
		(error as Error & { status: number }).status === status
	);
}
