import { z } from "zod";
import { CategoryParentSchema } from "../category-parent";

export const INSIGHTS_CHANNELS = {
	getIncomeInsights: "insights:getIncomeInsights",
	getNetIncomeInsights: "insights:getNetIncomeInsights",
	getCategoryActivity: "insights:getCategoryActivity",
} as const;

export const InsightsPeriodSchema = z.enum([
	"this-week",
	"last-week",
	"this-month",
	"last-month",
	"1m",
	"2m",
	"3m",
	"6m",
	"12m",
	"custom",
]);

function isDateParam(value: string): boolean {
	const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
	if (!match) return false;

	const [, yearValue, monthValue, dayValue] = match;
	const year = Number(yearValue);
	const month = Number(monthValue);
	const day = Number(dayValue);
	const date = new Date(year, month - 1, day);

	return (
		date.getFullYear() === year &&
		date.getMonth() === month - 1 &&
		date.getDate() === day
	);
}

const insightsDateParamSchema = z.string().refine(isDateParam, {
	message: "Date must be a valid YYYY-MM-DD value",
});

export const InsightsInputSchema = z
	.object({
		period: InsightsPeriodSchema.default("this-month"),
		startDate: insightsDateParamSchema.optional(),
		endDate: insightsDateParamSchema.optional(),
		incomeCategories: z.array(z.string()).optional(),
		expenseCategories: z.array(z.string()).optional(),
	})
	.superRefine((input, ctx) => {
		if (input.period !== "custom") {
			return;
		}

		if (!input.startDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "startDate is required for custom period",
				path: ["startDate"],
			});
		}

		if (!input.endDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "endDate is required for custom period",
				path: ["endDate"],
			});
		}

		if (input.startDate && input.endDate && input.startDate >= input.endDate) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "startDate must be before endDate",
				path: ["startDate"],
			});
		}
	});

export const IncomeInsightsDataSchema = z.object({
	totalIncome: z.number(),
	primarySource: z
		.object({
			name: z.string(),
			amount: z.number(),
		})
		.nullable(),
	recurringIncome: z.number(),
	oneTimeIncome: z.number(),
	incomeTrend: z.array(
		z.object({
			date: z.string(),
			amount: z.number(),
		}),
	),
	incomeSources: z.array(
		z.object({
			source: z.string(),
			amount: z.number(),
		}),
	),
	recentIncomeTransactions: z.array(
		z.object({
			id: z.string(),
			date: z.string(),
			name: z.string(),
			amount: z.number(),
			accountName: z.string().optional(),
			category: z.string().optional(),
		}),
	),
});

export const NetIncomeInsightsDataSchema = z.object({
	totalIncome: z.number(),
	totalSpending: z.number(),
	netIncome: z.number(),
	savingsRate: z.number().nullable(),
	incomeVsSpending: z.array(
		z.object({
			date: z.string(),
			income: z.number(),
			spending: z.number(),
		}),
	),
	netIncomeTrend: z.array(
		z.object({
			date: z.string(),
			netIncome: z.number(),
		}),
	),
	savingsRateTrend: z.array(
		z.object({
			date: z.string(),
			savingsRate: z.number().nullable(),
		}),
	),
	spendingBreakdown: z.array(
		z.object({
			category: z.string(),
			amount: z.number(),
			parentCategory: CategoryParentSchema.nullable(),
		}),
	),
});

export const InsightsCategoryActivitySchema = z.object({
	income: z.array(z.string()),
	expense: z.array(z.string()),
});

export type IpcInsightsCategoryActivity = z.infer<
	typeof InsightsCategoryActivitySchema
>;

export type IpcIncomeInsightsData = z.infer<typeof IncomeInsightsDataSchema>;
export type IpcNetIncomeInsightsData = z.infer<
	typeof NetIncomeInsightsDataSchema
>;
