import { chartBarTooltipCursor, useChartActiveIndex } from "@moat/charts";
import type { CategoryBreakdown } from "@moat/contracts";
import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { InsightsChartTooltipShell } from "../insights/insights-chart-tooltip";
import { formatCurrency, getCategoryColor } from "./spending-chart-utils";

function SpendingDistributionTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: Array<{ value?: number }>;
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

export function SpendingDistributionCard({
	breakdown,
	isError,
	isLoading,
	onCategoryClick,
}: {
	breakdown: CategoryBreakdown[];
	isError: boolean;
	isLoading: boolean;
	onCategoryClick?: (category: string) => void;
}) {
	const chartData = breakdown.map((category, index) => ({
		fill: getCategoryColor(index),
		name: category.category,
		total: category.total,
	}));
	const { onMouseMove, onMouseLeave, resolveIndex } = useChartActiveIndex();

	function handleChartClick(state: unknown) {
		if (!onCategoryClick) return;
		const index = resolveIndex(state);
		if (index === undefined) return;
		const item = chartData[index];
		if (!item?.name) return;
		onCategoryClick(item.name);
	}

	function handlePieClick(_: unknown, index: number) {
		if (!onCategoryClick) return;
		const item = chartData[index];
		if (!item?.name) return;
		onCategoryClick(item.name);
	}

	const chartCursor = onCategoryClick ? "pointer" : "default";

	return (
		<Card>
			<CardHeader>
				<CardTitle>Spending Distribution</CardTitle>
			</CardHeader>
			<CardContent>
				{isLoading ? (
					<Skeleton className="h-64 w-full" />
				) : isError ? (
					<p className="py-20 text-center text-destructive text-sm">
						Failed to load spending distribution.
					</p>
				) : chartData.length === 0 ? (
					<p className="py-20 text-center text-muted-foreground text-sm">
						No spending distribution available yet.
					</p>
				) : (
					<Tabs defaultValue="pie">
						<TabsList className="mb-4">
							<TabsTrigger value="pie">Pie</TabsTrigger>
							<TabsTrigger value="bar">Bar</TabsTrigger>
						</TabsList>
						<TabsContent value="pie">
							<div style={{ cursor: chartCursor }}>
								<ResponsiveContainer height={240} width="100%">
									<PieChart>
										<Pie
											cx="50%"
											cy="50%"
											data={chartData.map((category) => ({
												name: category.name,
												value: category.total,
											}))}
											dataKey="value"
											label={({
												name,
												percent,
											}: {
												name?: string;
												percent?: number;
											}) =>
												`${name ?? ""} ${((percent ?? 0) * 100).toFixed(0)}%`
											}
											labelLine={false}
											onClick={handlePieClick}
											outerRadius={90}
										>
											{chartData.map((category) => (
												<Cell fill={category.fill} key={category.name} />
											))}
										</Pie>
										<Tooltip content={<SpendingDistributionTooltip />} />
									</PieChart>
								</ResponsiveContainer>
							</div>
						</TabsContent>
						<TabsContent value="bar">
							<div style={{ cursor: chartCursor }}>
								<ResponsiveContainer height={240} width="100%">
									<BarChart
										data={chartData}
										onClick={handleChartClick}
										onMouseLeave={onMouseLeave}
										onMouseMove={onMouseMove}
									>
										<CartesianGrid strokeDasharray="3 3" />
										<XAxis dataKey="name" tick={{ fontSize: 10 }} />
										<YAxis
											tickFormatter={(value: number) => formatCurrency(value)}
											width={72}
										/>
										<Tooltip
											content={<SpendingDistributionTooltip />}
											cursor={chartBarTooltipCursor}
										/>
										<Bar dataKey="total" radius={[4, 4, 0, 0]}>
											{chartData.map((category) => (
												<Cell fill={category.fill} key={category.name} />
											))}
										</Bar>
									</BarChart>
								</ResponsiveContainer>
							</div>
						</TabsContent>
					</Tabs>
				)}
			</CardContent>
		</Card>
	);
}
