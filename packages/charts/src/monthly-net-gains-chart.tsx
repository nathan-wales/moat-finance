import {
	Card,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
	Tabs,
	TabsList,
	TabsTrigger,
} from "@moat/ui";
import { endOfMonth, format } from "date-fns";
import { BarChart2, LineChartIcon } from "lucide-react";
import { useState } from "react";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Cell,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { useChartActiveIndex } from "./chart-click";
import { chartBarTooltipCursor, chartLineTooltipCursor } from "./chart-theme";
import {
	formatCurrency,
	formatMonthLabel,
	type MonthlyDataPoint,
} from "./utils";

function monthToDateRange(month: string) {
	const [year = 0, monthNum = 0] = month.split("-").map(Number);
	const date = new Date(year, monthNum - 1, 1);
	return {
		from: format(date, "yyyy-MM-dd"),
		to: format(endOfMonth(date), "yyyy-MM-dd"),
	};
}

function LineTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: { name: string; value: number; color: string }[];
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{payload.map((entry) => (
				<div className="flex items-center gap-2" key={entry.name}>
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium">{formatCurrency(entry.value)}</span>
				</div>
			))}
			<p className="mt-2 border-t pt-1.5 text-muted-foreground">
				Click to see transactions
			</p>
		</div>
	);
}

function BarTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: { name: string; value: number; color: string }[];
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const sorted = [...payload].sort((a) => (a.name === "Income" ? -1 : 1));
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{sorted.map((entry) => (
				<div className="flex items-center gap-2" key={entry.name}>
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium">{formatCurrency(entry.value)}</span>
				</div>
			))}
			<p className="mt-2 border-t pt-1.5 text-muted-foreground">
				Click to see transactions
			</p>
		</div>
	);
}

interface Props {
	monthlyData: MonthlyDataPoint[];
	isLoading?: boolean;
	avgNetGain?: number;
	/** Called when a chart bar/area is clicked, with from/to date strings */
	onMonthClick?: (from: string, to: string) => void;
	/** Optional link element rendered in the footer */
	transactionsLink?: React.ReactNode;
	/** Optional actions rendered in the card header (e.g. Prompts menu). */
	headerActions?: React.ReactNode;
}

