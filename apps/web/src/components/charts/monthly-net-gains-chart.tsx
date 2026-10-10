"use client";

import { endOfMonth, format } from "date-fns";
import { BarChart2, LineChartIcon } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
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
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { Tabs, TabsList, TabsTrigger } from "~/components/ui/tabs";
import {
	formatCurrency,
	formatMonthLabel,
	type MonthlyDataPoint,
} from "~/lib/forecasting";

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
	// Ensure income is always rendered before expenses
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
}

export function MonthlyNetGainsChart({
	monthlyData,
	isLoading,
	avgNetGain: avgNetGainProp,
}: Props) {
	const [chartType, setChartType] = useState<"line" | "bar">("line");
	const router = useRouter();

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

	// Compute where zero sits as a fraction from top for the gradient
	const netGainValues = chartData.map((d) => d.netGain);
	const dataMin = Math.min(0, ...netGainValues);
	const dataMax = Math.max(0, ...netGainValues);
	const gradientRange = dataMax - dataMin;
	const zeroFraction =
		gradientRange > 0 ? `${(dataMax / gradientRange) * 100}%` : "0%";

	const handleChartClick = (state: unknown) => {
		const data = state as { activeIndex?: string | number } | null;
		const index = data?.activeIndex;
		if (index === undefined || index === null) return;
		const idx = typeof index === "string" ? parseInt(index, 10) : index;
		const item = chartData[idx];
		const month = item?.month;
		if (!month) return;
		const { from, to } = monthToDateRange(month);
		router.push(`/transactions?from=${from}&to=${to}`);
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
			</CardHeader>
			<CardContent>
				<div style={{ cursor: "pointer" }}>
					<ResponsiveContainer height={280} width="100%">
						{chartType === "line" ? (
							<AreaChart
								className="cursor-pointer"
								data={chartData}
								margin={{ top: 4, right: 4, bottom: 0, left: 0 }}
								onClick={handleChartClick}
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
								<Tooltip content={<LineTooltip />} />
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
								<Tooltip content={<BarTooltip />} />

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
			<p className="px-6 pb-4 text-muted-foreground text-xs">
				Doesn't look right? Make adjustments on the{" "}
				<Link className="cursor-pointer underline" href="/transactions">
					transactions page
				</Link>
				.
			</p>
		</Card>
	);
}
