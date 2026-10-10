import crypto from "node:crypto";
import { z } from "zod";
import { logger } from "~/lib/logger";
import type { ApiContext } from "../api-context";
import { createApiError } from "../api-context";
import { serviceDatabaseActor, withDatabaseActor } from "../db-actor";
import {
	type AuthenticatedContext,
	withAuth,
	withPublic,
} from "../handler-wrappers";
import { getClientIpAddress } from "../lib/request-client";
import { createAuthSession, generateAccessToken } from "../lib/token-manager";
import { checkIpRateLimit } from "../services/ip-rate-limit.service";

const PAIR_TTL_MS = 10 * 60 * 1000;
const CODE_CHALLENGE_MAX = 128;
const CODE_VERIFIER_MIN = 43;
const CODE_VERIFIER_MAX = 128;
const CLAIM_RATE_LIMIT = 60;
const CLAIM_RATE_WINDOW_MS = 60_000;
const START_RATE_LIMIT = 20;
const START_RATE_WINDOW_MS = 60_000;

const startInput = z.object({
	codeChallenge: z
		.string()
		.min(43)
		.max(CODE_CHALLENGE_MAX)
		.regex(/^[A-Za-z0-9_-]+$/),
	deviceInfo: z.string().max(256).optional(),
});

const completeInput = z.object({
	pairId: z.string().uuid(),
});

const claimInput = z.object({
	pairId: z.string().uuid(),
	codeVerifier: z
		.string()
		.min(CODE_VERIFIER_MIN)
		.max(CODE_VERIFIER_MAX)
		.regex(/^[A-Za-z0-9_-]+$/),
});

function getWebOrigin(): string {
	return (
		process.env.WEB_ORIGIN ??
		process.env.NEXT_PUBLIC_WEB_URL ??
		"http://localhost:3000"
	).replace(/\/$/, "");
}

function assertRateLimitAllowed(
	result: { allowed: boolean; resetAt: Date },
	message: string,
): void {
	if (result.allowed) return;
	const err = createApiError(message, 429) as ReturnType<
		typeof createApiError
	> & {
		retryAfterSeconds?: number;
	};
	err.retryAfterSeconds = Math.max(
		1,
		Math.ceil((result.resetAt.getTime() - Date.now()) / 1000),
	);
	throw err;
}

function sha256Base64Url(value: string): string {
	return crypto.createHash("sha256").update(value).digest("base64url");
}

function timingSafeEqualStrings(a: string, b: string): boolean {
	const aBuf = Buffer.from(a);
	const bBuf = Buffer.from(b);
	if (aBuf.length !== bBuf.length) return false;
	return crypto.timingSafeEqual(aBuf, bBuf);
}

