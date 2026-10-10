import { z } from "zod";
import { CategoryParentSchema } from "../category-parent";

export const BUDGET_CHANNELS = {
	getPageData: "budget:getPageData",
	getCategoryDetail: "budget:getCategoryDetail",
	getWhatIfBaseline: "budget:getWhatIfBaseline",
	updateCategoryBudget: "budget:updateCategoryBudget",
} as const;

export const MAX_BUDGET_ALERT_THRESHOLD = 999;

export const CategoryBudgetAlertsSchema = z.object({
	enabled: z.boolean(),
	thresholds: z
		.array(z.number().int().min(1).max(MAX_BUDGET_ALERT_THRESHOLD))
		.min(1)
		.max(8),
});

export const UpdateCategoryBudgetInputSchema = z.object({
	categoryId: z.string(),
	monthlyGoal: z.number().nullable(),
	alertsEnabled: z.boolean().optional(),
	alertThresholds: z
		.array(z.number().int().min(1).max(MAX_BUDGET_ALERT_THRESHOLD))
		.max(8)
		.optional(),
});

export const GetBudgetPageDataInputSchema = z.object({
	month: z.string().optional(),
});

export const GetCategoryDetailInputSchema = z.object({
	categoryId: z.string().min(1),
	month: z.string().optional(),
});

export const BudgetStatusSchema = z.enum([
	"on-track",
	"close-to-budget",
	"overspending",
	"no-spend",
	"unknown",
]);

export const CategoryBudgetRowSchema = z.object({
	categoryId: z.string(),
	categoryName: z.string(),
	spentThisMonth: z.number(),
	monthlyGoal: z.number().nullable().optional(),
	expectedSpendToDate: z.number(),
	status: BudgetStatusSchema,
	parentCategory: CategoryParentSchema.nullable(),
	alerts: CategoryBudgetAlertsSchema.nullable(),
});

export const BudgetReportingPeriodSchema = z.object({
	dayOfMonth: z.number(),
	daysInMonth: z.number(),
	startDate: z.string(),
	endDate: z.string(),
	isDemoSnapshot: z.boolean(),
});

export const BudgetPageDataSchema = z.object({
	categories: z.array(CategoryBudgetRowSchema),
	totalBudget: z.number(),
	actualSpent: z.number(),
	remaining: z.number(),
	expectedByNow: z.number(),
	progressPercent: z.number(),
	dayOfMonth: z.number(),
	daysInMonth: z.number(),
	status: BudgetStatusSchema,
	statusMessage: z.string(),
	reportingPeriod: BudgetReportingPeriodSchema,
});

export const MonthlySpendSchema = z.object({
	month: z.string(),
	amount: z.number(),
});

export const CategoryBudgetDetailSchema = z.object({
	categoryId: z.string(),
	categoryName: z.string(),
	spentThisMonth: z.number(),
	monthlyGoal: z.number().nullable().optional(),
	lastMonthSpend: z.number(),
	sixMonthAverage: z.number(),
	suggestedBudget: z.number(),
	monthlyTrend: z.array(MonthlySpendSchema),
});

export const WHAT_IF_BASELINE_MONTH_OPTIONS = [1, 2, 3, 6, 12] as const;
export type WhatIfBaselineMonths =
	(typeof WHAT_IF_BASELINE_MONTH_OPTIONS)[number];
export const DEFAULT_WHAT_IF_BASELINE_MONTHS = 3 satisfies WhatIfBaselineMonths;
export const WHAT_IF_OTHER_THRESHOLD = 100;

export const WhatIfBaselineMonthsSchema = z.preprocess(
	(value) => {
		if (typeof value === "string" && value.trim() !== "") {
			return Number(value);
		}
		return value;
	},
	z.union([
		z.literal(1),
		z.literal(2),
		z.literal(3),
		z.literal(6),
		z.literal(12),
	]),
);

export const GetWhatIfBaselineInputSchema = z.object({
	months: WhatIfBaselineMonthsSchema.optional(),
});

export const WhatIfMonthlyLineItemSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.enum(["income", "expense", "savings", "debt"]),
	monthlyAmount: z.number(),
	category: z.string().optional(),
	isBaseline: z.boolean(),
});

export const WhatIfBaselineSchema = z.object({
	baselineItems: z.array(WhatIfMonthlyLineItemSchema),
	baselineIncome: z.number(),
	baselineExpenses: z.number(),
	baselineSavings: z.number(),
	baselineDebt: z.number(),
});

export type WhatIfLineItemType = z.infer<
	typeof WhatIfMonthlyLineItemSchema
>["type"];

export type GetWhatIfBaselineInput = z.infer<
	typeof GetWhatIfBaselineInputSchema
>;

export type IpcBudgetPageData = z.infer<typeof BudgetPageDataSchema>;
export type IpcCategoryBudgetRow = z.infer<typeof CategoryBudgetRowSchema>;
export type IpcCategoryBudgetDetail = z.infer<
	typeof CategoryBudgetDetailSchema
>;
export type IpcWhatIfMonthlyLineItem = z.infer<
	typeof WhatIfMonthlyLineItemSchema
>;
export type IpcWhatIfBaseline = z.infer<typeof WhatIfBaselineSchema>;

const WHAT_IF_ROLLUP_TYPES = new Set<WhatIfLineItemType>(["income", "expense"]);

const WHAT_IF_ITEM_TYPE_ORDER: WhatIfLineItemType[] = [
	"income",
	"expense",
	"savings",
	"debt",
];

/** Fold income/expense lines under $100 into a single Other row, then sort each type by amount desc. */
export function consolidateSmallWhatIfItems<
	T extends {
		id: string;
		name: string;
		type: WhatIfLineItemType;
		monthlyAmount: number;
		category?: string;
		isBaseline: boolean;
	},
>(items: T[]): T[] {
	const result: T[] = [];

	for (const type of WHAT_IF_ITEM_TYPE_ORDER) {
		const typedItems = items.filter((item) => item.type === type);
		if (!WHAT_IF_ROLLUP_TYPES.has(type)) {
			result.push(
				...[...typedItems].sort((a, b) => b.monthlyAmount - a.monthlyAmount),
			);
			continue;
		}

		const kept: T[] = [];
		let otherTotal = 0;
		for (const item of typedItems) {
			if (item.monthlyAmount < WHAT_IF_OTHER_THRESHOLD) {
				otherTotal += item.monthlyAmount;
				continue;
			}
			kept.push(item);
		}

		if (otherTotal > 0) {
			kept.push({
				id: `${type}:other`,
				name: "Other",
				type,
				monthlyAmount: otherTotal,
				isBaseline: true,
			} as T);
		}

		kept.sort((a, b) => b.monthlyAmount - a.monthlyAmount);
		result.push(...kept);
	}

	return result;
}
