import type { IncomeInsightsData } from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	chartBarTooltipCursor,
	formatChartLabel,
	formatCurrency,
	INSIGHTS_CHART_PALETTE,
	useChartActiveIndex,
} from "../chart-utils";
import { InsightsChartTooltipShell } from "../insights-chart-tooltip";
import { InsightsSummaryCard } from "../insights-summary-card";
import {
	type InsightsPeriodSelection,
	insightsMonthlyAverage,
	showsInsightsMonthlyAverage,
} from "../period-utils";

export const RECENT_INCOME_TRANSACTION_LIMIT = 15;
const RECENT_INCOME_SKELETON_KEYS = [
	"recent-income-skeleton-1",
	"recent-income-skeleton-2",
	"recent-income-skeleton-3",
	"recent-income-skeleton-4",
	"recent-income-skeleton-5",
];

function IncomeTrendTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const amount = payload[0]?.value ?? 0;
	return (
		<InsightsChartTooltipShell>
			<p className="mb-1 font-medium text-foreground">{label}</p>
			<p className="tabular-nums">{formatCurrency(amount)}</p>
		</InsightsChartTooltipShell>
	);
}

function IncomeSourceTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: Array<{ payload?: { source?: string; amount?: number } }>;
}) {
	if (!active || !payload?.length) return null;
	const row = payload[0]?.payload;
	if (!row?.source) return null;
	return (
		<InsightsChartTooltipShell>
			<p className="mb-1 font-medium text-foreground">{row.source}</p>
			<p className="tabular-nums">{formatCurrency(row.amount ?? 0)}</p>
		</InsightsChartTooltipShell>
	);
}

export function IncomeSummaryCards({
	data,
	isLoading,
	selection,
}: {
	data?: IncomeInsightsData;
	isLoading: boolean;
	selection: InsightsPeriodSelection;
}) {
	const monthlyAverage = insightsMonthlyAverage(
		data?.totalIncome ?? 0,
		selection,
	);
	const showMonthlyAverage = showsInsightsMonthlyAverage(selection);
	const summaryGridClassName = showMonthlyAverage
		? "grid gap-4 sm:grid-cols-2 lg:grid-cols-4"
		: "grid gap-4 sm:grid-cols-2 lg:grid-cols-3";

	return (
		<div className={summaryGridClassName}>
			<InsightsSummaryCard
				isLoading={isLoading}
				title="Total Income"
				value={formatCurrency(data?.totalIncome ?? 0)}
			/>
			{showMonthlyAverage && (
				<InsightsSummaryCard
					isLoading={isLoading}
					title="Monthly average"
					value={formatCurrency(monthlyAverage)}
				/>
			)}
			<InsightsSummaryCard
				isLoading={isLoading}
				title="Recurring Income"
				value={formatCurrency(data?.recurringIncome ?? 0)}
			/>
			<InsightsSummaryCard
				isLoading={isLoading}
				title="One-Time Income"
				value={formatCurrency(data?.oneTimeIncome ?? 0)}
			/>
		</div>
	);
}

