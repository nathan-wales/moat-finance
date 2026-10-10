import type { RetirementTaxTreatment } from "@moat/contracts";
import { DEFAULT_WITHDRAWAL_ORDER } from "./constants";
import type { RetirementBalances } from "./types";

export type WithdrawalResult = {
	taxable: number;
	taxDeferred: number;
	taxFree: number;
	total: number;
	/** Amount the portfolio could not cover this year. */
	unmet: number;
};

const EMPTY: WithdrawalResult = {
	taxable: 0,
	taxDeferred: 0,
	taxFree: 0,
	total: 0,
	unmet: 0,
};

/**
 * Draws `need` from the portfolio following the configured tax-treatment
 * sequence, stopping at each bucket's available balance. Anything the portfolio
 * cannot cover is reported as `unmet` rather than driving a balance negative.
 */
export function resolveWithdrawals(input: {
	need: number;
	balances: RetirementBalances;
	order?: RetirementTaxTreatment[];
}): WithdrawalResult {
	if (input.need <= 0) return { ...EMPTY };

	const order =
		input.order && input.order.length === 3
			? input.order
			: DEFAULT_WITHDRAWAL_ORDER;

	const available: RetirementBalances = {
		taxable: Math.max(0, input.balances.taxable),
		taxDeferred: Math.max(0, input.balances.taxDeferred),
		taxFree: Math.max(0, input.balances.taxFree),
	};

	const drawn: RetirementBalances = { taxable: 0, taxDeferred: 0, taxFree: 0 };
	let remaining = input.need;

	for (const bucket of order) {
		if (remaining <= 0) break;
		const take = Math.min(remaining, available[bucket]);
		drawn[bucket] += take;
		remaining -= take;
	}

	const total = drawn.taxable + drawn.taxDeferred + drawn.taxFree;

	return {
		taxable: drawn.taxable,
		taxDeferred: drawn.taxDeferred,
		taxFree: drawn.taxFree,
		total,
		unmet: Math.max(0, remaining),
	};
}
