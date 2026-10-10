export type PlannedContributions = {
	taxDeferred: number;
	taxFree: number;
	taxable: number;
};

export type ClippedContributions = PlannedContributions & {
	residual: number;
};

/**
 * Clip planned 401(k) / Roth / taxable to leftover; tax-advantaged first.
 * leftover < 0 → nothing. Not contributing → all leftover to cash.
 */
export function calculateContributions(
	leftover: number,
	contributing: boolean,
	planned: PlannedContributions,
): ClippedContributions {
	if (leftover < 0) {
		return { taxDeferred: 0, taxFree: 0, taxable: 0, residual: 0 };
	}
	if (!contributing) {
		return {
			taxDeferred: 0,
			taxFree: 0,
			taxable: 0,
			residual: leftover,
		};
	}
	let remaining = leftover;
	const taxDeferred = Math.min(Math.max(0, planned.taxDeferred), remaining);
	remaining -= taxDeferred;
	const taxFree = Math.min(Math.max(0, planned.taxFree), remaining);
	remaining -= taxFree;
	const taxable = Math.min(Math.max(0, planned.taxable), remaining);
	remaining -= taxable;
	return { taxDeferred, taxFree, taxable, residual: remaining };
}

export function splitTaxableWithdrawal(
	amount: number,
	cashBalance: number,
): { cash: number; brokerage: number } {
	const cash = Math.min(Math.max(0, amount), Math.max(0, cashBalance));
	return { cash, brokerage: Math.max(0, amount - cash) };
}
