import { POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL } from "@moat/data-access";
import { getSpendingBreakdown, resolveSpendingDateRange } from "@moat/domain";
import { startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { Prisma } from "../../../generated/prisma";
import {
	CANONICAL_DATE_SQL,
	parseOptionalCategoryNames,
	transactionScopeSql,
} from "../../lib/transaction-scope";
import { createApiAppContext } from "../createApiAppContext";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";
import { getEffectiveNow } from "../lib/reporting-period";
import { listRecurringExpenses } from "../services/recurring-expenses";

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

const spendingRangeInputSchema = z
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

function parseSpendingRangeInput(body: unknown, defaultMonths: number) {
	const rawInput =
		typeof body === "object" && body !== null
			? (body as {
					months?: unknown;
					startDate?: unknown;
					endDate?: unknown;
					expenseCategories?: unknown;
				})
			: {};
	const parsed = spendingRangeInputSchema.parse({
		months: rawInput.months ?? defaultMonths,
		startDate: rawInput.startDate,
		endDate: rawInput.endDate,
		expenseCategories: parseOptionalCategoryNames(rawInput.expenseCategories),
	});
	if (parsed.startDate && parsed.endDate) {
		return {
			startDate: parsed.startDate,
			endDate: parsed.endDate,
			expenseCategories: parsed.expenseCategories,
		};
	}

	return {
		months: parsed.months ?? defaultMonths,
		expenseCategories: parsed.expenseCategories,
	};
}

export const spending = {
	getCategoryBreakdown: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = parseSpendingRangeInput(body, 3);
			const appCtx = createApiAppContext(ctx.userId, ctx.db);
			return getSpendingBreakdown(appCtx, {
				...input,
				now: getEffectiveNow(ctx),
			});
		},
	),

	getCategoryTrends: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = parseSpendingRangeInput(body, 12);
			const { userId } = ctx;
			const { startDate, endDate } = resolveSpendingDateRange({
				...input,
				now: getEffectiveNow(ctx),
			});

			const where = transactionScopeSql({
				userId,
				startDate,
				endDate,
				type: "EXPENSE",
				categoryNames: input.expenseCategories,
			});

			const rows = await ctx.db.$queryRaw<
				{
					year: number;
					month: number;
					category: string;
					total: number;
				}[]
			>(Prisma.sql`
			SELECT
				EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
				EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
				COALESCE(o.name, c.name, 'Uncategorized') AS category,
				SUM(t.amount)::float AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t."categoryId" = c.id
			${Prisma.raw(POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL)}
			WHERE ${where}
			GROUP BY 1, 2, 3
			ORDER BY 1, 2
		`);

			const categorySet = new Set<string>();
			const grouped = new Map<string, Map<string, number>>();
			for (const row of rows) {
				const monthKey = `${row.year}-${String(row.month).padStart(2, "0")}`;
				let cats = grouped.get(monthKey);
				if (!cats) {
					cats = new Map();
					grouped.set(monthKey, cats);
				}
				cats.set(row.category, row.total);
				categorySet.add(row.category);
			}

			const months = Array.from(grouped.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, cats]) => ({
					month,
					...Object.fromEntries(cats),
				}));

			return { months, categories: Array.from(categorySet).sort() };
		},
	),

	getRecurringExpenses: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const expenseCategories = parseOptionalCategoryNames(
				typeof body === "object" && body !== null
					? (body as { expenseCategories?: unknown }).expenseCategories
					: undefined,
			);
			return listRecurringExpenses(
				ctx.db,
				ctx.userId,
				getEffectiveNow(ctx),
				expenseCategories,
			);
		},
	),

	getAnomalies: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const { userId } = ctx;
			const expenseCategories = parseOptionalCategoryNames(
				typeof body === "object" && body !== null
					? (body as { expenseCategories?: unknown }).expenseCategories
					: undefined,
			);

			const effectiveNow = getEffectiveNow(ctx);
			const startDate = startOfMonth(subMonths(effectiveNow, 5));
			const currentMonthStart = startOfMonth(effectiveNow);
			const where = transactionScopeSql({
				userId,
				startDate,
				type: "EXPENSE",
				categoryNames: expenseCategories,
			});

			// Pre-aggregate to (category × canonical month) instead of fetching raw rows
			const rows = await ctx.db.$queryRaw<
				{
					category: string;
					year: number;
					month: number;
					total: number;
				}[]
			>(Prisma.sql`
			SELECT
				COALESCE(o.name, c.name, 'Uncategorized') AS category,
				EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
				EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
				SUM(t.amount)::float AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t."categoryId" = c.id
			${Prisma.raw(POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL)}
			WHERE ${where}
			GROUP BY 1, 2, 3
		`);

			// SQL EXTRACT returns 1-indexed months; match with getMonth()+1
			const currentMonthKey = `${currentMonthStart.getFullYear()}-${currentMonthStart.getMonth() + 1}`;
			const catMonthly = new Map<string, Map<string, number>>();

			for (const row of rows) {
				const monthKey = `${row.year}-${row.month}`;
				let m = catMonthly.get(row.category);
				if (!m) {
					m = new Map();
					catMonthly.set(row.category, m);
				}
				m.set(monthKey, row.total);
			}

			const anomalies: {
				category: string;
				currentAmount: number;
				averageAmount: number;
				ratio: number;
			}[] = [];

			for (const [category, monthMap] of catMonthly) {
				const currentAmount = monthMap.get(currentMonthKey) ?? 0;
				if (currentAmount === 0) continue;

				const historicalAmounts = Array.from(monthMap.entries())
					.filter(([m]) => m !== currentMonthKey)
					.map(([, v]) => v);

				if (historicalAmounts.length < 2) continue;

				const avg =
					historicalAmounts.reduce((s, v) => s + v, 0) /
					historicalAmounts.length;

				if (avg > 0 && currentAmount > avg * 1.75) {
					anomalies.push({
						category,
						currentAmount,
						averageAmount: avg,
						ratio: currentAmount / avg,
					});
				}
			}

			return anomalies.sort((a, b) => b.ratio - a.ratio);
		},
	),
};
