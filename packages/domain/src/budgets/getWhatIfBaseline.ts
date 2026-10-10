import {
	consolidateSmallWhatIfItems,
	DEFAULT_WHAT_IF_BASELINE_MONTHS,
	type WhatIfBaselineMonths,
	type WhatIfBaselineResponse,
	type WhatIfMonthlyItemType,
	type WhatIfMonthlyLineItem,
} from "@moat/contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { AppContext } from "../context";

export type WhatIfIncomeSource = {
	source: string;
	total: number;
};

export type GetWhatIfBaselineInput = {
	months?: WhatIfBaselineMonths;
	now?: Date;
	incomeBySource?: WhatIfIncomeSource[];
};

const SAVINGS_KEYWORDS = [
	"saving",
	"investment",
	"invest",
	"retirement",
	"401k",
	"403b",
	"ira",
	"roth",
	"pension",
	"brokerage",
	"hsa",
	"emergency",
];

const DEBT_KEYWORDS = [
	"loan",
	"debt",
	"credit card",
	"mortgage",
	"auto loan",
	"student loan",
	"payment",
];

function classifyCategory(name: string): WhatIfMonthlyItemType {
	const lower = name.toLowerCase();
	if (SAVINGS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
		return "savings";
	}
	if (DEBT_KEYWORDS.some((keyword) => lower.includes(keyword))) return "debt";
	return "expense";
}

async function resolveIncomeBySource(
	ctx: AppContext,
	input: GetWhatIfBaselineInput,
	baselineStart: Date,
	monthEnd: Date,
): Promise<WhatIfIncomeSource[]> {
	if (input.incomeBySource) return input.incomeBySource;

	const monthlyTotals = await ctx.repositories.dashboard.getMonthlyTotals({
		userId: ctx.userId,
		startDate: baselineStart,
		endDate: monthEnd,
	});
	const totalIncome = monthlyTotals.reduce((sum, row) => sum + row.income, 0);
	if (totalIncome === 0) return [];
	return [{ source: "Total Income", total: totalIncome }];
}

/**
 * Monthly cash-flow baseline for the What If calculator.
 * Income is averaged from transactions; expenses use saved budget goals
 * and fall back to trailing spend for unbudgeted categories.
 */
export async function getWhatIfBaseline(
	ctx: AppContext,
	input: GetWhatIfBaselineInput = {},
): Promise<WhatIfBaselineResponse> {
	const baselineMonths = input.months ?? DEFAULT_WHAT_IF_BASELINE_MONTHS;
	const now = input.now ?? new Date();
	const baselineStart = startOfMonth(subMonths(now, baselineMonths - 1));
	const monthEnd = endOfMonth(now);
	const { userId, repositories } = ctx;

	const [categories, spend, incomeRows] = await Promise.all([
		repositories.budgets.getCategoriesWithBudgets({ userId }),
		repositories.budgets.getCategorySpendForPeriod({
			userId,
			startDate: baselineStart,
			endDate: monthEnd,
		}),
		resolveIncomeBySource(ctx, input, baselineStart, monthEnd),
	]);

	const baselineItems: WhatIfMonthlyLineItem[] = [];
	let baselineIncome = 0;

	for (const row of incomeRows) {
		const monthlyAmount = Math.round(Math.abs(row.total) / baselineMonths);
		if (monthlyAmount <= 0) continue;
		baselineItems.push({
			id: `income:${row.source}`,
			name: row.source,
			type: "income",
			monthlyAmount,
			isBaseline: true,
		});
		baselineIncome += monthlyAmount;
	}

	const spendByCategory = new Map(
		spend.map((row) => [row.categoryId ?? row.categoryName, row]),
	);
	const baselineCategoryIds = new Set<string>();
	let baselineExpenses = 0;
	let baselineSavings = 0;
	let baselineDebt = 0;

	function addCategoryBaseline(
		categoryId: string,
		categoryName: string,
		monthlyAmount: number,
	) {
		if (monthlyAmount <= 0) return;
		const type = classifyCategory(categoryName);
		if (type === "savings") baselineSavings += monthlyAmount;
		else if (type === "debt") baselineDebt += monthlyAmount;
		else baselineExpenses += monthlyAmount;

		baselineItems.push({
			id: `${type}:${categoryId}`,
			name: categoryName,
			type,
			monthlyAmount,
			category: categoryName,
			isBaseline: true,
		});
		baselineCategoryIds.add(categoryId);
	}

	for (const category of categories) {
		const monthlyGoal = category.monthlyGoal
			? Math.round(category.monthlyGoal)
			: null;
		if (!monthlyGoal || monthlyGoal <= 0) continue;
		addCategoryBaseline(
			category.categoryId,
			category.categoryName,
			monthlyGoal,
		);
	}

	for (const [categoryId, row] of spendByCategory) {
		if (baselineCategoryIds.has(categoryId)) continue;
		addCategoryBaseline(
			categoryId,
			row.categoryName,
			Math.round(row.total / baselineMonths),
		);
	}

	return {
		baselineItems: consolidateSmallWhatIfItems(baselineItems),
		baselineIncome,
		baselineExpenses,
		baselineSavings,
		baselineDebt,
	};
}
