import type { BudgetPageData } from "@moat/contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { AppContext } from "../context";
import { parseCategoryBudgetAlerts } from "./budget-alerts";
import {
	type BudgetStatus,
	type GetBudgetStatusInput,
	getBudgetStatus,
} from "./getBudgetStatus";
import { computeBudgetStatus, computeStatusMessage } from "./status-helpers";
import { effectiveMonthlyGoal } from "./trailing-average";

export type GetBudgetPageDataInput = Omit<
	GetBudgetStatusInput,
	"includeEmptyCategories"
> & {
	reportingPeriod: BudgetPageData["reportingPeriod"];
	isCurrentMonth?: boolean;
};

const STATUS_ORDER: Record<BudgetStatus, number> = {
	overspending: 0,
	"close-to-budget": 1,
	"on-track": 2,
	"no-spend": 3,
	unknown: 4,
};

/**
 * Builds the full budget page payload used by web and desktop UI.
 * Callers supply the reporting period (demo-aware on API, calendar month on desktop).
 * Unsaved category goals fall back to the trailing 6-month average.
 */
export async function getBudgetPageData(
	ctx: AppContext,
	input: GetBudgetPageDataInput,
): Promise<BudgetPageData> {
	const { dayOfMonth, daysInMonth, reportingPeriod } = input;
	const isCurrentMonth = input.isCurrentMonth ?? true;
	const referenceDate = input.periodStart;
	const trendStart = startOfMonth(subMonths(referenceDate, 6));
	const trendEnd = endOfMonth(referenceDate);

	const [status, monthlySpend] = await Promise.all([
		getBudgetStatus(ctx, {
			periodStart: input.periodStart,
			periodEnd: input.periodEnd,
			dayOfMonth,
			daysInMonth,
			includeEmptyCategories: true,
		}),
		ctx.repositories.budgets.getAllCategorySpendByMonth({
			userId: ctx.userId,
			startDate: trendStart,
			endDate: trendEnd,
		}),
	]);

	const spendByCategory = new Map<string, Map<string, number>>();
	for (const row of monthlySpend) {
		const months = spendByCategory.get(row.categoryId) ?? new Map();
		months.set(row.month, (months.get(row.month) ?? 0) + row.amount);
		spendByCategory.set(row.categoryId, months);
	}

	const categories = status.categories.map((cat) => {
		const monthlyGoal = effectiveMonthlyGoal(
			cat.monthlyGoal ?? null,
			spendByCategory.get(cat.categoryId) ?? new Map(),
			referenceDate,
		);
		const dailyBudget = monthlyGoal !== null ? monthlyGoal / daysInMonth : 0;
		return {
			categoryId: cat.categoryId,
			categoryName: cat.categoryName,
			spentThisMonth: cat.spentThisMonth,
			monthlyGoal,
			expectedSpendToDate: dailyBudget * dayOfMonth,
			status: computeBudgetStatus(
				cat.spentThisMonth,
				monthlyGoal ?? 0,
				monthlyGoal !== null,
			),
			parentCategory: cat.parentCategory,
			alerts: parseCategoryBudgetAlerts({
				hasSavedBudget: cat.monthlyGoal !== null,
				alertsEnabled: cat.alertsEnabled,
				alertThresholds: cat.alertThresholds,
			}),
		};
	});

	categories.sort((a, b) => {
		const diff = STATUS_ORDER[a.status] - STATUS_ORDER[b.status];
		return diff !== 0 ? diff : b.spentThisMonth - a.spentThisMonth;
	});

	let totalBudget = 0;
	let actualSpent = 0;
	for (const cat of categories) {
		if (cat.monthlyGoal !== null) totalBudget += cat.monthlyGoal;
		actualSpent += cat.spentThisMonth;
	}

	const dailyBudget = totalBudget > 0 ? totalBudget / daysInMonth : 0;
	const expectedByNow = dailyBudget * dayOfMonth;
	const remaining = Math.max(0, totalBudget - actualSpent);
	const progressPercent =
		totalBudget > 0 ? Math.min(100, (actualSpent / totalBudget) * 100) : 0;
	const pageStatus = computeBudgetStatus(
		actualSpent,
		totalBudget,
		totalBudget > 0,
	);

	return {
		totalBudget,
		actualSpent,
		expectedByNow,
		remaining,
		status: pageStatus,
		statusMessage: computeStatusMessage(
			pageStatus,
			actualSpent,
			totalBudget,
			isCurrentMonth,
		),
		progressPercent,
		dayOfMonth,
		daysInMonth,
		reportingPeriod,
		categories,
	};
}
