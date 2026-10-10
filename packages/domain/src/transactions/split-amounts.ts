export type SplitAmountLeg = {
	amount: number;
};

export function amountToCents(amount: number): number {
	return Math.round(amount * 100);
}

export function centsToAmount(cents: number): number {
	return cents / 100;
}

export function sumLegCents(legs: SplitAmountLeg[]): number {
	return legs.reduce((sum, leg) => sum + amountToCents(leg.amount), 0);
}

export function splitRemainderCents(
	originalAmount: number,
	legs: SplitAmountLeg[],
): number {
	return amountToCents(originalAmount) - sumLegCents(legs);
}

export function splitAmountsMatchOriginal(
	originalAmount: number,
	legs: SplitAmountLeg[],
): boolean {
	return splitRemainderCents(originalAmount, legs) === 0;
}
