import type { InsightsPeriod, InsightsTab } from "@moat/contracts";
import type { DateRange } from "@moat/ui";
import { useQuery } from "@tanstack/react-query";
import { format } from "date-fns";
import { useEffect } from "react";
import { useApiClient } from "../api-client-context";
import { useMoatNavigation } from "../navigation-context";
import { IncomeInsightsTab } from "./income/income-insights-tab";
import type { InsightsCategoryQueryFilter } from "./insights-category-filter";
import { InsightsCategoryFilterPopover } from "./insights-category-filter-popover";
import { InsightsChartRequestCtas } from "./insights-chart-request-ctas";
import { InsightsPeriodSelector } from "./insights-period-selector";
import { InsightsTabs } from "./insights-tabs";
import { NetIncomeInsightsTab } from "./net-income/net-income-insights-tab";
import {
	buildInsightsInput,
	DEFAULT_INSIGHTS_PERIOD,
	getAppliedInsightsDateRange,
	getInsightsQueryKeySuffix,
	type InsightsPeriodSelection,
	parseInsightsCustomDateRange,
	parseInsightsPeriod,
	parseInsightsTab,
} from "./period-utils";
import { SpendingInsightsTab } from "./spending-insights-tab";
import { useInsightsCategoryFilter } from "./use-insights-category-filter";

export type InsightsPageProps = {
	onFeatureRequest: (initialMessage: string) => void;
	openAiAccess: () => void;
};

function formatDateParam(date: Date) {
	return format(date, "yyyy-MM-dd");
}

function buildInsightsPath({
	tab,
	period,
	customDateRange,
}: {
	tab: InsightsTab;
	period: InsightsPeriod;
	customDateRange?: DateRange;
}) {
	const params = new URLSearchParams();
	params.set("tab", tab);
	params.set("period", period);

	const appliedCustomRange = getAppliedInsightsDateRange(customDateRange);
	if (period === "custom" && appliedCustomRange) {
		params.set("from", formatDateParam(appliedCustomRange.from));
		params.set("to", formatDateParam(appliedCustomRange.to));
	}

	return `/insights?${params.toString()}`;
}

function InsightsTabContent({
	tab,
	selection,
	categoryFilter,
}: {
	tab: InsightsTab;
	selection: InsightsPeriodSelection;
	categoryFilter: InsightsCategoryQueryFilter;
}) {
	if (tab === "income") {
		return (
			<IncomeInsightsTab
				categoryFilter={categoryFilter}
				selection={selection}
			/>
		);
	}

	if (tab === "net-income") {
		return (
			<NetIncomeInsightsTab
				categoryFilter={categoryFilter}
				selection={selection}
			/>
		);
	}

	return (
		<SpendingInsightsTab
			categoryFilter={categoryFilter}
			selection={selection}
		/>
	);
}

