/**
 * Runs due manual investment balance accruals on vault unlock / app launch.
 * Non-blocking — never delays window creation.
 */

import type { AppContext } from "@moat/domain";
import { accrueDueManualInvestments } from "@moat/domain";
import { recordDesktopInvestmentHistory } from "../account-balance-history";
import { getDesktopDb } from "../db";
import { remoteLogger } from "../lib/remote-logger";

export function runInvestmentAccrualOnLaunch(appCtx: AppContext): void {
	void accrueDueManualInvestments(appCtx)
		.then(async (result) => {
			if (result.processed === 0 && result.accrued === 0) return;

			const { db } = getDesktopDb();
			for (const step of result.appliedSteps) {
				try {
					await recordDesktopInvestmentHistory({
						db,
						userId: step.userId,
						investmentId: step.investmentId,
						balance: step.newBalance,
						date: step.periodEnd,
					});
				} catch (error) {
					console.error(
						"[account-balance-history] Failed after desktop accrual",
						error,
					);
				}
			}

			console.log(
				`[investment-accrual] processed=${result.processed} accrued=${result.accrued} months=${result.monthsApplied}`,
			);
			remoteLogger.info("Desktop investment accrual complete", {
				event: "investment.accrual_complete",
				feature: "investment-accrual",
				operation: "launch",
				metadata: {
					processed: result.processed,
					accrued: result.accrued,
					monthsApplied: result.monthsApplied,
					failed: result.failed,
				},
			});
		})
		.catch((err) => {
			const errorMessage = err instanceof Error ? err.message : "Unknown error";
			console.error("[investment-accrual] Launch accrual failed:", err);
			remoteLogger.error("Desktop investment accrual failed", {
				event: "investment.accrual_failed",
				feature: "investment-accrual",
				operation: "launch",
				metadata: { errorMessage },
			});
		});
}
