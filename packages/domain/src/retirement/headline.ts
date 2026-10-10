// The deterministic headline verdict. Exactly four shapes, no LLM — the sentence
// at the top of the page must be reproducible and defensible.

import type {
	RetirementDataStatus,
	RetirementHeadline,
	RetirementMissingInput,
	RetirementProjectionSummary,
} from "@moat/contracts";
import { formatMoney } from "./format";
import type { RetirementSetupChecklistItem } from "./setup-checklist";
import { missingInputsFromChecklist } from "./setup-checklist";

const HEADLINE_SUPPORTING =
	"Based on your current savings, investments, spending, debts and expected income.";

export function buildRetirementHeadline(input: {
	dataStatus: RetirementDataStatus;
	summary: RetirementProjectionSummary;
	/** Null until Monte Carlo has run; the deterministic verdict stands in. */
	confidence: number | null;
}): RetirementHeadline {
	const { dataStatus, summary, confidence } = input;
	const supporting = HEADLINE_SUPPORTING;

	if (
		dataStatus === "no_data" ||
		dataStatus === "no_investment_accounts" ||
		dataStatus === "insufficient_history" ||
		dataStatus === "missing_birth_year"
	) {
		return {
			kind: "insufficient_data",
			headline: "We need a bit more to project your retirement",
			supporting,
		};
	}

	const target = summary.targetRetirementAge;
	const onTrackThreshold = summary.confidenceTarget;
	const reachesTarget =
		summary.earliestSustainableAge !== null &&
		summary.earliestSustainableAge <= target;

	if (!reachesTarget) {
		const gap = Math.max(1, Math.round(summary.monthlyShortfallAtTarget));
		return {
			kind: "short",
			headline: `You're currently projected to fall about ${formatMoney(gap)}/month short of your desired retirement lifestyle at age ${target}.`,
			supporting,
		};
	}

	if (confidence !== null && confidence < onTrackThreshold) {
		return {
			kind: "likely_sensitive",
			headline: `You can likely retire at ${target}, but the plan is sensitive to market conditions.`,
			supporting,
		};
	}

	return {
		kind: "on_track",
		headline: `You're on track to retire at ${target}.`,
		supporting,
	};
}

/** Unsatisfied setup checklist rows for the empty state and context rail. */
export function missingInputsFrom(
	checklist: RetirementSetupChecklistItem[],
): RetirementMissingInput[] {
	return missingInputsFromChecklist(checklist);
}
