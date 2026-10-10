import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";

/**
 * Cron endpoint to clean up expired and revoked auth sessions and refresh tokens.
 *
 * Retention policy:
 * - AuthSession: delete if `expiresAt` is in the past, OR if `revokedAt` is >7 days ago.
 * - RefreshToken: delete if `expiresAt` is in the past, OR if `revokedAt` is >7 days ago.
 *   (Cascade-deleted by AuthSession in most cases, but explicit cleanup handles orphaned tokens.)
 *
 * Run daily via Vercel Cron or an external scheduler.
 * Secure with CRON_SECRET.
 */
export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "GET") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	const authHeader = req.headers.authorization;
	const cronSecret = process.env.CRON_SECRET;

	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		return res.status(401).json({ error: "Unauthorized" });
	}

	const now = new Date();
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	try {
		return await withServiceDatabaseActor(
			async () => {
				// Delete expired or old-revoked refresh tokens first (avoids FK issues on some DBs)
				const { count: revokedTokens } = await db.refreshToken.deleteMany({
					where: {
						OR: [
							{ expiresAt: { lt: now } },
							{ revokedAt: { lt: sevenDaysAgo } },
						],
					},
				});

				// Delete expired or old-revoked auth sessions
				const { count: revokedSessions } = await db.authSession.deleteMany({
					where: {
						OR: [
							{ expiresAt: { lt: now } },
							{ revokedAt: { lt: sevenDaysAgo } },
						],
					},
				});

				logger.info("[cron] cleanup-expired-auth-sessions complete", {
					feature: "cron",
					operation: "cleanup-expired-auth-sessions",
					deletedRefreshTokens: revokedTokens,
					deletedAuthSessions: revokedSessions,
				});

				return res.status(200).json({
					success: true,
					deletedAuthSessions: revokedSessions,
					deletedRefreshTokens: revokedTokens,
				});
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] cleanup-expired-auth-sessions failed", {
			feature: "cron",
			operation: "cleanup-expired-auth-sessions",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
