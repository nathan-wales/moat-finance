import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import { runManualLiabilityBalanceAmortization } from "~/server/services/manual-liability-amortization.service";

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
				const result = await runManualLiabilityBalanceAmortization();
				logger.info("[cron] amortize-manual-liability-balances complete", {
					feature: "cron",
					operation: "amortize-manual-liability-balances",
					...result,
				});
				return res.status(200).json({ success: true, ...result });
			},
			{ timeoutMs: 120_000 },
		);
	} catch (error) {
		logger.error("[cron] amortize-manual-liability-balances failed", {
			feature: "cron",
			operation: "amortize-manual-liability-balances",
			errorName: error instanceof Error ? error.name : "Unknown",
			errorMessage: error instanceof Error ? error.message : String(error),
		});
		return res.status(500).json({ error: "Internal server error" });
	}
}
