import { z } from "zod";
import { CategoryParentSchema } from "../category-parent";

export const SPENDING_CHANNELS = {
	getCategoryBreakdown: "spending:getCategoryBreakdown",
	getCategoryTrends: "spending:getCategoryTrends",
	getRecurringExpenses: "spending:getRecurringExpenses",
	getAnomalies: "spending:getAnomalies",
} as const;

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

const spendingDateParamSchema = z.string().refine(isDateParam, {
	message: "Date must be a valid YYYY-MM-DD value",
});

export const SpendingQueryInputSchema = z
	.object({
		months: z.number().min(1).max(60).optional(),
		startDate: spendingDateParamSchema.optional(),
		endDate: spendingDateParamSchema.optional(),
		expenseCategories: z.array(z.string()).optional(),
	})
	.superRefine((input, ctx) => {
		const hasCustomRange = Boolean(input.startDate || input.endDate);

		if (hasCustomRange && (!input.startDate || !input.endDate)) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Both startDate and endDate are required for custom range",
			});
			return;
		}

		if (!hasCustomRange && input.months === undefined) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "Either months or a custom date range is required",
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

export const SpendingBreakdownItemSchema = z.object({
	category: z.string(),
	total: z.number(),
	percentage: z.number(),
	monthlyAvg: z.number(),
	percentOfTop: z.number(),
	parentCategory: CategoryParentSchema.nullable(),
});

export const SpendingBreakdownResponseSchema = z.array(
	SpendingBreakdownItemSchema,
);

export const SpendingTrendRowSchema = z.object({
	month: z.string(),
	categories: z.record(z.number()),
});

export const SpendingTrendMonthSchema = z
	.object({
		month: z.string(),
	})
	.catchall(z.unknown());

export const SpendingTrendsResponseSchema = z.object({
	months: z.array(SpendingTrendMonthSchema),
	categories: z.array(z.string()),
});

export const RecurringExpenseSchema = z.object({
	description: z.string(),
	monthlyAmount: z.number(),
	occurrences: z.number(),
});

export const SpendingAnomalySchema = z.object({
	category: z.string(),
	currentAmount: z.number(),
	averageAmount: z.number(),
	ratio: z.number(),
});

export type IpcSpendingBreakdownResponse = z.infer<
	typeof SpendingBreakdownResponseSchema
>;
export type IpcSpendingTrendsResponse = z.infer<
	typeof SpendingTrendsResponseSchema
>;
export type IpcRecurringExpense = z.infer<typeof RecurringExpenseSchema>;
export type IpcSpendingAnomaly = z.infer<typeof SpendingAnomalySchema>;
