import type { AppContext } from "../context";
import { getNetIncome } from "./get-net-income";

export type GetSummaryMetricsInput = {
	/** Number of months of history to include (default: 12) */
	months?: number;
	/** Override "now" — useful for demo snapshots */
	now?: Date;
};

export type SummaryMetrics = {
	avgExpenses: number;
	avgIncome: number;
	avgNetGain: number;
	monthCount: number;
};

/**
 * Computes rolling average income/expense/net-gain metrics across the
 * given number of months. Uses the same monthly-totals query and date
 * window as Insights net income so overview and Insights cannot drift.
 */
export async function getSummaryMetrics(
	ctx: AppContext,
	input: GetSummaryMetricsInput = {},
): Promise<SummaryMetrics> {
	const months = input.months ?? 12;
	const summary = await getNetIncome(ctx, {
		months,
		now: input.now,
	});

	const count = summary.monthCount || 1;
	const avgIncome = summary.totalIncome / count;
	const avgExpenses = summary.totalSpending / count;
	const avgNetGain = avgIncome - avgExpenses;

	return {
		avgIncome,
		avgExpenses,
		avgNetGain,
		monthCount: summary.monthCount,
	};
}
