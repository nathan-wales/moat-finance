import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";

/**
 * Cron endpoint to clean up expired TwoFactorToken records.
 *
 * TwoFactorTokens are TOTP replay-prevention tokens. Each is valid for
 * one TOTP window (≤60s). Anything past `expires` is safe to delete.
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

	try {
		return await withServiceDatabaseActor(
			async () => {
				const { count } = await db.twoFactorToken.deleteMany({
					where: {
						expires: { lt: new Date() },
					},
				});

				logger.info("[cron] cleanup-expired-2fa-tokens complete", {
					feature: "cron",
					operation: "cleanup-expired-2fa-tokens",
					deletedCount: count,
				});

				return res.status(200).json({ success: true, deletedCount: count });
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] cleanup-expired-2fa-tokens failed", {
			feature: "cron",
			operation: "cleanup-expired-2fa-tokens",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
