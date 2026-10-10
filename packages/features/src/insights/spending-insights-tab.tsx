import type { CategoryBreakdown } from "@moat/contracts";
import { useQuery } from "@tanstack/react-query";
import { useMemo } from "react";
import { useApiClient } from "../api-client-context";
import {
	CATEGORY_VIEW_STORAGE_KEYS,
	rollupSpendByParent,
} from "../categories/category-parent";
import { usePersistedCategoryView } from "../categories/use-persisted-category-view";
import { CategoryTrendsCard } from "../spending/category-trends-card";
import { RecurringExpensesCard } from "../spending/recurring-expenses-card";
import { SpendingAnomalyAlerts } from "../spending/spending-anomaly-alerts";
import { SpendingDistributionCard } from "../spending/spending-distribution-card";
import { TopSpendingCategoriesCard } from "../spending/top-spending-categories-card";
import type { InsightsCategoryQueryFilter } from "./insights-category-filter";
import { insightsCategoryQueryKeySuffix } from "./insights-category-filter";
import {
	buildSpendingInput,
	getCustomRangeMonthCount,
	getInsightsPeriodMonthCount,
	getInsightsQueryKeySuffix,
	type InsightsPeriodSelection,
	insightsPeriodToMonths,
} from "./period-utils";
import { SpendingSummaryCards } from "./spending/spending-tab-sections";
import { useInsightsDrillDown } from "./use-insights-drill-down";

export function SpendingInsightsTab({
	selection,
	categoryFilter,
}: {
	selection: InsightsPeriodSelection;
	categoryFilter?: InsightsCategoryQueryFilter;
}) {
	const api = useApiClient();
	const queryKeySuffix = getInsightsQueryKeySuffix(selection);
	const categoryKey = insightsCategoryQueryKeySuffix(categoryFilter ?? {});
	const months = insightsPeriodToMonths(selection.period);
	const trendMonths =
		selection.period === "custom" && selection.customDateRange
			? Math.max(getCustomRangeMonthCount(selection.customDateRange), 3)
			: Math.max(months, 3);
	const spendingInput = buildSpendingInput(
		selection,
		undefined,
		categoryFilter?.expenseCategories,
	);
	const trendInput = buildSpendingInput(
		selection,
		trendMonths,
		categoryFilter?.expenseCategories,
	);
	const hasCustomRange = Boolean(
		spendingInput.startDate && spendingInput.endDate,
	);

	const breakdownQuery = useQuery({
		queryKey: [
			"insights",
			"spending",
			"categoryBreakdown",
			queryKeySuffix,
			categoryKey,
		],
		queryFn: () => api.getSpendingCategoryBreakdown(spendingInput),
		enabled: selection.period !== "custom" || hasCustomRange,
	});

	const trendsQuery = useQuery({
		queryKey: [
			"insights",
			"spending",
			"categoryTrends",
			queryKeySuffix,
			trendMonths,
			categoryKey,
		],
		queryFn: () => api.getSpendingCategoryTrends(trendInput),
		enabled: selection.period !== "custom" || hasCustomRange,
	});

	const recurringQuery = useQuery({
		queryKey: ["insights", "spending", "recurringExpenses", categoryKey],
		queryFn: () =>
			api.getRecurringExpenses({
				expenseCategories: categoryFilter?.expenseCategories,
			}),
	});

	const anomaliesQuery = useQuery({
		queryKey: ["insights", "spending", "anomalies", categoryKey],
		queryFn: () =>
			api.getSpendingAnomalies({
				expenseCategories: categoryFilter?.expenseCategories,
			}),
	});

	const breakdown = breakdownQuery.data ?? [];
	const [view, setView] = usePersistedCategoryView(
		CATEGORY_VIEW_STORAGE_KEYS.insightsSpending,
	);
	const parentBreakdown = useMemo((): CategoryBreakdown[] => {
		const rolled = rollupSpendByParent(
			breakdown.map((row) => ({
				category: row.category,
				amount: row.total,
				parentCategory: row.parentCategory,
				monthlyAvg: row.monthlyAvg,
			})),
		);
		return rolled.map((row) => ({
			category: row.label,
			total: row.amount,
			monthlyAvg: row.monthlyAvg,
			percentage: row.percentage,
			percentOfTop: row.percentOfTop,
			parentCategory: row.parent,
		}));
	}, [breakdown]);
	const visibleBreakdown =
		view === "parent" ? parentBreakdown : breakdown.slice(0, 8);
	const {
		navigateByBucket,
		navigateByCategory,
		navigateByCategories,
		navigateByCategoryInMonth,
	} = useInsightsDrillDown(selection);

	function handleBreakdownClick(name: string) {
		if (view === "parent") {
			const match = parentBreakdown.find((row) => row.category === name);
			navigateByCategories(
				breakdown
					.filter((row) => row.parentCategory === match?.parentCategory)
					.map((row) => row.category),
			);
			return;
		}
		navigateByCategory(name);
	}

	return (
		<div className="space-y-6">
			<SpendingSummaryCards
				breakdown={breakdown}
				isBreakdownLoading={breakdownQuery.isLoading}
				isRecurringLoading={recurringQuery.isLoading}
				recurringExpenses={recurringQuery.data ?? []}
				selection={selection}
			/>

			<SpendingAnomalyAlerts anomalies={anomaliesQuery.data ?? []} />

			<div className="grid gap-6 lg:grid-cols-2">
				<TopSpendingCategoriesCard
					breakdown={visibleBreakdown}
					isError={breakdownQuery.isError}
					isLoading={breakdownQuery.isLoading}
					onCategoryClick={handleBreakdownClick}
					onViewChange={setView}
					showMonthlyAverage={getInsightsPeriodMonthCount(selection) >= 2}
					view={view}
				/>
				<SpendingDistributionCard
					breakdown={visibleBreakdown}
					isError={breakdownQuery.isError}
					isLoading={breakdownQuery.isLoading}
					onCategoryClick={handleBreakdownClick}
				/>
			</div>

			<CategoryTrendsCard
				isError={trendsQuery.isError}
				isLoading={trendsQuery.isLoading}
				onTrendClick={({ month, category }) => {
					if (category) {
						navigateByCategoryInMonth(category, month);
						return;
					}
					navigateByBucket(month, "EXPENSE");
				}}
				trends={trendsQuery.data}
			/>

			<RecurringExpensesCard
				isError={recurringQuery.isError}
				isLoading={recurringQuery.isLoading}
				recurringExpenses={recurringQuery.data ?? []}
			/>
		</div>
	);
}
