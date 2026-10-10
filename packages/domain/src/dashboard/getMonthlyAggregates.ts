import type { AppContext } from "../context";
import { trailingCashFlowRange } from "./trailing-cash-flow-range";

export type GetMonthlyAggregatesInput = {
	/** Number of months of history (default: 24) */
	months?: number;
	/** Override "now" — useful for demo snapshots */
	now?: Date;
};

export type MonthlyAggregate = {
	month: string;
	income: number;
	expenses: number;
	netGain: number;
};

export type MonthlyAggregatesResult = {
	avgNetGain: number;
	months: MonthlyAggregate[];
};

/**
 * Returns per-month income/expense/net-gain aggregates plus their average
 * net gain. Uses the same date window helper as Insights / getNetIncome.
 */
export async function getMonthlyAggregates(
	ctx: AppContext,
	input: GetMonthlyAggregatesInput = {},
): Promise<MonthlyAggregatesResult> {
	const months = input.months ?? 24;
	const now = input.now ?? new Date();
	const { startDate, endDate } = trailingCashFlowRange(months, now);

	const totals = await ctx.repositories.dashboard.getMonthlyTotals({
		userId: ctx.userId,
		startDate,
		endDate,
	});

	const aggregates: MonthlyAggregate[] = totals.map((m) => ({
		month: m.month,
		income: m.income,
		expenses: m.expenses,
		netGain: m.net,
	}));

	const avgNetGain =
		aggregates.length > 0
			? aggregates.reduce((s, m) => s + m.netGain, 0) / aggregates.length
			: 0;

	return { months: aggregates, avgNetGain };
}
