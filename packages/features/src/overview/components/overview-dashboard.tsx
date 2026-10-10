import {
	CashFlowSankey,
	MonthlyNetGainsChart,
	NetWorthChart,
	PortfolioAllocationChart,
	type PortfolioAllocationItem,
	type PortfolioAllocationSection,
} from "@moat/charts";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { useApiClient } from "../../api-client-context";
import { useMoatNavigation } from "../../navigation-context";
import { buildTransactionsPath } from "../../transactions/build-transactions-path";
import { OverviewGreeting } from "./overview-greeting";
import { OverviewProjectedNetWorthChart } from "./overview-projected-net-worth";
import type { PortfolioHoldingSelection } from "./portfolio-holding-details";
import { PortfolioHoldingDetails } from "./portfolio-holding-details";
import { SummaryMetricCard } from "./summary-metric-card";

interface OverviewDashboardProps {
	/**
	 * Optional header actions for individual charts.
	 * Each slot accepts any ReactNode — typically a PromptMenu from the host app.
	 */
	chartHeaderActions?: {
		cashFlow?: React.ReactNode;
		monthlyGains?: React.ReactNode;
	};
	viewerName?: string | null;
}

export function OverviewDashboard({
	chartHeaderActions,
	viewerName,
}: OverviewDashboardProps = {}) {
	const apiClient = useApiClient();
	const nav = useMoatNavigation();

	const [cashFlowMonth, setCashFlowMonth] = useState<string | undefined>(
		undefined,
	);
	const [holdingSelection, setHoldingSelection] =
		useState<PortfolioHoldingSelection | null>(null);

	const { data: monthlyData, isLoading: monthlyLoading } = useQuery({
		queryKey: ["transaction", "getMonthlyAggregates", { months: 24 }],
		queryFn: () => apiClient.getMonthlyAggregates({ months: 24 }),
	});

	const { data: summary, isLoading: summaryLoading } = useQuery({
		queryKey: ["transaction", "getSummaryMetrics"],
		queryFn: () => apiClient.getSummaryMetrics(),
	});

	const { data: portfolioData, isLoading: portfolioLoading } = useQuery({
		queryKey: ["investment", "getPortfolioAllocation"],
		queryFn: () => apiClient.getPortfolioAllocation(),
	});

	const { data: cashFlowData, isLoading: cashFlowLoading } = useQuery({
		queryKey: ["transaction", "getPreviousMonthCashFlow", { cashFlowMonth }],
		queryFn: () => apiClient.getPreviousMonthCashFlow({ month: cashFlowMonth }),
	});

	const { data: historyData, isLoading: historyLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getHistory", { months: 24 }],
		queryFn: () => apiClient.getBalanceSnapshotHistory({ months: 24 }),
	});

	function handlePortfolioItemClick(
		item: PortfolioAllocationItem,
		section: PortfolioAllocationSection,
	) {
		setHoldingSelection({
			itemId: item.id,
			sectionKey: section.key,
		});
	}

	return (
		<div className="mx-auto w-full max-w-5xl space-y-6 pb-24">
			<OverviewGreeting viewerName={viewerName} />

			<PortfolioAllocationChart
				isLoading={portfolioLoading}
				onAddInvestmentsClick={() => nav.push("/financial-profile")}
				onItemClick={handlePortfolioItemClick}
				sections={portfolioData?.sections ?? []}
			/>

			<PortfolioHoldingDetails
				onClose={() => setHoldingSelection(null)}
				selection={holdingSelection}
			/>

			<NetWorthChart
				historical={historyData?.historical ?? []}
				isLoading={historyLoading}
			/>

			<OverviewProjectedNetWorthChart />

			<MonthlyNetGainsChart
				avgNetGain={monthlyData?.avgNetGain}
				headerActions={chartHeaderActions?.monthlyGains}
				isLoading={monthlyLoading}
				monthlyData={monthlyData?.months ?? []}
				onMonthClick={(from, to) => {
					nav.push(buildTransactionsPath({ from, to }));
				}}
			/>

			<div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
				<SummaryMetricCard
					description="Last 12 months average"
					isLoading={summaryLoading}
					title="Avg Net Gain / Month"
					value={summary?.avgNetGain ?? 0}
					variant={(summary?.avgNetGain ?? 0) >= 0 ? "positive" : "negative"}
				/>
				<SummaryMetricCard
					description="Last 12 months average"
					isLoading={summaryLoading}
					title="Avg Income / Month"
					value={summary?.avgIncome ?? 0}
					variant="positive"
				/>
				<SummaryMetricCard
					description="Last 12 months average"
					isLoading={summaryLoading}
					title="Avg Expenses / Month"
					value={summary?.avgExpenses ?? 0}
					variant="negative"
				/>
			</div>

			<CashFlowSankey
				data={
					cashFlowData
						? {
								month: cashFlowData.month,
								startDate: cashFlowData.startDate,
								endDate: cashFlowData.endDate,
								totalIncome: cashFlowData.totalIncome,
								totalExpenses: cashFlowData.totalExpenses,
								netSavings: cashFlowData.netSavings,
								nodes: cashFlowData.nodes,
								links: cashFlowData.links,
							}
						: undefined
				}
				headerActions={chartHeaderActions?.cashFlow}
				isLoading={cashFlowLoading}
				onMonthChange={setCashFlowMonth}
			/>
		</div>
	);
}
