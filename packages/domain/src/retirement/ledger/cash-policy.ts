import type { CashPolicy } from "@moat/contracts";

/**
 * Cash above the reserve target, and where it goes.
 *
 * Residual cash flow has always parked in cash and stayed there, which is why a
 * long projection can end with an absurd cash balance. This makes the behavior
 * visible and choosable without changing it by fiat: the default destination is
 * `cash`, so an unset policy sweeps nothing and every existing projection is
 * byte-identical.
 */
export function calculateCashSweep(input: {
	policy: CashPolicy | undefined;
	endingCash: number;
	annualExpenses: number;
	/** RMD taken this year. Used when `rmdExcessDestination` is taxable. */
	rmdAmount?: number;
}): { sweptToTaxable: number; remainingCash: number } {
	const { policy, endingCash } = input;
	if (!policy || endingCash <= 0) {
		return { sweptToTaxable: 0, remainingCash: Math.max(0, endingCash) };
	}

	const target = cashReserveTarget({
		policy,
		annualExpenses: input.annualExpenses,
	});
	let remaining = endingCash;
	let swept = 0;

	if (policy.rmdExcessDestination === "taxable") {
		const rmd = Math.max(0, input.rmdAmount ?? 0);
		const rmdExcess = Math.min(rmd, Math.max(0, remaining - target));
		remaining -= rmdExcess;
		swept += rmdExcess;
	}

	if (policy.excessDestination === "taxable") {
		const excess = Math.max(0, remaining - target);
		remaining -= excess;
		swept += excess;
	}

	return { sweptToTaxable: swept, remainingCash: remaining };
}

export function cashReserveTarget(input: {
	policy: CashPolicy;
	annualExpenses: number;
}): number {
	const { targetReserve } = input.policy;
	if (targetReserve.mode === "fixed") return Math.max(0, targetReserve.amount);
	const monthlyExpenses = Math.max(0, input.annualExpenses) / 12;
	return monthlyExpenses * Math.max(0, targetReserve.months);
}
