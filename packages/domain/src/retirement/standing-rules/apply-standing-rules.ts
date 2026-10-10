import type { RetirementStandingRule } from "@moat/contracts";
import type { RetirementPlanInputs } from "../types";
import { compileStandingRule } from "./registry";
import type { StandingRuleContext } from "./types";

/**
 * Folds standing rules into the baseline inputs. Runs before `applyLevers` so a
 * lever can always override a rule, and clones so the caller's inputs — which
 * are the live baseline shared across every scenario — are never mutated.
 */
export function applyStandingRules(
	inputs: RetirementPlanInputs,
	rules: RetirementStandingRule[],
): RetirementPlanInputs {
	const enabled = rules
		.filter((rule) => rule.enabled)
		.sort((a, b) => a.sortOrder - b.sortOrder);
	if (enabled.length === 0) return inputs;

	const draft = structuredClone(inputs);
	const ctx: StandingRuleContext = {
		currentAge: draft.currentAge,
		spouseCurrentAge: draft.spouseCurrentAge,
		retirementAge: draft.retirementAge,
		longevityAge: draft.longevityAge,
	};

	for (const rule of enabled) {
		compileStandingRule({ draft, rule, ctx });
	}

	return draft;
}