export function InsightsPage({
	onFeatureRequest,
	openAiAccess,
}: InsightsPageProps) {
	const nav = useMoatNavigation();
	const tabParam = nav.getSearchParam("tab");
	const periodParam = nav.getSearchParam("period");
	const fromParam = nav.getSearchParam("from");
	const toParam = nav.getSearchParam("to");
	const tab = parseInsightsTab(tabParam);
	const period = parseInsightsPeriod(periodParam ?? DEFAULT_INSIGHTS_PERIOD);
	const customDateRange =
		period === "custom"
			? parseInsightsCustomDateRange(fromParam, toParam)
			: undefined;
	const selection: InsightsPeriodSelection = { period, customDateRange };
	const api = useApiClient();
	const { data: categories = [] } = useQuery({
		queryKey: ["category-management", "list"],
		queryFn: () => api.listCategories(),
	});
	const activityInput = buildInsightsInput(selection);
	const activityQueryEnabled =
		selection.period !== "custom" ||
		Boolean(activityInput.startDate && activityInput.endDate);
	const { data: categoryActivity } = useQuery({
		queryKey: [
			"insights",
			"category-activity",
			getInsightsQueryKeySuffix(selection),
		],
		queryFn: () => api.getInsightsCategoryActivity(activityInput),
		enabled: activityQueryEnabled,
	});
	const categoryFilterState = useInsightsCategoryFilter(
		categories,
		activityQueryEnabled ? categoryActivity : undefined,
	);
	const categoryFilter: InsightsCategoryQueryFilter = {
		incomeCategories: categoryFilterState.incomeCategories,
		expenseCategories: categoryFilterState.expenseCategories,
	};

	useEffect(() => {
		const canonicalTab = parseInsightsTab(tabParam);
		const canonicalPeriod = parseInsightsPeriod(
			periodParam ?? DEFAULT_INSIGHTS_PERIOD,
		);
		const appliedCustomRange = getAppliedInsightsDateRange(
			canonicalPeriod === "custom"
				? parseInsightsCustomDateRange(fromParam, toParam)
				: undefined,
		);

		if (canonicalPeriod === "custom" && !appliedCustomRange) {
			return;
		}

		const nextFrom =
			canonicalPeriod === "custom" && appliedCustomRange
				? formatDateParam(appliedCustomRange.from)
				: null;
		const nextTo =
			canonicalPeriod === "custom" && appliedCustomRange
				? formatDateParam(appliedCustomRange.to)
				: null;

		if (
			tabParam === canonicalTab &&
			periodParam === canonicalPeriod &&
			fromParam === nextFrom &&
			toParam === nextTo
		) {
			return;
		}

		nav.replace(
			buildInsightsPath({
				tab: canonicalTab,
				period: canonicalPeriod,
				customDateRange:
					canonicalPeriod === "custom" ? appliedCustomRange : undefined,
			}),
		);
	}, [fromParam, nav, periodParam, tabParam, toParam]);

	function handleTabChange(nextTab: InsightsTab) {
		nav.replace(
			buildInsightsPath({
				tab: nextTab,
				period,
				customDateRange,
			}),
		);
	}

	function handlePeriodChange(nextPeriod: InsightsPeriod) {
		nav.replace(buildInsightsPath({ tab, period: nextPeriod }));
	}

	function handleCustomDateRangeChange(range: DateRange | undefined) {
		const appliedCustomRange = getAppliedInsightsDateRange(range);

		if (!appliedCustomRange) {
			nav.removeSearchParam("from");
			nav.removeSearchParam("to");
			return;
		}

		nav.replace(
			buildInsightsPath({
				tab,
				period: "custom",
				customDateRange: appliedCustomRange,
			}),
		);
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<div className="space-y-4">
				<div>
					<h1 className="font-bold text-2xl tracking-tight">Insights</h1>
					<p className="text-muted-foreground text-sm">
						Understand what you keep, your income, and spending each month
					</p>
				</div>

				<div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
					<InsightsTabs onTabChange={handleTabChange} tab={tab} />
					<div className="flex items-center gap-2">
						<InsightsPeriodSelector
							customDateRange={customDateRange}
							onCustomDateRangeChange={handleCustomDateRangeChange}
							onPeriodChange={handlePeriodChange}
							period={period}
						/>
						<InsightsCategoryFilterPopover
							exclusions={categoryFilterState.exclusions}
							expenseNames={categoryFilterState.groups.expense}
							incomeNames={categoryFilterState.groups.income}
							isFiltered={categoryFilterState.isFiltered}
							onSave={categoryFilterState.setExclusions}
						/>
					</div>
				</div>
			</div>

			<InsightsTabContent
				categoryFilter={categoryFilter}
				selection={selection}
				tab={tab}
			/>

			<div className="pt-4">
				<InsightsChartRequestCtas
					onFeatureRequest={onFeatureRequest}
					openAiAccess={openAiAccess}
					tab={tab}
				/>
			</div>
		</div>
	);
}
