import type { NetIncomeInsightsData } from "@moat/contracts";
import {
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
} from "@moat/ui";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import {
	CATEGORY_VIEW_STORAGE_KEYS,
	rollupSpendByParent,
} from "../../categories/category-parent";
import { CategoryViewToggle } from "../../categories/category-view-toggle";
import { usePersistedCategoryView } from "../../categories/use-persisted-category-view";
import {
	chartBarTooltipCursor,
	chartLineTooltipCursor,
	formatChartLabel,
	formatCurrency,
	formatPercent,
	formatSignedCurrency,
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

function CurrencyTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ name: string; value: number; color: string }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<InsightsChartTooltipShell>
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{payload.map((entry) => (
				<div className="flex items-center gap-2" key={entry.name}>
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium tabular-nums">
						{formatCurrency(entry.value)}
					</span>
				</div>
			))}
		</InsightsChartTooltipShell>
	);
}

function NetIncomeTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const value = payload[0]?.value ?? 0;
	return (
		<InsightsChartTooltipShell>
			<p className="mb-1 font-medium text-foreground">{label}</p>
			<p className="tabular-nums">{formatSignedCurrency(value)}</p>
		</InsightsChartTooltipShell>
	);
}

function PercentTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value: number | null }>;
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const value = payload[0]?.value ?? null;
	const display =
		value === null || value === undefined ? "—" : `${Math.round(value)}%`;
	return (
		<InsightsChartTooltipShell>
			<p className="mb-1 font-medium text-foreground">{label}</p>
			<p className="tabular-nums">{display}</p>
		</InsightsChartTooltipShell>
	);
}

function roundedNetIncomeCards(data?: NetIncomeInsightsData): {
	income: number;
	spending: number;
	net: number;
	savingsRate: number | null;
} {
	const income = Math.round(data?.totalIncome ?? 0);
	const spending = Math.round(data?.totalSpending ?? 0);
	const net = income - spending;
	return {
		income,
		spending,
		net,
		savingsRate: income > 0 ? net / income : null,
	};
}

function formatAmount(
	amount: number,
	format: "unsigned" | "signed" | "negative",
): string {
	if (format === "signed") return formatSignedCurrency(amount);
	if (format === "negative") return `-${formatCurrency(amount)}`;
	return formatCurrency(amount);
}

function insightsMonthlyAverageLabel(
	amount: number,
	format: "unsigned" | "signed" | "negative",
	selection: InsightsPeriodSelection,
): string | undefined {
	if (!showsInsightsMonthlyAverage(selection)) return undefined;
	return `${formatAmount(insightsMonthlyAverage(amount, selection), format)} Avg/mo`;
}

function AmountWithMonthlyAverage({
	amount,
	emphasize,
	format,
	selection,
}: {
	amount: number;
	emphasize?: boolean;
	format: "unsigned" | "signed" | "negative";
	selection: InsightsPeriodSelection;
}) {
	const amountClassName = emphasize
		? "font-semibold tabular-nums"
		: "tabular-nums";
	const monthlyAverageLabel = insightsMonthlyAverageLabel(
		amount,
		format,
		selection,
	);

	return (
		<div className="shrink-0 text-right">
			<span className={amountClassName}>{formatAmount(amount, format)}</span>
			{monthlyAverageLabel ? (
				<p className="mt-0.5 text-muted-foreground text-xs tabular-nums">
					{monthlyAverageLabel}
				</p>
			) : null}
		</div>
	);
}

export function NetIncomeSummaryCards({
	data,
	isLoading,
	selection,
}: {
	data?: NetIncomeInsightsData;
	isLoading: boolean;
	selection: InsightsPeriodSelection;
}) {
	const cards = roundedNetIncomeCards(data);
	const netIncomeValue = formatSignedCurrency(cards.net);
	const savingsRateValue = formatPercent(cards.savingsRate);
	const netIncomeSubtitle = insightsMonthlyAverageLabel(
		cards.net,
		"signed",
		selection,
	);
	const totalIncomeSubtitle = insightsMonthlyAverageLabel(
		cards.income,
		"unsigned",
		selection,
	);
	const totalSpendingSubtitle = insightsMonthlyAverageLabel(
		cards.spending,
		"unsigned",
		selection,
	);

	return (
		<div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
			<InsightsSummaryCard
				isLoading={isLoading}
				subtitle={netIncomeSubtitle}
				title="Net Income"
				value={netIncomeValue}
			/>
			<InsightsSummaryCard
				isLoading={isLoading}
				subtitle={totalIncomeSubtitle}
				title="Total Income"
				value={formatCurrency(cards.income)}
			/>
			<InsightsSummaryCard
				isLoading={isLoading}
				subtitle={totalSpendingSubtitle}
				title="Total Spending"
				value={formatCurrency(cards.spending)}
			/>
			<InsightsSummaryCard
				isLoading={isLoading}
				title="Savings Rate"
				value={savingsRateValue}
			/>
		</div>
	);
}

