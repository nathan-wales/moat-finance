"use client";

import { flattenSingleMonthSeries } from "@moat/charts";
import { getBalanceSnapshotHistory } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ForecastSelector } from "~/components/charts/forecast-selector";
import { Card, CardContent, CardHeader, CardTitle } from "~/components/ui/card";
import { Skeleton } from "~/components/ui/skeleton";
import { useForecast } from "~/context/forecast-context";
import { formatCurrency, formatMonthLabel } from "~/lib/forecasting";

const TOOLTIP_ORDER = ["netWorth", "forecast"];

function NetWorthTooltip({
	active,
	payload,
	label,
}: {
	active?: boolean;
	payload?: { name: string; value: number; color: string; dataKey: string }[];
	label?: string;
}) {
	if (!active || !payload?.length) return null;
	const sorted = [...payload]
		.filter((p) => p.value != null)
		.sort(
			(a, b) =>
				TOOLTIP_ORDER.indexOf(a.dataKey) - TOOLTIP_ORDER.indexOf(b.dataKey),
		);
	if (!sorted.length) return null;
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{sorted.map((entry) => (
				<div className="flex items-center gap-2" key={entry.dataKey}>
					<span
						className="h-2 w-2 rounded-full"
						style={{ background: entry.color }}
					/>
					<span className="text-muted-foreground">{entry.name}:</span>
					<span className="font-medium">{formatCurrency(entry.value)}</span>
				</div>
			))}
		</div>
	);
}

export function NetWorthChart() {
	const { forecastMonths, forecastYears, isOverridden } = useForecast();
	const [isSmallScreen, setIsSmallScreen] = useState(false);

	useEffect(() => {
		const check = () => setIsSmallScreen(window.innerWidth < 1024);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	const { data: historyResponse, isLoading: historyLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getHistory", { months: 24, forecastMonths }],
		queryFn: () => getBalanceSnapshotHistory({ months: 24, forecastMonths }),
	});

	const snapshotHistory =
		historyResponse?.status === 200 ? historyResponse.data.data : undefined;

	if (historyLoading) {
		return (
			<Card>
				<CardHeader>
					<Skeleton className="h-6 w-32" />
				</CardHeader>
				<CardContent>
					<Skeleton className="h-64 w-full" />
				</CardContent>
			</Card>
		);
	}

	const historicalPoints =
		snapshotHistory?.historical?.map((p) => ({
			month: p.month,
			label: formatMonthLabel(p.month),
			netWorth: p.total,
		})) ?? [];

	const currentNetWorth = historicalPoints.at(-1)?.netWorth ?? 0;
	const forecastPoints = snapshotHistory?.forecast ?? [];
	const forecastedNetWorth = forecastPoints.at(-1)?.total ?? currentNetWorth;
	const plotHistorical = flattenSingleMonthSeries(historicalPoints).map(
		(point) => ({
			...point,
			label: formatMonthLabel(point.month),
		}),
	);

	const chartData = [
		...plotHistorical.map((p) => ({
			month: p.month,
			label: p.label,
			netWorth: p.netWorth,
			forecast: undefined as number | undefined,
		})),
		...forecastPoints.map((p) => ({
			month: p.month,
			label: formatMonthLabel(p.month),
			netWorth: undefined as number | undefined,
			forecast: p.total,
		})),
	];

	return (
		<Card>
			<CardHeader className="flex flex-row items-start justify-between">
				<div>
					<CardTitle>Net Worth</CardTitle>
					{historicalPoints.length > 0 && (
						<div className="mt-1 flex items-center gap-1.5 text-sm">
							<span className="font-semibold">
								{formatCurrency(currentNetWorth)}
							</span>
							<span className="text-muted-foreground text-xs">→</span>
							<span className="font-semibold text-emerald-600 dark:text-emerald-400">
								{formatCurrency(forecastedNetWorth)}
							</span>
							<span className="text-muted-foreground text-xs">
								in {forecastYears}y
							</span>
						</div>
					)}
				</div>
				{!isOverridden && <ForecastSelector />}
			</CardHeader>
			<CardContent>
				<ResponsiveContainer height={300} width="100%">
					<LineChart data={chartData}>
						<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
						<XAxis
							dataKey="label"
							interval={Math.max(
								0,
								Math.ceil(chartData.length / (isSmallScreen ? 4 : 8)) - 1,
							)}
							tick={{ fontSize: 11 }}
							tickLine={false}
						/>
						<YAxis
							tick={{ fontSize: 11 }}
							tickFormatter={(v: number) => formatCurrency(v)}
							tickLine={false}
							width={80}
						/>
						<Tooltip content={<NetWorthTooltip />} />
						<Line
							dataKey="netWorth"
							dot={false}
							name="Historical"
							stroke="#3b82f6"
							strokeWidth={2}
							type="linear"
						/>
						<Line
							dataKey="forecast"
							dot={false}
							name="Forecast"
							stroke="#10b981"
							strokeDasharray="5 5"
							strokeWidth={1.5}
							type="monotone"
						/>
					</LineChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
