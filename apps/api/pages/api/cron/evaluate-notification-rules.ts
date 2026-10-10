import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import { runCategoryBudgetAlertSweep } from "~/server/services/category-budget-alert.service";
import { runNotificationRuleEvaluationSweep } from "~/server/services/notification-evaluation.service";

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
				const [result, budgetAlerts] = await Promise.all([
					runNotificationRuleEvaluationSweep(db),
					runCategoryBudgetAlertSweep(db),
				]);
				logger.info("[cron] evaluate-notification-rules complete", {
					feature: "cron",
					operation: "evaluate-notification-rules",
					...result,
					budgetAlerts,
				});
				return res.status(200).json({ success: true, ...result, budgetAlerts });
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] evaluate-notification-rules failed", {
			feature: "cron",
			operation: "evaluate-notification-rules",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
