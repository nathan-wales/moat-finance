import type { MonthlyTotals } from "@moat/data-access";
import type { AppContext } from "../context";
import { trailingCashFlowRange } from "./trailing-cash-flow-range";

export type NetIncomeSummary = {
	totalIncome: number;
	totalSpending: number;
	netIncome: number;
	savingsRate: number | null;
	monthCount: number;
	monthlyTotals: MonthlyTotals[];
};

export type GetNetIncomeInput = {
	/** Trailing window length in months (default: 12 — Insights 12M). */
	months?: number;
	/** Override "now" — useful for demo snapshots and tests. */
	now?: Date;
	startDate?: Date;
	endDate?: Date;
};

export function computeSavingsRate(
	income: number,
	netIncome: number,
): number | null {
	if (income <= 0) return null;
	return netIncome / income;
}

/**
 * Pure Insights net-income card math. Both Insights and retirement must use
 * this so the two surfaces cannot drift.
 */
export function summarizeNetIncome(
	monthlyTotals: MonthlyTotals[],
): Omit<NetIncomeSummary, "monthlyTotals"> {
	const totalIncome = monthlyTotals.reduce((sum, row) => sum + row.income, 0);
	const totalSpending = monthlyTotals.reduce(
		(sum, row) => sum + row.expenses,
		0,
	);
	const netIncome = totalIncome - totalSpending;
	return {
		totalIncome,
		totalSpending,
		netIncome,
		savingsRate: computeSavingsRate(totalIncome, netIncome),
		monthCount: monthlyTotals.length,
	};
}

/**
 * Loads trailing monthly totals and summarizes them exactly like Insights.
 */
export async function getNetIncome(
	ctx: AppContext,
	input: GetNetIncomeInput = {},
): Promise<NetIncomeSummary> {
	const now = input.now ?? new Date();
	const range =
		input.startDate !== undefined && input.endDate !== undefined
			? { startDate: input.startDate, endDate: input.endDate }
			: trailingCashFlowRange(input.months ?? 12, now);

	const monthlyTotals = await ctx.repositories.dashboard.getMonthlyTotals({
		userId: ctx.userId,
		startDate: range.startDate,
		endDate: range.endDate,
	});

	return {
		...summarizeNetIncome(monthlyTotals),
		monthlyTotals,
	};
}
