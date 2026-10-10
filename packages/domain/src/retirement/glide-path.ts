import type { AllocationPolicy } from "@moat/contracts";

/**
 * Compiles an allocation policy into an expected return per projection year.
 *
 * Deliberately not an asset-class model. `bucketReturns` is indexed by tax
 * treatment, so adding a stocks/bonds/cash axis multiplies against it and
 * forces every fixture to carry a matrix. A glide path only needs to answer
 * "what return do I expect at this age", and a blended equity/bond figure
 * answers that with one number per year.
 */
export function buildReturnSchedule(input: {
	policy: AllocationPolicy;
	currentAge: number;
	retirementAge: number;
	longevityAge: number;
}): number[] | undefined {
	const { policy, currentAge, retirementAge, longevityAge } = input;
	const years = Math.max(0, longevityAge - currentAge);
	if (years === 0) return undefined;

	// A detected allocation on its own must not replace the return rate the user
	// chose. The schedule only exists once they turn the glide path on.
	if (!policy.glidePath.enabled) return undefined;

	const blend = (equityShare: number): number =>
		equityShare * policy.expectedEquityReturn +
		(1 - equityShare) * policy.expectedBondReturn;

	const startEquity =
		policy.targetEquityPercent?.value ?? policy.glidePath.equityAtRetirement;
	const { equityAtRetirement, equityAtLongevity } = policy.glidePath;

	return Array.from({ length: years }, (_unused, index) => {
		const age = currentAge + index;
		if (age <= currentAge) return blend(startEquity);
		if (age >= longevityAge) return blend(equityAtLongevity);
		if (age < retirementAge) {
			const progress =
				retirementAge > currentAge
					? (age - currentAge) / (retirementAge - currentAge)
					: 1;
			return blend(startEquity + (equityAtRetirement - startEquity) * progress);
		}
		const progress =
			longevityAge > retirementAge
				? (age - retirementAge) / (longevityAge - retirementAge)
				: 1;
		return blend(
			equityAtRetirement + (equityAtLongevity - equityAtRetirement) * progress,
		);
	});
}

export type ClassifiedHoldings = {
	equityValue: number;
	fixedIncomeValue: number;
	cashValue: number;
	unclassifiedValue: number;
};

/**
 * Equity share implied by real holdings. Unclassified value is excluded from
 * the denominator rather than assumed to be equity — guessing here would turn
 * an unknown into a confident-looking default.
 */
export function equityShareFromHoldings(
	holdings: ClassifiedHoldings,
): number | null {
	const classified =
		holdings.equityValue + holdings.fixedIncomeValue + holdings.cashValue;
	if (classified <= 0) return null;
	return holdings.equityValue / classified;
}
