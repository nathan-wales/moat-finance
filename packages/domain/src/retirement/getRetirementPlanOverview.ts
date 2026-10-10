// The single request that populates the page on first paint.
//
// Deterministic only: baseline, ledger, headline metrics, plan confidence, and
// suggestions. Monte Carlo is a separate query so the page can render inside its
// budget and fill in confidence when the trials finish.

import type { RetirementPlanOverview } from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import { buildRetirementProjection } from "./build-projection";
import { buildRetirementHeadline, missingInputsFrom } from "./headline";
import { scorePlanConfidence } from "./plan-confidence";
import { buildRetirementSetupChecklist } from "./setup-checklist";
import { suggestLevers } from "./suggest-levers";

export type GetRetirementPlanOverviewInput = {
	now?: Date;
};

export async function getRetirementPlanOverview(
	ctx: AppContext,
	input: GetRetirementPlanOverviewInput = {},
): Promise<RetirementPlanOverview> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const { projection } = buildRetirementProjection({
		baseline,
		levers: [],
	});
	const planConfidence = scorePlanConfidence(baseline);
	const setupChecklist = buildRetirementSetupChecklist(baseline);

	return {
		plan: baseline.plan,
		baseline: baseline.summary,
		projection,
		planConfidence,
		suggestedLevers: suggestLevers({
			baseline,
			earliestSustainableAge: projection.summary.earliestSustainableAge,
		}),
		headline: buildRetirementHeadline({
			dataStatus: baseline.dataStatus,
			summary: projection.summary,
			confidence: null,
		}),
		dataStatus: baseline.dataStatus,
		missingInputs: missingInputsFrom(setupChecklist),
		standingRules: baseline.standingRules,
		standingRuleSuggestions: baseline.standingRuleSuggestions,
		policyDefaults: baseline.policyDefaults,
	};
}
