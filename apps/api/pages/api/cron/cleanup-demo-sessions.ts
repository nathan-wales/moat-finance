import type { NextApiRequest, NextApiResponse } from "next";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import { cleanupExpiredDemoSessions } from "~/server/services/demo/demo-session.service";

/**
 * Cron endpoint to clean up expired DemoOverlaySession records.
 * Call this from a cron job (e.g., Vercel Cron, an external scheduler) at a regular interval.
 *
 * Secure with a CRON_SECRET env variable to prevent unauthorized access.
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
				const deleted = await cleanupExpiredDemoSessions();
				return res.status(200).json({ success: true, deletedCount: deleted });
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		console.error("[cron] cleanup-demo-sessions failed:", error);
		return res.status(500).json({ error: "Internal server error" });
	}
}
