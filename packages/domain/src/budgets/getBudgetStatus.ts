import { resolveCategoryParent } from "@moat/category-mapping";
import type { CategoryParent } from "@moat/contracts";
import type { AppContext } from "../context";
import { computeBudgetStatus } from "./status-helpers";

export type BudgetStatus =
	| "on-track"
	| "close-to-budget"
	| "overspending"
	| "no-spend"
	| "unknown";

export type CategoryBudgetStatusRow = {
	categoryId: string;
	categoryName: string;
	monthlyGoal: number | null;
	spentThisMonth: number;
	status: BudgetStatus;
	expectedSpendToDate: number;
	parentCategory: CategoryParent | null;
	alertsEnabled: boolean | null;
	alertThresholds: number[] | null;
};

export type GetBudgetStatusInput = {
	/** Start of the reporting period (inclusive) */
	periodStart: Date;
	/** End of the reporting period (inclusive) */
	periodEnd: Date;
	/** Day of month (1-based) for progress calculation */
	dayOfMonth: number;
	/** Total days in this month */
	daysInMonth: number;
	/** Include categories with no spend and no budget (for the budget page picker). */
	includeEmptyCategories?: boolean;
};

export type BudgetStatusResult = {
	totalBudget: number;
	actualSpent: number;
	expectedByNow: number;
	remaining: number;
	status: BudgetStatus;
	progressPercent: number;
	categories: CategoryBudgetStatusRow[];
};

/**
 * Returns the user's budget status for a reporting period.
 * Inputs are derived from the reporting period (start/end dates, day of month)
 * so callers control demo/real time separately.
 */
export async function getBudgetStatus(
	ctx: AppContext,
	input: GetBudgetStatusInput,
): Promise<BudgetStatusResult> {
	const { periodStart, periodEnd, dayOfMonth, daysInMonth } = input;

	const [categoriesWithBudgets, spendRows] = await Promise.all([
		ctx.repositories.budgets.getCategoriesWithBudgets({ userId: ctx.userId }),
		ctx.repositories.budgets.getCategorySpendForPeriod({
			userId: ctx.userId,
			startDate: periodStart,
			endDate: periodEnd,
		}),
	]);

	const spendByCategory = new Map<string, number>();
	for (const row of spendRows) {
		if (row.categoryId) {
			spendByCategory.set(
				row.categoryId,
				(spendByCategory.get(row.categoryId) ?? 0) + row.total,
			);
		}
	}

	const categoryRows: CategoryBudgetStatusRow[] = [];
	let totalBudget = 0;
	let actualSpent = 0;

	for (const cat of categoriesWithBudgets) {
		const monthlyGoal = cat.monthlyGoal;
		const spent = spendByCategory.get(cat.categoryId) ?? 0;

		if (monthlyGoal === null && spent === 0 && !input.includeEmptyCategories) {
			continue;
		}

		const dailyBudget = monthlyGoal !== null ? monthlyGoal / daysInMonth : 0;
		const expectedSpendToDate = dailyBudget * dayOfMonth;

		categoryRows.push({
			categoryId: cat.categoryId,
			categoryName: cat.categoryName,
			monthlyGoal,
			spentThisMonth: spent,
			status: computeBudgetStatus(
				spent,
				monthlyGoal ?? 0,
				monthlyGoal !== null,
			),
			expectedSpendToDate,
			parentCategory: resolveCategoryParent(
				cat.categoryName,
				cat.parentCategory,
			),
			alertsEnabled: cat.alertsEnabled ?? null,
			alertThresholds: cat.alertThresholds ?? null,
		});

		if (monthlyGoal !== null) totalBudget += monthlyGoal;
		actualSpent += spent;
	}

	// Sort: overspending first, then by spend amount
	const statusOrder: Record<BudgetStatus, number> = {
		overspending: 0,
		"close-to-budget": 1,
		"on-track": 2,
		"no-spend": 3,
		unknown: 4,
	};
	categoryRows.sort((a, b) => {
		const diff = statusOrder[a.status] - statusOrder[b.status];
		return diff !== 0 ? diff : b.spentThisMonth - a.spentThisMonth;
	});

	const dailyBudget = totalBudget > 0 ? totalBudget / daysInMonth : 0;
	const expectedByNow = dailyBudget * dayOfMonth;
	const remaining = Math.max(0, totalBudget - actualSpent);
	const progressPercent =
		totalBudget > 0 ? Math.min(100, (actualSpent / totalBudget) * 100) : 0;

	return {
		totalBudget,
		actualSpent,
		expectedByNow,
		remaining,
		status: computeBudgetStatus(actualSpent, totalBudget, totalBudget > 0),
		progressPercent,
		categories: categoryRows,
	};
}
