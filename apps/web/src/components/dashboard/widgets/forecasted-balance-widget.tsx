"use client";

import { getBalanceSnapshotHistory } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import {
	CartesianGrid,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { useForecast } from "~/context/forecast-context";
import {
	formatCurrency,
	formatMonthLabel,
	projectNetWorth,
	SCENARIO_PRESETS,
} from "~/lib/forecasting";
import type { WidgetConfig } from "~/lib/widgets/widget-registry";

export function ForecastedBalanceWidget({
	config: _config,
}: {
	config: WidgetConfig;
}) {
	const { forecastMonths } = useForecast();

	const { data: historyResponse, isLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getHistory", { months: 3 }],
		queryFn: () => getBalanceSnapshotHistory({ months: 3 }),
	});

	const snapshotHistory =
		historyResponse?.status === 200 ? historyResponse.data.data : undefined;

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	const historical = snapshotHistory?.historical ?? [];

	if (historical.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
				No forecast data available
			</div>
		);
	}

	const historicalPoints = historical.map((p) => ({
		month: p.month,
		label: formatMonthLabel(p.month),
		balance: p.total,
	}));

	const currentBalance = historicalPoints.at(-1)?.balance ?? 0;

	const forecast = projectNetWorth(
		currentBalance,
		forecastMonths,
		SCENARIO_PRESETS.STANDARD.annualReturnRate,
	);

	const merged = [
		...historicalPoints,
		...forecast.map((f) => ({
			month: f.month,
			label: formatMonthLabel(f.month),
			balance: null,
			forecast: f.value,
		})),
	];

	return (
		<div className="h-64 w-full">
			<ResponsiveContainer height="100%" width="100%">
				<LineChart data={merged}>
					<defs>
						<linearGradient id="balanceGradient" x1="0" x2="0" y1="0" y2="1">
							<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
							<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
						</linearGradient>
						<linearGradient id="forecastGradient" x1="0" x2="0" y1="0" y2="1">
							<stop offset="5%" stopColor="#10b981" stopOpacity={0.2} />
							<stop offset="95%" stopColor="#10b981" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
					<XAxis
						className="text-muted-foreground text-xs"
						dataKey="label"
						tick={{ fontSize: 12 }}
					/>
					<YAxis
						className="text-muted-foreground text-xs"
						tick={{ fontSize: 12 }}
						tickFormatter={(v: number) =>
							v >= 1000000 || v <= -1000000
								? `${(v / 1000000).toFixed(1)}M`
								: v >= 1000 || v <= -1000
									? `${(v / 1000).toFixed(0)}k`
									: v.toFixed(0)
						}
					/>
					<Tooltip
						contentStyle={{
							backgroundColor: "hsl(var(--popover))",
							border: "1px solid hsl(var(--border))",
							borderRadius: "0.5rem",
							fontSize: "0.75rem",
						}}
						formatter={(value) =>
							typeof value === "number" ? formatCurrency(value) : ""
						}
					/>
					<Line
						connectNulls={false}
						dataKey="balance"
						dot={false}
						name="Historical"
						stroke="#3b82f6"
						strokeWidth={2.5}
						type="monotone"
					/>
					<Line
						connectNulls
						dataKey="forecast"
						dot={false}
						name="Forecast"
						stroke="#10b981"
						strokeDasharray="5 5"
						strokeWidth={2.5}
						type="monotone"
					/>
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
