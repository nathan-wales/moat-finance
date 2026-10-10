import type { SpendingPhase, SpendingPolicy } from "@moat/contracts";

/** Share of today's lifestyle a household is assumed to spend once retired. */
const DEFAULT_RETIREMENT_SPEND_SHARE = 0.9;

const SMILE_PHASES = {
	goGo: { label: "Early retirement", percentOfBase: 1, years: 10 },
	slowGo: { label: "Mid retirement", percentOfBase: 0.85, years: 10 },
	noGo: { label: "Later years", percentOfBase: 0.75 },
} as const;

/**
 * The go-go / slow-go / no-go curve, generated rather than asked for.
 *
 * Spending is not flat across a thirty-year retirement — travel and discovery
 * front-load, then taper. Asking a user for three figures they have never
 * estimated produces worse numbers than a default they can see and adjust, so
 * these arrive filled in and editable.
 */
export function deriveSpendingPhases(input: {
	retirementAge: number;
	longevityAge: number;
}): SpendingPhase[] {
	const { retirementAge, longevityAge } = input;
	if (longevityAge <= retirementAge) return [];

	const goGoEnd = Math.min(
		longevityAge,
		retirementAge + SMILE_PHASES.goGo.years,
	);
	const slowGoEnd = Math.min(longevityAge, goGoEnd + SMILE_PHASES.slowGo.years);

	const phases: SpendingPhase[] = [
		{
			label: SMILE_PHASES.goGo.label,
			fromAge: retirementAge,
			toAge: goGoEnd,
			percentOfBase: SMILE_PHASES.goGo.percentOfBase,
		},
	];
	if (slowGoEnd > goGoEnd) {
		phases.push({
			label: SMILE_PHASES.slowGo.label,
			fromAge: goGoEnd,
			toAge: slowGoEnd,
			percentOfBase: SMILE_PHASES.slowGo.percentOfBase,
		});
	}
	if (longevityAge > slowGoEnd) {
		phases.push({
			label: SMILE_PHASES.noGo.label,
			fromAge: slowGoEnd,
			toAge: null,
			percentOfBase: SMILE_PHASES.noGo.percentOfBase,
		});
	}
	return phases;
}

export function deriveSpendingPolicy(input: {
	retirementAge: number;
	longevityAge: number;
}): SpendingPolicy {
	return {
		retirementSpendPercentOfCurrent: {
			value: DEFAULT_RETIREMENT_SPEND_SHARE,
			source: "assumed",
			confidence: "low",
			rationale:
				"Most households spend a little less once commuting and work costs stop.",
		},
		currentLifestyleMonthly: null,
		phaseModel: "smile",
		phases: deriveSpendingPhases(input),
	};
}