export function IncomeTrendChart({
	data,
	isLoading,
	isError,
	onBucketClick,
}: {
	data?: IncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onBucketClick?: (dateKey: string) => void;
}) {
	const chartData =
		data?.incomeTrend.map((point) => ({
			dateKey: point.date,
			label: formatChartLabel(point.date),
			amount: point.amount,
		})) ?? [];
	const { onMouseMove, onMouseLeave, resolveIndex } = useChartActiveIndex();

	function handleChartClick(state: unknown) {
		if (!onBucketClick) return;
		const index = resolveIndex(state);
		if (index === undefined) return;
		const item = chartData[index];
		if (!item?.dateKey) return;
		onBucketClick(item.dateKey);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Income Trend</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-8 text-center text-destructive text-sm">
						Failed to load income trend.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No income found for this period.
					</p>
				) : (
					<div style={{ cursor: onBucketClick ? "pointer" : "default" }}>
						<ResponsiveContainer height={280} width="100%">
							<BarChart
								data={chartData}
								onClick={handleChartClick}
								onMouseLeave={onMouseLeave}
								onMouseMove={onMouseMove}
							>
								<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11 }}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(value: number) => formatCurrency(value)}
									tickLine={false}
									width={80}
								/>
								<Tooltip
									content={<IncomeTrendTooltip />}
									cursor={chartBarTooltipCursor}
								/>
								<Bar
									dataKey="amount"
									fill={INSIGHTS_CHART_PALETTE[0]}
									name="Income"
									radius={[4, 4, 0, 0]}
								/>
							</BarChart>
						</ResponsiveContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function IncomeSourcesChart({
	data,
	isLoading,
	isError,
	onSourceClick,
}: {
	data?: IncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onSourceClick?: (source: string) => void;
}) {
	const chartData =
		data?.incomeSources.slice(0, 8).map((row, index) => ({
			source: row.source,
			amount: row.amount,
			fill: INSIGHTS_CHART_PALETTE[index % INSIGHTS_CHART_PALETTE.length],
		})) ?? [];
	const { onMouseMove, onMouseLeave, resolveIndex } = useChartActiveIndex();

	function handleChartClick(state: unknown) {
		if (!onSourceClick) return;
		const index = resolveIndex(state);
		if (index === undefined) return;
		const item = chartData[index];
		if (!item?.source) return;
		onSourceClick(item.source);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Income Sources</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-8 text-center text-destructive text-sm">
						Failed to load income sources.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No income sources found for this period.
					</p>
				) : (
					<div style={{ cursor: onSourceClick ? "pointer" : "default" }}>
						<ResponsiveContainer height={280} width="100%">
							<BarChart
								data={chartData}
								layout="vertical"
								margin={{ left: 24 }}
								onClick={handleChartClick}
								onMouseLeave={onMouseLeave}
								onMouseMove={onMouseMove}
							>
								<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
								<XAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(value: number) => formatCurrency(value)}
									type="number"
								/>
								<YAxis
									dataKey="source"
									tick={{ fontSize: 11 }}
									type="category"
									width={120}
								/>
								<Tooltip
									content={<IncomeSourceTooltip />}
									cursor={chartBarTooltipCursor}
								/>
								<Bar dataKey="amount" radius={[0, 4, 4, 0]}>
									{chartData.map((entry) => (
										<Cell fill={entry.fill} key={entry.source} />
									))}
								</Bar>
							</BarChart>
						</ResponsiveContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function RecurringVsOneTimeSection({
	data,
	isLoading,
}: {
	data?: IncomeInsightsData;
	isLoading: boolean;
}) {
	return (
		<Card>
			<CardHeader>
				<CardTitle>Recurring vs One-Time</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="grid gap-4 sm:grid-cols-2">
						<Skeleton className="h-24 w-full" />
						<Skeleton className="h-24 w-full" />
					</div>
				) : (
					<div className="grid gap-4 sm:grid-cols-2">
						<div className="rounded-lg border bg-muted/30 p-4">
							<p className="text-muted-foreground text-sm">Recurring Income</p>
							<p className="mt-2 font-semibold text-2xl tabular-nums">
								{formatCurrency(data?.recurringIncome ?? 0)}
							</p>
						</div>
						<div className="rounded-lg border bg-muted/30 p-4">
							<p className="text-muted-foreground text-sm">One-Time Income</p>
							<p className="mt-2 font-semibold text-2xl tabular-nums">
								{formatCurrency(data?.oneTimeIncome ?? 0)}
							</p>
						</div>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function RecentIncomeList({
	data,
	isLoading,
	isError,
	onSelectTransaction,
}: {
	data?: IncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onSelectTransaction?: (
		transaction: IncomeInsightsData["recentIncomeTransactions"][number],
	) => void;
}) {
	const rows = (data?.recentIncomeTransactions ?? []).slice(
		0,
		RECENT_INCOME_TRANSACTION_LIMIT,
	);

	return (
		<Card>
			<CardHeader>
				<CardTitle>Recent Income</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<div className="space-y-3">
						{RECENT_INCOME_SKELETON_KEYS.map((key) => (
							<Skeleton className="h-10 w-full" key={key} />
						))}
					</div>
				) : isError ? (
					<p className="py-4 text-center text-destructive text-sm">
						Failed to load recent income.
					</p>
				) : rows.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No income found for this period.
					</p>
				) : (
					<div className="divide-y">
						{rows.map((row) => {
							const dateLabel = new Date(row.date).toLocaleDateString("en-US", {
								month: "short",
								day: "numeric",
								year: "numeric",
							});
							const accountLabel = row.accountName ?? "—";
							const categoryLabel = row.category ?? "—";

							const rowContent = (
								<>
									<span className="text-muted-foreground">{dateLabel}</span>
									<div className="min-w-0">
										<p className="truncate font-medium">{row.name}</p>
										<p className="truncate text-muted-foreground text-xs">
											{accountLabel} · {categoryLabel}
										</p>
									</div>
									<span className="font-medium tabular-nums">
										{formatCurrency(row.amount)}
									</span>
								</>
							);

							if (!onSelectTransaction) {
								return (
									<div
										className="grid gap-2 py-3 text-sm sm:grid-cols-[100px_1fr_auto]"
										key={row.id}
									>
										{rowContent}
									</div>
								);
							}

							return (
								<button
									className="grid w-full gap-2 rounded-md py-3 text-left text-sm transition-colors hover:bg-muted/50 sm:grid-cols-[100px_1fr_auto]"
									key={row.id}
									onClick={() => {
										onSelectTransaction(row);
									}}
									type="button"
								>
									{rowContent}
								</button>
							);
						})}
					</div>
				)}
			</CardContent>
		</Card>
	);
}
