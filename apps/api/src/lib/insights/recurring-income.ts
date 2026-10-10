type RecurringIncomeGroup = {
	source: string;
	amounts: number[];
	months: Set<string>;
};

export function detectRecurringIncomeSources(
	groups: Map<string, RecurringIncomeGroup>,
): Set<string> {
	const recurring = new Set<string>();

	for (const [source, group] of groups) {
		if (group.months.size < 2) continue;

		const avg =
			group.amounts.reduce((sum, amount) => sum + amount, 0) /
			group.amounts.length;
		if (avg <= 0) continue;

		const isStable = group.amounts.every(
			(amount) => Math.abs(amount - avg) / avg < 0.15,
		);
		if (isStable) {
			recurring.add(source);
		}
	}

	return recurring;
}

export function sumRecurringIncome(
	sourceTotals: Map<string, number>,
	recurringSources: Set<string>,
): number {
	let total = 0;
	for (const [source, amount] of sourceTotals) {
		if (recurringSources.has(source)) {
			total += amount;
		}
	}
	return total;
}
