import type { CategoryParent, Transaction } from "@moat/contracts";
import { z } from "zod";

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
export type InsightsPeriod = z.infer<typeof InsightsPeriodSchema>;

export const InsightsTabSchema = z.enum(["net-income", "income", "spending"]);
export type InsightsTab = z.infer<typeof InsightsTabSchema>;

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

export type InsightsInput = z.infer<typeof InsightsInputSchema>;

type RecentIncomeTransaction = Transaction & {
	name: string;
	accountName?: string;
};

export type IncomeInsightsData = {
	totalIncome: number;
	primarySource: { name: string; amount: number } | null;
	recurringIncome: number;
	oneTimeIncome: number;
	incomeTrend: Array<{ date: string; amount: number }>;
	incomeSources: Array<{ source: string; amount: number }>;
	recentIncomeTransactions: RecentIncomeTransaction[];
};

export type NetIncomeInsightsData = {
	totalIncome: number;
	totalSpending: number;
	netIncome: number;
	savingsRate: number | null;
	incomeVsSpending: Array<{ date: string; income: number; spending: number }>;
	netIncomeTrend: Array<{ date: string; netIncome: number }>;
	savingsRateTrend: Array<{ date: string; savingsRate: number | null }>;
	spendingBreakdown: Array<{
		category: string;
		amount: number;
		parentCategory: CategoryParent | null;
	}>;
};
