import type { CategoryBreakdown, RecurringExpense } from "@moat/contracts";
import { formatCurrency } from "../chart-utils";
import { InsightsSummaryCard } from "../insights-summary-card";
import {
	type InsightsPeriodSelection,
	insightsMonthlyAverage,
	showsInsightsMonthlyAverage,
} from "../period-utils";

export function SpendingSummaryCards({
	breakdown,
	recurringExpenses,
	isBreakdownLoading,
	isRecurringLoading,
	selection,
}: {
	breakdown: CategoryBreakdown[];
	recurringExpenses: RecurringExpense[];
	isBreakdownLoading: boolean;
	isRecurringLoading: boolean;
	selection: InsightsPeriodSelection;
}) {
	const totalSpending = breakdown.reduce((sum, row) => sum + row.total, 0);
	const monthlyAverage = insightsMonthlyAverage(totalSpending, selection);
	const showMonthlyAverage = showsInsightsMonthlyAverage(selection);
	const summaryGridClassName = showMonthlyAverage
		? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";
	const topCategory = breakdown[0];
	const recurringTotal = recurringExpenses.reduce(
		(sum, expense) => sum + expense.monthlyAmount,
		0,
	);

	return (
		<div className={summaryGridClassName}>
			<InsightsSummaryCard
				isLoading={isBreakdownLoading}
				title="Total Spending"
				value={formatCurrency(totalSpending)}
			/>
			{showMonthlyAverage && (
				<InsightsSummaryCard
					isLoading={isBreakdownLoading}
					title="Monthly Average"
					value={formatCurrency(monthlyAverage)}
				/>
			)}
			<InsightsSummaryCard
				isLoading={isBreakdownLoading}
				subtitle={topCategory ? formatCurrency(topCategory.total) : undefined}
				title="Top Category"
				value={topCategory?.category ?? "—"}
			/>
			<InsightsSummaryCard
				isLoading={isRecurringLoading}
				title="Recurring Expenses"
				value={formatCurrency(recurringTotal)}
			/>
		</div>
	);
}