export const desktopAuth = {
	start: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = startInput.parse(body);
		const ipAddress = getClientIpAddress(ctx.req);
		if (ipAddress) {
			assertRateLimitAllowed(
				checkIpRateLimit({
					ipAddress,
					operation: "desktop-auth:start",
					limit: START_RATE_LIMIT,
					windowMs: START_RATE_WINDOW_MS,
				}),
				"Too many desktop auth starts. Try again later.",
			);
		}

		const pairId = crypto.randomUUID();
		const expiresAt = new Date(Date.now() + PAIR_TTL_MS);
		const deviceInfo = input.deviceInfo ?? "moat-desktop-cloud-backup";

		await ctx.db.desktopAuthPair.create({
			data: {
				pairId,
				codeChallenge: input.codeChallenge,
				deviceInfo,
				expiresAt,
			},
		});

		const authorizeUrl = new URL("/auth/desktop", getWebOrigin());
		authorizeUrl.searchParams.set("pair", pairId);

		logger.info("Desktop auth pair started", {
			feature: "desktopAuth",
			operation: "start",
			demoUser: false,
		});

		return {
			pairId,
			expiresAt: expiresAt.toISOString(),
			authorizeUrl: authorizeUrl.toString(),
		};
	}),

	complete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = completeInput.parse(body);
		const actorUserId = ctx.actorUserId;

		return withDatabaseActor(serviceDatabaseActor(), async (serviceDb) => {
			const pair = await serviceDb.desktopAuthPair.findUnique({
				where: { pairId: input.pairId },
			});

			if (!pair) {
				throw createApiError("Desktop auth pair not found", 404);
			}

			if (pair.claimedAt) {
				throw createApiError("Desktop auth pair already claimed", 410);
			}

			if (pair.expiresAt.getTime() <= Date.now()) {
				throw createApiError("Desktop auth pair expired", 410);
			}

			if (pair.userId && pair.userId !== actorUserId) {
				throw createApiError("Desktop auth pair bound to another user", 409);
			}

			if (pair.userId === actorUserId) {
				return { status: "bound" as const };
			}

			await serviceDb.desktopAuthPair.update({
				where: { id: pair.id },
				data: { userId: actorUserId },
			});

			logger.info("Desktop auth pair bound", {
				feature: "desktopAuth",
				operation: "complete",
				userId: actorUserId,
			});

			return { status: "bound" as const };
		});
	}),

	claim: withPublic(async (ctx: ApiContext, body: unknown) => {
		const input = claimInput.parse(body);
		const ipAddress = getClientIpAddress(ctx.req);
		if (ipAddress) {
			assertRateLimitAllowed(
				checkIpRateLimit({
					ipAddress,
					operation: "desktop-auth:claim",
					limit: CLAIM_RATE_LIMIT,
					windowMs: CLAIM_RATE_WINDOW_MS,
				}),
				"Too many desktop auth claim attempts. Try again later.",
			);
		}

		const pair = await ctx.db.desktopAuthPair.findUnique({
			where: { pairId: input.pairId },
		});

		if (!pair) {
			throw createApiError("Desktop auth pair not found", 404);
		}

		if (pair.claimedAt) {
			throw createApiError("Desktop auth pair already claimed", 410);
		}

		if (pair.expiresAt.getTime() <= Date.now()) {
			throw createApiError("Desktop auth pair expired", 410);
		}

		const expectedChallenge = sha256Base64Url(input.codeVerifier);
		if (!timingSafeEqualStrings(expectedChallenge, pair.codeChallenge)) {
			logger.warn("Desktop auth claim verifier mismatch", {
				feature: "desktopAuth",
				operation: "claim",
			});
			throw createApiError("Invalid desktop auth verifier", 401);
		}

		if (!pair.userId) {
			return { status: "pending" as const };
		}

		const user = await ctx.db.user.findUnique({
			where: { id: pair.userId },
			select: { id: true, email: true, name: true },
		});

		if (!user?.email) {
			throw createApiError("User not found", 404);
		}

		const claimed = await ctx.db.desktopAuthPair.updateMany({
			where: {
				id: pair.id,
				claimedAt: null,
				userId: user.id,
			},
			data: { claimedAt: new Date() },
		});

		if (claimed.count === 0) {
			throw createApiError("Desktop auth pair already claimed", 410);
		}

		const { sessionId, refreshToken, expiresAt } = await createAuthSession(
			user.id,
			pair.deviceInfo ?? "moat-desktop-cloud-backup",
			ipAddress,
		);
		const accessToken = generateAccessToken(user.id, user.email, sessionId);

		logger.info("Desktop auth pair claimed", {
			feature: "desktopAuth",
			operation: "claim",
			userId: user.id,
		});

		return {
			status: "ready" as const,
			accessToken,
			refreshToken,
			expiresIn: 3600,
			refreshExpiresIn: Math.floor((expiresAt.getTime() - Date.now()) / 1000),
			tokenType: "Bearer",
			user: {
				id: user.id,
				email: user.email,
				name: user.name,
			},
		};
	}),
};

export type DesktopAuthHandlers = typeof desktopAuth;
