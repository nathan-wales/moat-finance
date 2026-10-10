/** Income categories that are yield or transfers, not new household savings. */
export const RETIREMENT_EXCLUDED_INCOME_CATEGORIES = new Set([
	"investments",
	"transfer",
	"interest",
	"dividends",
	"capital gains",
]);

export function isExcludedRetirementIncomeCategory(name: string): boolean {
	return RETIREMENT_EXCLUDED_INCOME_CATEGORIES.has(name.trim().toLowerCase());
}

/**
 * Insights net treats dividends and unpaired transfers as income. Retirement
 * already compounds those holdings, so that yield must not also become a
 * savings rate.
 */
export function retirementSavingsNet(input: {
	netIncome: number;
	incomeByCategory: Array<{ category: string; total: number }>;
}): { savingsNet: number; excludedInvestmentIncome: number } {
	const excludedInvestmentIncome = input.incomeByCategory.reduce(
		(sum, row) =>
			isExcludedRetirementIncomeCategory(row.category)
				? sum + Math.max(0, row.total)
				: sum,
		0,
	);
	return {
		savingsNet: input.netIncome - excludedInvestmentIncome,
		excludedInvestmentIncome,
	};
}
