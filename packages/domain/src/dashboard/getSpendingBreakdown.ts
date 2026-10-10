import type { CategoryParent } from "@moat/contracts";
import {
	differenceInCalendarMonths,
	endOfDay,
	parseISO,
	startOfDay,
	startOfMonth,
	subMonths,
} from "date-fns";
import type { AppContext } from "../context";

export type GetSpendingBreakdownInput = {
	/** Number of months to aggregate (default: 3) */
	months?: number;
	startDate?: string;
	endDate?: string;
	/** Override "now" — useful for demo snapshots */
	now?: Date;
	expenseCategories?: string[];
};

export type SpendingBreakdownRow = {
	category: string;
	total: number;
	monthlyAvg: number;
	/** Percentage of total spending across all categories */
	percentage: number;
	/** Percentage of the top category's spend */
	percentOfTop: number;
	parentCategory: CategoryParent | null;
};

function parseSpendingDateParam(value: string): Date {
	return startOfDay(parseISO(value));
}

function resolveSpendingDateRange(input: GetSpendingBreakdownInput): {
	startDate: Date;
	endDate: Date;
	monthCount: number;
} {
	if (input.startDate && input.endDate) {
		const startDate = parseSpendingDateParam(input.startDate);
		const endDate = endOfDay(parseSpendingDateParam(input.endDate));
		const monthCount = Math.max(
			1,
			differenceInCalendarMonths(endDate, startDate) + 1,
		);
		return { startDate, endDate, monthCount };
	}

	const months = input.months ?? 3;
	const now = input.now ?? new Date();
	return {
		startDate: startOfMonth(subMonths(now, months - 1)),
		endDate: endOfDay(now),
		monthCount: months,
	};
}

/**
 * Returns a ranked list of expense categories with spend totals and
 * relative percentages for the given time window.
 *
 * This is the domain equivalent of the `spending.getCategoryBreakdown` handler.
 */
export async function getSpendingBreakdown(
	ctx: AppContext,
	input: GetSpendingBreakdownInput = {},
): Promise<SpendingBreakdownRow[]> {
	const { startDate, endDate, monthCount } = resolveSpendingDateRange(input);

	const rows = await ctx.repositories.dashboard.getCategoryBreakdown({
		userId: ctx.userId,
		startDate,
		endDate,
		type: "EXPENSE",
	});
	const allowedNames = input.expenseCategories
		? new Set(input.expenseCategories.map((name) => name.trim().toLowerCase()))
		: null;
	const filteredRows =
		allowedNames === null
			? rows
			: rows.filter((row) => allowedNames.has(row.category.toLowerCase()));

	const totalSpend = filteredRows.reduce((s, r) => s + r.total, 0);
	const topTotal = filteredRows[0]?.total ?? 1;

	return filteredRows.map((r) => ({
		category: r.category,
		total: r.total,
		monthlyAvg: r.total / monthCount,
		percentage: totalSpend > 0 ? (r.total / totalSpend) * 100 : 0,
		percentOfTop: topTotal > 0 ? (r.total / topTotal) * 100 : 0,
		parentCategory: r.parentCategory ?? null,
	}));
}

export { resolveSpendingDateRange };
