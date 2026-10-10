import type { IncomeAdjustment, IncomeGap } from "../types";

export type WageInputs = {
	age: number;
	spouseAge: number | null;
	spouseAlive: boolean;
	salaryFactor: number;
	inflationFactor: number;
	annualEmploymentIncome: number;
	annualSpouseEmploymentIncome: number;
	employmentEndsAtAge: number;
	spouseEmploymentEndsAtAge: number | null;
	incomeAdjustments: IncomeAdjustment[];
	incomeGaps: IncomeGap[];
};

export type WageResult = {
	primaryIsWorking: boolean;
	spouseIsWorking: boolean;
	employmentIncome: number;
	spouseEmploymentIncome: number;
	severanceIncome: number;
};

/**
 * Employment pay for one year. Dollar adjustments (`setTo`, `annualDelta`)
 * only apply while that person is still working — they retune a paycheck,
 * they do not create one after the job ends.
 */
export function calculateWages(input: WageInputs): WageResult {
	const primaryIsWorking = input.age < input.employmentEndsAtAge;
	const spouseIsWorking =
		input.spouseAlive &&
		input.spouseEmploymentEndsAtAge !== null &&
		input.spouseAge !== null &&
		input.spouseAge < input.spouseEmploymentEndsAtAge;

	let employmentIncome = primaryIsWorking
		? input.annualEmploymentIncome * input.salaryFactor
		: 0;
	let spouseEmploymentIncome = spouseIsWorking
		? input.annualSpouseEmploymentIncome * input.salaryFactor
		: 0;

	for (const adjustment of input.incomeAdjustments) {
		if (input.age < adjustment.fromAge) continue;
		if (adjustment.toAge !== null && input.age > adjustment.toAge) continue;
		const isWorking =
			adjustment.whom === "primary" ? primaryIsWorking : spouseIsWorking;
		if (!isWorking) continue;
		const earned =
			adjustment.whom === "primary" ? employmentIncome : spouseEmploymentIncome;
		const adjusted =
			adjustment.setTo !== null
				? adjustment.setTo * input.inflationFactor
				: earned * (1 + adjustment.percentDelta) +
					adjustment.annualDelta * input.salaryFactor;
		if (adjustment.whom === "primary") employmentIncome = adjusted;
		else spouseEmploymentIncome = adjusted;
	}

	let severanceIncome = 0;
	for (const gap of input.incomeGaps) {
		const gapAge = gap.whom === "spouse" ? input.spouseAge : input.age;
		if (gapAge === null) continue;
		if (gapAge < gap.fromAge || gapAge >= gap.toAge) continue;
		const kept = Math.max(0, 1 - gap.shareOfYear);
		if (gap.whom === "primary") employmentIncome *= kept;
		else spouseEmploymentIncome *= kept;
		if (gapAge === gap.fromAge) severanceIncome += gap.severance;
	}

	return {
		primaryIsWorking,
		spouseIsWorking,
		employmentIncome: Math.max(0, employmentIncome),
		spouseEmploymentIncome: Math.max(0, spouseEmploymentIncome),
		severanceIncome,
	};
}
