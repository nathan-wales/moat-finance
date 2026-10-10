import { createApiError } from "~/server/api-context";
import { db } from "~/server/db";
import { runAsElevatedServiceActor } from "~/server/db-actor";

const REALTIME_PER_CONNECTION_MS = 6 * 60 * 60 * 1000;
const REALTIME_PER_USER_DAY_MS = 24 * 60 * 60 * 1000;
const REALTIME_PER_USER_DAY_MAX = 3;

export type RealtimeBalanceQuota = {
	enabled: boolean;
	remainingToday: number;
	dailyLimit: number;
	nextAvailableAt: string | null;
};

export async function getRealtimeBalanceQuota(input: {
	userId: string;
	connectionId: string;
	enabled: boolean;
}): Promise<RealtimeBalanceQuota> {
	if (!input.enabled) {
		return {
			enabled: false,
			remainingToday: 0,
			dailyLimit: REALTIME_PER_USER_DAY_MAX,
			nextAvailableAt: null,
		};
	}

	return runAsElevatedServiceActor(async () => {
		const dayWindowStart = new Date(Date.now() - REALTIME_PER_USER_DAY_MS);
		const usedToday = await db.providerSyncAttempt.count({
			where: {
				userId: input.userId,
				syncType: "realtime_balances",
				status: { in: ["SUCCESS", "RUNNING", "PENDING"] },
				createdAt: { gte: dayWindowStart },
			},
		});

		const connectionWindowStart = new Date(
			Date.now() - REALTIME_PER_CONNECTION_MS,
		);
		const recentConnection = await db.providerSyncAttempt.findFirst({
			where: {
				connectionId: input.connectionId,
				syncType: "realtime_balances",
				status: { in: ["SUCCESS", "RUNNING", "PENDING"] },
				createdAt: { gte: connectionWindowStart },
			},
			orderBy: { createdAt: "desc" },
			select: { createdAt: true },
		});

		let nextAvailableAt: string | null = null;
		if (recentConnection) {
			nextAvailableAt = new Date(
				recentConnection.createdAt.getTime() + REALTIME_PER_CONNECTION_MS,
			).toISOString();
		}

		return {
			enabled: true,
			remainingToday: Math.max(0, REALTIME_PER_USER_DAY_MAX - usedToday),
			dailyLimit: REALTIME_PER_USER_DAY_MAX,
			nextAvailableAt,
		};
	});
}

export async function assertRealtimeBalanceRateLimit(input: {
	userId: string;
	connectionId: string;
}): Promise<void> {
	return runAsElevatedServiceActor(async () => {
		const dayWindowStart = new Date(Date.now() - REALTIME_PER_USER_DAY_MS);
		const usedToday = await db.providerSyncAttempt.count({
			where: {
				userId: input.userId,
				syncType: "realtime_balances",
				status: { in: ["SUCCESS", "RUNNING", "PENDING"] },
				createdAt: { gte: dayWindowStart },
			},
		});
		if (usedToday >= REALTIME_PER_USER_DAY_MAX) {
			throw createApiError(
				"Daily real-time balance refresh limit reached. Try again tomorrow.",
				429,
			);
		}

		const connectionWindowStart = new Date(
			Date.now() - REALTIME_PER_CONNECTION_MS,
		);
		const recentConnection = await db.providerSyncAttempt.findFirst({
			where: {
				connectionId: input.connectionId,
				syncType: "realtime_balances",
				status: { in: ["SUCCESS", "RUNNING", "PENDING"] },
				createdAt: { gte: connectionWindowStart },
			},
			orderBy: { createdAt: "desc" },
		});
		if (recentConnection) {
			const retryAfterSeconds = Math.ceil(
				(REALTIME_PER_CONNECTION_MS -
					(Date.now() - recentConnection.createdAt.getTime())) /
					1000,
			);
			throw createApiError(
				`Real-time balance refresh limit reached for this institution. Try again in ${Math.max(retryAfterSeconds, 60)} seconds.`,
				429,
			);
		}
	});
}
