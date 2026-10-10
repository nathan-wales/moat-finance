// Earliest retirement age that still funds the plan through longevity.
//
// Deterministic only, per the performance contract: this runs on every page
// load, and a Monte Carlo sweep over ages would blow the budget. The UI
// captions this as the straight-line path, not a success probability.

import { projectRetirement } from "./project";
import type { RetirementPlanInputs } from "./types";

/**
 * Moving retirement also moves the end of earnings and contributions whenever
 * those were tied to the retirement date, matching `applyLevers`.
 */
function withRetirementAge(
	inputs: RetirementPlanInputs,
	age: number,
): RetirementPlanInputs {
	return {
		...inputs,
		retirementAge: age,
		employmentEndsAtAge:
			inputs.employmentEndsAtAge === inputs.retirementAge
				? age
				: inputs.employmentEndsAtAge,
		contributionsStopAge:
			inputs.contributionsStopAge === inputs.retirementAge
				? age
				: inputs.contributionsStopAge,
	};
}

export function isFundedAtRetirementAge(
	inputs: RetirementPlanInputs,
	age: number,
): boolean {
	return projectRetirement(withRetirementAge(inputs, age))
		.fundedThroughLongevity;
}

/**
 * The lowest age in `[currentAge + 1, longevityAge - 1]` that funds the plan, or
 * null when no age in range does. Fundedness is monotonic in retirement age for
 * a fixed spending plan, so bisection is safe.
 */
export function solveEarliestRetirementAge(
	inputs: RetirementPlanInputs,
): number | null {
	const lowestPossible = inputs.currentAge + 1;
	const highestPossible = Math.max(lowestPossible, inputs.longevityAge - 1);

	if (isFundedAtRetirementAge(inputs, lowestPossible)) return lowestPossible;
	if (!isFundedAtRetirementAge(inputs, highestPossible)) return null;

	let low = lowestPossible;
	let high = highestPossible;
	while (high - low > 1) {
		const middle = Math.floor((low + high) / 2);
		if (isFundedAtRetirementAge(inputs, middle)) high = middle;
		else low = middle;
	}
	return high;
}
