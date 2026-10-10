// One place owns how a headline spending figure is partitioned into living,
// housing, healthcare, insurance, and other-debt. The ledger, baseline, and
// inspector all have to agree on that split — F-1 and F-4 were the same
// dollars subtracted in two layers.

export type SpendCarveOuts = {
	healthcareMonthly: number;
	housingDebtServiceMonthly: number;
	propertyOperatingMonthly: number;
	insurancePremiumsMonthly: number;
	otherDebtServiceMonthly: number;
};

export type ComposedMonthlySpend = {
	living: number;
	housing: number;
	healthcare: number;
	insurance: number;
	otherDebt: number;
};

/**
 * Partitions a headline monthly figure into the lines the ledger models
 * itself. Living is the residual and may be negative when carve-outs exceed
 * the headline — callers that feed the engine clamp with
 * `toEngineMonthlySpend`. The parts always sum to the headline.
 */
export function composeSpend(
	headlineMonthly: number,
	carveOuts: SpendCarveOuts,
): ComposedMonthlySpend {
	const housing =
		carveOuts.housingDebtServiceMonthly + carveOuts.propertyOperatingMonthly;
	const healthcare = carveOuts.healthcareMonthly;
	const insurance = carveOuts.insurancePremiumsMonthly;
	const otherDebt = carveOuts.otherDebtServiceMonthly;
	return {
		living: headlineMonthly - housing - healthcare - insurance - otherDebt,
		housing,
		healthcare,
		insurance,
		otherDebt,
	};
}

export function composedSpendSum(parts: ComposedMonthlySpend): number {
	return (
		parts.living +
		parts.housing +
		parts.healthcare +
		parts.insurance +
		parts.otherDebt
	);
}

/** Living-expenses figure the ledger consumes (never negative). */
export function toEngineMonthlySpend(
	headlineMonthly: number,
	exclusions: SpendCarveOuts,
): number {
	return Math.max(0, composeSpend(headlineMonthly, exclusions).living);
}

/** Inverse of `toEngineMonthlySpend` — used when reporting solved spend to the UI. */
export function toHeadlineMonthlySpend(
	engineMonthly: number,
	exclusions: SpendCarveOuts,
): number {
	const reserved = composeSpend(0, exclusions);
	return Math.max(
		0,
		engineMonthly +
			reserved.housing +
			reserved.healthcare +
			reserved.insurance +
			reserved.otherDebt,
	);
}

/**
 * Turns a window total into an annual run-rate using the months actually
 * observed, so 6 months of history is not read as a half-year of spending.
 */
export function annualizeWindowTotal(
	total: number,
	monthCount: number,
): number {
	if (total <= 0) return 0;
	return (total / Math.max(1, monthCount)) * 12;
}

export function monthlyAmountFromWindowTotal(
	total: number,
	monthCount: number,
): number {
	return total / Math.max(1, monthCount);
}
