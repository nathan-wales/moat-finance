import { useQuery } from "@tanstack/react-query";
import { useApiClient } from "../../api-client-context";
import { TransactionEditLayer } from "../../transactions/transaction-edit-layer";
import type { InsightsCategoryQueryFilter } from "../insights-category-filter";
import { insightsCategoryQueryKeySuffix } from "../insights-category-filter";
import {
	buildInsightsInput,
	getInsightsQueryKeySuffix,
	type InsightsPeriodSelection,
} from "../period-utils";
import { useInsightsDrillDown } from "../use-insights-drill-down";
import {
	IncomeSourcesChart,
	IncomeSummaryCards,
	IncomeTrendChart,
	RecentIncomeList,
	RecurringVsOneTimeSection,
} from "./income-tab-sections";

export function IncomeInsightsTab({
	selection,
	categoryFilter,
}: {
	selection: InsightsPeriodSelection;
	categoryFilter?: InsightsCategoryQueryFilter;
}) {
	const api = useApiClient();
	const queryKeySuffix = getInsightsQueryKeySuffix(selection);
	const insightsInput = buildInsightsInput(selection, categoryFilter);
	const insightsQueryKey = [
		"insights",
		"income",
		queryKeySuffix,
		insightsCategoryQueryKeySuffix(categoryFilter ?? {}),
	] as const;

	const query = useQuery({
		queryKey: insightsQueryKey,
		queryFn: () => api.getIncomeInsights(insightsInput),
		enabled:
			selection.period !== "custom" ||
			Boolean(insightsInput.startDate && insightsInput.endDate),
	});

	const data = query.data;
	const { navigateByBucket, navigateBySource } =
		useInsightsDrillDown(selection);

	return (
		<TransactionEditLayer insightsQueryKey={insightsQueryKey}>
			{(openTransactionEdit) => (
				<div className="space-y-6">
					<IncomeSummaryCards
						data={data}
						isLoading={query.isLoading}
						selection={selection}
					/>

					<div className="grid gap-6 lg:grid-cols-2">
						<IncomeTrendChart
							data={data}
							isError={query.isError}
							isLoading={query.isLoading}
							onBucketClick={(dateKey) => navigateByBucket(dateKey, "INCOME")}
						/>
						<IncomeSourcesChart
							data={data}
							isError={query.isError}
							isLoading={query.isLoading}
							onSourceClick={navigateBySource}
						/>
					</div>

					<RecurringVsOneTimeSection data={data} isLoading={query.isLoading} />

					<RecentIncomeList
						data={data}
						isError={query.isError}
						isLoading={query.isLoading}
						onSelectTransaction={openTransactionEdit}
					/>
				</div>
			)}
		</TransactionEditLayer>
	);
}
