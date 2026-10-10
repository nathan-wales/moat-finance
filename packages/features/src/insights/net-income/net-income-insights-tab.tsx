import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api-client-context";
import type { InsightsCategoryQueryFilter } from "../insights-category-filter";
import { insightsCategoryQueryKeySuffix } from "../insights-category-filter";
import {
	buildInsightsInput,
	getInsightsQueryKeySuffix,
	type InsightsPeriodSelection,
} from "../period-utils";
import { useInsightsDrillDown } from "../use-insights-drill-down";
import {
	IncomeVsSpendingChart,
	NetIncomeSummaryCards,
	NetIncomeTrendChart,
	SavingsRateChart,
	WhereIncomeWentSection,
} from "./net-income-tab-sections";

export function NetIncomeInsightsTab({
	selection,
	categoryFilter,
}: {
	selection: InsightsPeriodSelection;
	categoryFilter?: InsightsCategoryQueryFilter;
}) {
	const api = useApiClient();
	const queryKeySuffix = getInsightsQueryKeySuffix(selection);
	const insightsInput = buildInsightsInput(selection, categoryFilter);

	const query = useQuery({
		queryKey: [
			"insights",
			"netIncome",
			queryKeySuffix,
			insightsCategoryQueryKeySuffix(categoryFilter ?? {}),
		],
		queryFn: () => api.getNetIncomeInsights(insightsInput),
		enabled:
			selection.period !== "custom" ||
			Boolean(insightsInput.startDate && insightsInput.endDate),
	});

	const data = query.data;
	const { navigateByBucket, navigateByCategory, navigateByCategories } =
		useInsightsDrillDown(selection);

	return (
		<div className="space-y-6">
			<NetIncomeSummaryCards
				data={data}
				isLoading={query.isLoading}
				selection={selection}
			/>

			<IncomeVsSpendingChart
				data={data}
				isError={query.isError}
				isLoading={query.isLoading}
				onBucketClick={({ dateKey, type }) => navigateByBucket(dateKey, type)}
			/>

			<div className="grid gap-6 lg:grid-cols-2">
				<NetIncomeTrendChart
					data={data}
					isError={query.isError}
					isLoading={query.isLoading}
					onBucketClick={navigateByBucket}
				/>
				<SavingsRateChart
					data={data}
					isError={query.isError}
					isLoading={query.isLoading}
					onBucketClick={navigateByBucket}
				/>
			</div>

			<WhereIncomeWentSection
				data={data}
				isError={query.isError}
				isLoading={query.isLoading}
				onCategoryClick={navigateByCategory}
				onParentClick={navigateByCategories}
				selection={selection}
			/>
		</div>
	);
}
