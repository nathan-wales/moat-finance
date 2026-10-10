import { chartBarTooltipCursor, useChartActiveIndex } from "@moat/charts";
import type { SpendingTrendsResponse } from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { InsightsChartTooltipFooter } from "../insights/insights-chart-tooltip";
import {
	buildRankedTrendData,
	type CategoryTrendRow,
	formatCurrency,
	getCategoryColor,
	getTrendSegmentAmountKey,
	getTrendSegmentColorKey,
} from "./spending-chart-utils";

type CategoryTrendTooltipPayload = {
	payload?: {
		trendRows?: CategoryTrendRow[];
	};
};

function parseTrendSegmentIndex(dataKey: string): number | undefined {
	const match = dataKey.match(/^trendSegment(\d+)Amount$/);
	if (!match?.[1]) return undefined;
	return Number.parseInt(match[1], 10);
}

function CategoryTrendLegend({ categories }: { categories: string[] }) {
	if (categories.length === 0) return null;

	return (
		<div className="mt-2 flex flex-wrap justify-center gap-x-4 gap-y-1.5 px-2 text-xs">
			{categories.map((category, index) => (
				<div className="flex items-center gap-1.5" key={category}>
					<span
						className="h-2.5 w-2.5 rounded-sm"
						style={{ backgroundColor: getCategoryColor(index) }}
					/>
					<span className="text-muted-foreground">{category}</span>
				</div>
			))}
		</div>
	);
}

function CategoryTrendTooltip({
	active,
	label,
	payload,
}: {
	active?: boolean;
	label?: string;
	payload?: CategoryTrendTooltipPayload[];
}) {
	if (!active || !payload?.length) return null;

	const rows = payload[0]?.payload?.trendRows ?? [];
	if (rows.length === 0) return null;

	return (
		<div className="min-w-64 max-w-[calc(100vw-3rem)] rounded-lg border bg-popover p-3 text-popover-foreground text-xs shadow-md">
			<p className="mb-2 font-semibold text-foreground text-sm">{label}</p>
			<div className="space-y-1.5">
				{rows.map((row) => (
					<div
						className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-center gap-2"
						key={row.category}
					>
						<span
							className="h-2.5 w-2.5 rounded-full"
							style={{ backgroundColor: row.color }}
						/>
						<span className="truncate text-muted-foreground">
							{row.category}
						</span>
						<span className="font-medium tabular-nums">
							{formatCurrency(row.amount)}
						</span>
					</div>
				))}
			</div>
			<InsightsChartTooltipFooter />
		</div>
	);
}

export function CategoryTrendsCard({
	isError,
	isLoading,
	onTrendClick,
	trends,
}: {
	isError: boolean;
	isLoading: boolean;
	onTrendClick?: (input: { month: string; category?: string }) => void;
	trends?: SpendingTrendsResponse;
}) {
	const trendCategories = trends?.categories ?? [];
	const rankedTrendData = buildRankedTrendData(
		trends?.months ?? [],
		trendCategories,
	);
	const trendSegmentIndexes = trendCategories.map((category, index) => ({
		index,
		key: `segment-${category}-${index}`,
	}));
	const { onMouseMove, onMouseLeave, resolveIndex, resolveDataKey } =
		useChartActiveIndex();

	function handleChartClick(state: unknown) {
		if (!onTrendClick) return;
		const index = resolveIndex(state);
		if (index === undefined) return;
		const monthData = rankedTrendData[index];
		if (!monthData?.month) return;

		const dataKey = resolveDataKey(state);
		let category: string | undefined;
		if (dataKey) {
			const segmentIndex = parseTrendSegmentIndex(dataKey);
			if (segmentIndex !== undefined) {
				category = monthData.trendRows?.[segmentIndex]?.category;
			}
		}

		onTrendClick({
			month: String(monthData.month),
			category,
		});
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>Category Trends</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-20 text-center text-destructive text-sm">
						Failed to load category trends.
					</p>
				) : rankedTrendData.length === 0 || trendCategories.length === 0 ? (
					<p className="py-20 text-center text-muted-foreground text-sm">
						No category trend data available yet.
					</p>
				) : (
					<div style={{ cursor: onTrendClick ? "pointer" : "default" }}>
						<ResponsiveContainer height={280} width="100%">
							<BarChart
								data={rankedTrendData}
								onClick={handleChartClick}
								onMouseLeave={onMouseLeave}
								onMouseMove={onMouseMove}
							>
								<CartesianGrid strokeDasharray="3 3" />
								<XAxis dataKey="month" tick={{ fontSize: 10 }} />
								<YAxis
									tickFormatter={(value: number) => formatCurrency(value)}
									width={72}
								/>
								<Tooltip
									content={<CategoryTrendTooltip />}
									cursor={chartBarTooltipCursor}
									wrapperStyle={{ zIndex: 10 }}
								/>
								<Legend
									content={<CategoryTrendLegend categories={trendCategories} />}
								/>
								{trendSegmentIndexes.map(({ index, key }) => (
									<Bar
										dataKey={getTrendSegmentAmountKey(index)}
										key={key}
										stackId="stack"
									>
										{rankedTrendData.map((month) => (
											<Cell
												fill={String(
													month[getTrendSegmentColorKey(index)] ??
														"transparent",
												)}
												key={`${String(month.month)}-${key}`}
											/>
										))}
									</Bar>
								))}
							</BarChart>
						</ResponsiveContainer>
					</div>
				)}
			</CardContent>
		</Card>
	);
}
