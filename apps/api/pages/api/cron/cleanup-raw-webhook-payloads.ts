import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";

/**
 * Cron endpoint to clean up raw webhook payloads and stale webhook event records.
 *
 * Retention policy (per data-retention-policy.md):
 * - Raw payloads (`rawPayload`) older than 30 days: cleared (set to `{}`)
 *   to minimize PII/financial data at rest while keeping the event record for audit.
 * - Full `ProviderWebhookEvent` records older than 90 days: deleted entirely.
 *   (90-day window gives time to debug delivery and sync issues.)
 * - FAILED/REJECTED events: deleted after 7 days (they never processed successfully
 *   and carry no audit value after the short window).
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
	const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
	const ninetyDaysAgo = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000);
	const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

	try {
		return await withServiceDatabaseActor(
			async () => {
				// 1. Redact raw payloads older than 30 days
				const { count: redacted } = await db.providerWebhookEvent.updateMany({
					where: {
						receivedAt: { lt: thirtyDaysAgo },
						// Only redact if there's actually a payload worth clearing
						// (rawPayload is non-nullable in schema, so every record qualifies)
					},
					data: {
						rawPayload: {},
					},
				});

				// 2. Delete stale FAILED/REJECTED events after 7 days
				const { count: failedDeleted } =
					await db.providerWebhookEvent.deleteMany({
						where: {
							status: { in: ["FAILED", "REJECTED"] },
							receivedAt: { lt: sevenDaysAgo },
						},
					});

				// 3. Delete all events older than 90 days
				const { count: staleDeleted } =
					await db.providerWebhookEvent.deleteMany({
						where: {
							receivedAt: { lt: ninetyDaysAgo },
						},
					});

				logger.info("[cron] cleanup-raw-webhook-payloads complete", {
					feature: "cron",
					operation: "cleanup-raw-webhook-payloads",
					redactedPayloads: redacted,
					deletedFailedEvents: failedDeleted,
					deletedStaleEvents: staleDeleted,
				});

				return res.status(200).json({
					success: true,
					redactedPayloads: redacted,
					deletedFailedEvents: failedDeleted,
					deletedStaleEvents: staleDeleted,
				});
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] cleanup-raw-webhook-payloads failed", {
			feature: "cron",
			operation: "cleanup-raw-webhook-payloads",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
