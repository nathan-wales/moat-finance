import type { CategoryBudgetDetail } from "@moat/contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { AppContext } from "../context";
import {
	buildTrailingSixMonthTrend,
	computeTrailingAverageBudget,
	monthKey,
} from "./trailing-average";

export type GetBudgetCategoryDetailInput = {
	categoryId: string;
	/** Anchor date for "current month" (demo clock or real now). */
	referenceDate: Date;
};

/**
 * Category edit-dialog payload: current goal, trailing spend, and suggested budget.
 */
export async function getBudgetCategoryDetail(
	ctx: AppContext,
	input: GetBudgetCategoryDetailInput,
): Promise<CategoryBudgetDetail> {
	const { categoryId, referenceDate } = input;
	const categories = await ctx.repositories.budgets.getCategoriesWithBudgets({
		userId: ctx.userId,
	});
	const category = categories.find((c) => c.categoryId === categoryId);
	if (!category) {
		throw new Error("Category not found");
	}

	const trendStart = startOfMonth(subMonths(referenceDate, 6));
	const trendEnd = endOfMonth(referenceDate);

	const spendRows = await ctx.repositories.budgets.getCategorySpendByMonth({
		userId: ctx.userId,
		categoryId,
		startDate: trendStart,
		endDate: trendEnd,
	});

	const spendByMonth = new Map(
		spendRows.map((row) => [row.month, row.amount] as const),
	);

	const monthlyTrend = buildTrailingSixMonthTrend(spendByMonth, referenceDate);
	const { sixMonthAverage, suggestedBudget } = computeTrailingAverageBudget(
		spendByMonth,
		referenceDate,
	);

	const spentThisMonth = spendByMonth.get(monthKey(referenceDate)) ?? 0;
	const lastMonthSpend =
		spendByMonth.get(monthKey(subMonths(referenceDate, 1))) ?? 0;

	return {
		categoryId: category.categoryId,
		categoryName: category.categoryName,
		monthlyGoal: category.monthlyGoal,
		spentThisMonth,
		lastMonthSpend,
		sixMonthAverage,
		suggestedBudget,
		monthlyTrend,
	};
}