export function IncomeVsSpendingChart({
	data,
	isLoading,
	isError,
	onBucketClick,
}: {
	data?: NetIncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onBucketClick?: (input: {
		dateKey: string;
		type: "INCOME" | "EXPENSE";
	}) => void;
}) {
	const chartData =
		data?.incomeVsSpending.map((point) => ({
			dateKey: point.date,
			label: formatChartLabel(point.date),
			income: point.income,
			spending: point.spending,
		})) ?? [];
	const { onMouseMove, onMouseLeave, resolveIndex, resolveDataKey } =
		useChartActiveIndex();

	function handleChartClick(state: unknown) {
		if (!onBucketClick) return;
		const index = resolveIndex(state);
		if (index === undefined) return;
		const item = chartData[index];
		if (!item?.dateKey) return;

		const dataKey = resolveDataKey(state);
		const type = dataKey === "income" ? "INCOME" : "EXPENSE";
		onBucketClick({ dateKey: item.dateKey, type });
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Income vs Spending</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-8 text-center text-destructive text-sm">
						Failed to load income vs spending chart.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No net income data available for this period.
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
									content={<CurrencyTooltip />}
									cursor={chartBarTooltipCursor}
								/>
								<Legend />
								<Bar
									dataKey="income"
									fill={INSIGHTS_CHART_PALETTE[1]}
									name="Income"
									radius={[4, 4, 0, 0]}
								/>
								<Bar
									dataKey="spending"
									fill={INSIGHTS_CHART_PALETTE[0]}
									name="Spending"
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

export function NetIncomeTrendChart({
	data,
	isLoading,
	isError,
	onBucketClick,
}: {
	data?: NetIncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onBucketClick?: (dateKey: string) => void;
}) {
	const chartData =
		data?.netIncomeTrend.map((point) => ({
			dateKey: point.date,
			label: formatChartLabel(point.date),
			netIncome: point.netIncome,
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
				<CardTitle>Net Income Trend</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-8 text-center text-destructive text-sm">
						Failed to load net income trend.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No net income data available for this period.
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
									content={<NetIncomeTooltip />}
									cursor={chartBarTooltipCursor}
								/>
								<ReferenceLine stroke="#94a3b8" strokeDasharray="3 3" y={0} />
								<Bar
									dataKey="netIncome"
									name="Net Income"
									radius={[4, 4, 0, 0]}
								>
									{chartData.map((entry) => (
										<Cell
											fill={entry.netIncome >= 0 ? "#10b981" : "#f43f5e"}
											key={entry.label}
										/>
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

export function SavingsRateChart({
	data,
	isLoading,
	isError,
	onBucketClick,
}: {
	data?: NetIncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onBucketClick?: (dateKey: string) => void;
}) {
	const chartData =
		data?.savingsRateTrend.map((point) => ({
			dateKey: point.date,
			label: formatChartLabel(point.date),
			savingsRate: point.savingsRate === null ? null : point.savingsRate * 100,
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
				<CardTitle>Savings Rate</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-8 text-center text-destructive text-sm">
						Failed to load savings rate chart.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-8 text-center text-muted-foreground text-sm">
						No savings rate data available for this period.
					</p>
				) : (
					<div style={{ cursor: onBucketClick ? "pointer" : "default" }}>
						<ResponsiveContainer height={280} width="100%">
							<LineChart
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
									tickFormatter={(value: number) => `${Math.round(value)}%`}
									tickLine={false}
									width={48}
								/>
								<Tooltip
									content={<PercentTooltip />}
									cursor={chartLineTooltipCursor}
								/>
								<Line
									connectNulls={false}
									dataKey="savingsRate"
									dot={false}
									name="Savings Rate"
									stroke={INSIGHTS_CHART_PALETTE[2]}
									strokeWidth={2}
									type="monotone"
								/>
							</LineChart>
						</ResponsiveContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}

export function WhereIncomeWentSection({
	data,
	isLoading,
	isError,
	onCategoryClick,
	onParentClick,
	selection,
}: {
	data?: NetIncomeInsightsData;
	isLoading: boolean;
	isError: boolean;
	onCategoryClick?: (category: string) => void;
	onParentClick?: (categories: string[]) => void;
	selection: InsightsPeriodSelection;
}) {
	const [view, setView] = usePersistedCategoryView(
		CATEGORY_VIEW_STORAGE_KEYS.insightsNetIncome,
	);
	const categoryRows = data?.spendingBreakdown ?? [];
	const parentRows = rollupSpendByParent(
		categoryRows.map((row) => ({
			category: row.category,
			amount: row.amount,
			parentCategory: row.parentCategory,
		})),
	);
	const rows =
		view === "parent"
			? parentRows.map((row) => ({
					key: row.parent,
					label: row.label,
					amount: row.amount,
					categories: row.categories,
				}))
			: categoryRows.slice(0, 12).map((row) => ({
					key: row.category,
					label: row.category,
					amount: row.amount,
					categories: [row.category],
				}));
	const totalIncome = data?.totalIncome ?? 0;
	const netIncome = data?.netIncome ?? 0;

	return (
		<Card>
			<CardHeader>
				<CardTitle>Where Your Income Went</CardTitle>
				<CardAction>
					<CategoryViewToggle onChange={setView} value={view} />
				</CardAction>
			</CardHeader>
			<CardContent className="space-y-4">
				{isLoading ? (
					<div className="space-y-3">
						{Array.from({ length: 6 }, (_, index) => (
							<Skeleton
								className="h-8 w-full"
								// biome-ignore lint/suspicious/noArrayIndexKey: skeleton loading placeholder
								key={`breakdown-skeleton-${index}`}
							/>
						))}
					</div>
				) : isError ? (
					<p className="py-4 text-center text-destructive text-sm">
						Failed to load spending breakdown.
					</p>
				) : rows.length === 0 ? (
					<p className="py-4 text-center text-muted-foreground text-sm">
						No spending breakdown available for this period.
					</p>
				) : (
					<>
						<div className="flex items-start justify-between border-b pb-3 text-sm">
							<span className="font-medium">Income</span>
							<AmountWithMonthlyAverage
								amount={totalIncome}
								emphasize
								format="unsigned"
								selection={selection}
							/>
						</div>
						<div className="space-y-3">
							{rows.map((row, index) => {
								const widthPercent =
									totalIncome > 0
										? Math.min((row.amount / totalIncome) * 100, 100)
										: 0;
								const rowContent = (
									<>
										<div className="flex items-start justify-between gap-3 text-sm">
											<span className="truncate">{row.label}</span>
											<AmountWithMonthlyAverage
												amount={row.amount}
												format="negative"
												selection={selection}
											/>
										</div>
										<div className="h-1.5 overflow-hidden rounded-full bg-muted">
											<div
												className="h-full rounded-full"
												style={{
													backgroundColor:
														INSIGHTS_CHART_PALETTE[
															index % INSIGHTS_CHART_PALETTE.length
														],
													width: `${widthPercent}%`,
												}}
											/>
										</div>
									</>
								);

								const handleClick = () => {
									if (view === "parent") {
										onParentClick?.(row.categories);
										return;
									}
									onCategoryClick?.(row.label);
								};

								if (
									(view === "parent" && !onParentClick) ||
									(view === "category" && !onCategoryClick)
								) {
									return (
										<div className="space-y-1 py-2" key={row.key}>
											{rowContent}
										</div>
									);
								}

								return (
									<button
										className="block w-full space-y-1 rounded-md py-2 text-left transition-colors hover:bg-muted/50"
										key={row.key}
										onClick={handleClick}
										title="Click to see transactions"
										type="button"
									>
										{rowContent}
									</button>
								);
							})}
						</div>
						<div className="flex items-start justify-between border-t pt-3 text-sm">
							<span className="font-medium">Net Income</span>
							<AmountWithMonthlyAverage
								amount={netIncome}
								emphasize
								format="signed"
								selection={selection}
							/>
						</div>
					</>
				)}
			</CardContent>
		</Card>
	);
}
