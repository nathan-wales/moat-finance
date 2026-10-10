/**
 * Runs due manual liability balance amortizations on vault unlock / app launch.
 * Non-blocking — never delays window creation.
 */

import type { AppContext } from "@moat/domain";
import { amortizeProfileLiabilities } from "@moat/domain";
import { remoteLogger } from "../lib/remote-logger";

export function runLiabilityAmortizationOnLaunch(appCtx: AppContext): void {
	void (async () => {
		const repo = appCtx.repositories.financialProfileData;
		if (!repo) return;

		const existing = await repo.get({ userId: appCtx.userId });
		if (!existing) return;

		const result = amortizeProfileLiabilities(existing);
		if (result.amortized === 0) return;

		await repo.upsert({
			userId: appCtx.userId,
			data: result.data,
		});

		console.log(
			`[liability-amortization] amortized=${result.amortized} months=${result.monthsApplied}`,
		);
		remoteLogger.info("Desktop liability amortization complete", {
			event: "liability.amortization_complete",
			feature: "liability-amortization",
			operation: "launch",
			metadata: {
				amortized: result.amortized,
				monthsApplied: result.monthsApplied,
			},
		});
	})().catch((error) => {
		console.error("[liability-amortization] failed", error);
		remoteLogger.error("Desktop liability amortization failed", {
			event: "liability.amortization_failed",
			feature: "liability-amortization",
			operation: "launch",
			metadata: {
				errorName: error instanceof Error ? error.name : "Unknown",
				errorMessage: error instanceof Error ? error.message : String(error),
			},
		});
	});
}
