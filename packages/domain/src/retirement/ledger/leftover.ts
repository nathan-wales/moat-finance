export type CashFlowInputs = {
	cashIn: number;
	cashOut: number;
	cashFlowTax: number;
};

/** Signed leftover. Same identity in accumulation and retirement. */
export function calculateCashFlowLeftover({
	cashIn,
	cashOut,
	cashFlowTax,
}: CashFlowInputs): number {
	return cashIn - cashOut - cashFlowTax;
}