export function MonthlyNetGainsChart({
	monthlyData,
	isLoading,
	avgNetGain: avgNetGainProp,
	onMonthClick,
	transactionsLink,
	headerActions,
}: Props) {
	const [chartType, setChartType] = useState<"line" | "bar">("line");
	const { onMouseMove, onMouseLeave, resolveIndex } = useChartActiveIndex();

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-48" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	const avgNetGain =
		avgNetGainProp ??
		(monthlyData.length > 0
			? monthlyData.reduce((sum, d) => sum + d.netGain, 0) / monthlyData.length
			: null);

	const chartData = monthlyData.slice(-12).map((d) => ({
		month: d.month,
		label: formatMonthLabel(d.month),
		netGain: d.netGain,
		income: d.income,
		expenses: d.expenses,
	}));

	const netGainValues = chartData.map((d) => d.netGain);
	const dataMin = Math.min(0, ...netGainValues);
	const dataMax = Math.max(0, ...netGainValues);
	const gradientRange = dataMax - dataMin;
	const zeroFraction =
		gradientRange > 0 ? `${(dataMax / gradientRange) * 100}%` : "0%";

	const handleChartClick = (state: unknown) => {
		if (!onMonthClick) return;
		const idx = resolveIndex(state);
		if (idx === undefined) return;
		const item = chartData[idx];
		const month = item?.month;
		if (!month) return;
		const { from, to } = monthToDateRange(month);
		onMonthClick(from, to);
	};

	return (
		<Card>
			<CardHeader className="flex flex-row items-center justify-between">
				<div>
					<CardTitle>Monthly Net Gains</CardTitle>
					{avgNetGain != null && (
						<p className="mt-0.5 text-muted-foreground text-sm">
							Average: {formatCurrency(avgNetGain)}
						</p>
					)}
				</div>
				<div className="flex items-center gap-1">
					{headerActions}
					<Tabs
						onValueChange={(v) => setChartType(v as "line" | "bar")}
						value={chartType}
					>
						<TabsList>
							<TabsTrigger value="line">
								<LineChartIcon className="h-4 w-4" />
							</TabsTrigger>
							<TabsTrigger value="bar">
								<BarChart2 className="h-4 w-4" />
							</TabsTrigger>
						</TabsList>
					</Tabs>
				</div>
			</CardHeader>
			<CardContent>
				<div style={{ cursor: onMonthClick ? "pointer" : "default" }}>
					<ResponsiveContainer height={280} width="100%">
						{chartType === "line" ? (
							<AreaChart
								className="cursor-pointer"
								data={chartData}
								margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
								onClick={handleChartClick}
								onMouseLeave={onMouseLeave}
								onMouseMove={onMouseMove}
							>
								<defs>
									<linearGradient
										id="netGainAreaGradient"
										x1="0"
										x2="0"
										y1="0"
										y2="1"
									>
										<stop offset="0%" stopColor="#10b981" stopOpacity={0.25} />
										<stop
											offset={zeroFraction}
											stopColor="#10b981"
											stopOpacity={0.05}
										/>
										<stop
											offset={zeroFraction}
											stopColor="#f43f5e"
											stopOpacity={0.05}
										/>
										<stop
											offset="100%"
											stopColor="#f43f5e"
											stopOpacity={0.25}
										/>
									</linearGradient>
									<linearGradient
										id="netGainStrokeGradient"
										x1="0"
										x2="0"
										y1="0"
										y2="1"
									>
										<stop
											offset={zeroFraction}
											stopColor="#10b981"
											stopOpacity={1}
										/>
										<stop
											offset={zeroFraction}
											stopColor="#f43f5e"
											stopOpacity={1}
										/>
									</linearGradient>
								</defs>
								<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
								<XAxis
									dataKey="label"
									tick={{ fontSize: 11 }}
									tickLine={false}
								/>
								<YAxis
									tick={{ fontSize: 11 }}
									tickFormatter={(v: number) => formatCurrency(v)}
									tickLine={false}
									width={80}
								/>
								<Tooltip
									content={<LineTooltip />}
									cursor={chartLineTooltipCursor}
								/>
								<ReferenceLine
									stroke="#94a3b8"
									strokeDasharray="3 3"
									strokeWidth={1.5}
									y={0}
								/>
								<Area
									dataKey="netGain"
									dot={false}
									fill="url(#netGainAreaGradient)"
									name="Net Gain"
									stroke="url(#netGainStrokeGradient)"
									strokeWidth={2}
									type="monotone"
								/>
							</AreaChart>
						) : (
							<BarChart
								className="cursor-pointer"
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
									tickFormatter={(v: number) => formatCurrency(v)}
									tickLine={false}
									width={80}
								/>
								<Tooltip
									content={<BarTooltip />}
									cursor={chartBarTooltipCursor}
								/>

								<ReferenceLine
									stroke="#94a3b8"
									strokeDasharray="3 3"
									strokeWidth={1.5}
									y={0}
								/>
								<Bar dataKey="netGain" name="Net" radius={[2, 2, 0, 0]}>
									{chartData.map((entry) => (
										<Cell
											fill={entry.netGain >= 0 ? "#10b981" : "#f43f5e"}
											key={entry.month}
										/>
									))}
								</Bar>
							</BarChart>
						)}
					</ResponsiveContainer>
				</div>
			</CardContent>
			{transactionsLink && (
				<p className="px-6 pb-4 text-muted-foreground text-xs">
					Doesn't look right? Make adjustments on the {transactionsLink}.
				</p>
			)}
		</Card>
	);
}
