import type {
	RetirementBalances,
	RetirementBucketReturns,
	RetirementPlanInputs,
} from "../types";

export function annualReturnForYear(
	inputs: RetirementPlanInputs,
	yearIndex: number,
	age: number,
	bucket?: keyof RetirementBucketReturns,
): number {
	const sequenced = inputs.returnSequence?.[yearIndex];
	const scheduled = inputs.returnSchedule?.[yearIndex];
	// A Monte Carlo sequence is an absolute shocked return. When a glide path
	// is also present it is the mean the sequence is shocking around, so the
	// sequence still wins — it already embeds that mean.
	if (sequenced !== undefined) return sequenced;
	if (scheduled !== undefined) return scheduled;

	let rate =
		bucket !== undefined
			? (inputs.bucketReturns?.[bucket] ?? inputs.returnRate)
			: inputs.returnRate;

	if (
		inputs.sequenceRisk &&
		age >= inputs.retirementAge &&
		age < inputs.retirementAge + inputs.sequenceRisk.years
	) {
		rate = inputs.sequenceRisk.annualReturn;
	}

	for (const shock of inputs.marketShocks) {
		if (age === shock.atAge) {
			rate = -shock.dropPercent;
		} else if (
			shock.recoveryYears > 0 &&
			age > shock.atAge &&
			age <= shock.atAge + shock.recoveryYears
		) {
			rate =
				bucket !== undefined
					? (inputs.bucketReturns?.[bucket] ?? inputs.returnRate)
					: inputs.returnRate;
		}
	}

	return rate;
}

export type GrownBalances = {
	cashBalance: number;
	balances: RetirementBalances;
};

export function applyYearEndGrowth(input: {
	cashBalance: number;
	balances: RetirementBalances;
	cashYield: number;
	inputs: RetirementPlanInputs;
	yearIndex: number;
	age: number;
}): GrownBalances {
	const cashBalance = Math.max(0, input.cashBalance * (1 + input.cashYield));
	const balances: RetirementBalances = {
		taxable: Math.max(
			0,
			input.balances.taxable *
				(1 +
					annualReturnForYear(
						input.inputs,
						input.yearIndex,
						input.age,
						"taxable",
					)),
		),
		taxDeferred: Math.max(
			0,
			input.balances.taxDeferred *
				(1 +
					annualReturnForYear(
						input.inputs,
						input.yearIndex,
						input.age,
						"taxDeferred",
					)),
		),
		taxFree: Math.max(
			0,
			input.balances.taxFree *
				(1 +
					annualReturnForYear(
						input.inputs,
						input.yearIndex,
						input.age,
						"taxFree",
					)),
		),
	};
	if (input.balances.cash !== undefined) {
		balances.cash = cashBalance;
	}
	return { cashBalance, balances };
}
