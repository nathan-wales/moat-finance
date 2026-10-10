import type { NextApiRequest, NextApiResponse } from "next";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import {
	processProviderSyncJobById,
	processProviderSyncJobs,
} from "~/server/services/provider-sync-job.service";

const processJobBodySchema = z.object({
	jobId: z.string().min(1),
});

function unauthorized(res: NextApiResponse) {
	return res.status(401).json({ error: "Unauthorized" });
}

function assertCronAuth(req: NextApiRequest, res: NextApiResponse): boolean {
	const authHeader = req.headers.authorization;
	const cronSecret = process.env.CRON_SECRET;
	if (!cronSecret || authHeader !== `Bearer ${cronSecret}`) {
		unauthorized(res);
		return false;
	}
	return true;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "GET" && req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	if (!assertCronAuth(req, res)) return;

	try {
		if (req.method === "POST") {
			const parsed = processJobBodySchema.safeParse(req.body);
			if (!parsed.success) {
				return res.status(400).json({ error: "Invalid body" });
			}

			return await withServiceDatabaseActor(
				async () => {
					const result = await processProviderSyncJobById(parsed.data.jobId);
					logger.info("[cron] process-provider-sync-job-by-id complete", {
						feature: "cron",
						operation: "process-provider-sync-job-by-id",
						jobId: parsed.data.jobId,
						outcome: result.outcome,
					});
					return res.status(200).json({ success: true, ...result });
				},
				{ timeoutMs: 120_000 },
			);
		}

		return await withServiceDatabaseActor(
			async () => {
				const result = await processProviderSyncJobs();
				logger.info("[cron] process-provider-sync-jobs complete", {
					feature: "cron",
					operation: "process-provider-sync-jobs",
					...result,
				});
				return res.status(200).json({ success: true, ...result });
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] process-provider-sync-jobs failed", {
			feature: "cron",
			operation: "process-provider-sync-jobs",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
