"use client";

import { flattenSingleMonthSeries } from "@moat/charts";
import { getBalanceSnapshotHistory } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import {
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { StaleBalanceNotice } from "~/components/plaid/stale-balance-notice";
import { Skeleton } from "~/components/ui/skeleton";
import { useForecast } from "~/context/forecast-context";
import {
	formatCurrency,
	formatMonthLabel,
	projectNetWorth,
	SCENARIO_PRESETS,
} from "~/lib/forecasting";
import type { WidgetConfig } from "~/lib/widgets/widget-registry";

const TOOLTIP_ORDER = ["netWorth", "aggressive", "expected", "conservative"];

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

export function NetWorthChartWidget({ config }: { config: WidgetConfig }) {
	const { forecastMonths } = useForecast();
	const months = config.timeframe === "12M" ? 12 : 24;

	const { data: historyResponse, isLoading } = useQuery({
		queryKey: ["balanceSnapshot", "getHistory", { months }],
		queryFn: () => getBalanceSnapshotHistory({ months }),
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
				No balance history available
			</div>
		);
	}

	const historicalPoints = historical.map((p) => ({
		month: p.month,
		label: formatMonthLabel(p.month),
		netWorth: p.total,
	}));

	const currentNetWorth = historicalPoints.at(-1)?.netWorth ?? 0;

	const conservativeForecast = projectNetWorth(
		currentNetWorth,
		forecastMonths,
		SCENARIO_PRESETS.CONSERVATIVE.annualReturnRate,
	);
	const standardForecast = projectNetWorth(
		currentNetWorth,
		forecastMonths,
		SCENARIO_PRESETS.STANDARD.annualReturnRate,
	);
	const aggressiveForecast = projectNetWorth(
		currentNetWorth,
		forecastMonths,
		SCENARIO_PRESETS.AGGRESSIVE.annualReturnRate,
	);

	const allPoints = [
		...historicalPoints,
		...conservativeForecast,
		...standardForecast,
		...aggressiveForecast,
	];

	const minValue = Math.min(
		...allPoints.map((p) => ("netWorth" in p ? p.netWorth : p.value)),
	);
	const maxValue = Math.max(
		...allPoints.map((p) => ("netWorth" in p ? p.netWorth : p.value)),
	);
	const margin = (maxValue - minValue) * 0.1 || 1000;

	const merged = historicalPoints.map((h, idx) => ({
		...h,
		conservative: conservativeForecast[idx]?.value ?? null,
		expected: standardForecast[idx]?.value ?? null,
		aggressive: aggressiveForecast[idx]?.value ?? null,
	}));

	for (let i = historicalPoints.length; i < conservativeForecast.length; i++) {
		const conservative = conservativeForecast[i];
		const standard = standardForecast[i];
		const aggressive = aggressiveForecast[i];
		if (conservative && standard && aggressive) {
			merged.push({
				month: conservative.month,
				label: formatMonthLabel(conservative.month),
				netWorth: conservative.value,
				conservative: conservative.value,
				expected: standard.value,
				aggressive: aggressive.value,
			});
		}
	}

	const chartData = flattenSingleMonthSeries(merged).map((point) => ({
		...point,
		label: formatMonthLabel(point.month),
	}));

	return (
		<div className="space-y-3">
			<StaleBalanceNotice />
			<div className="h-64 w-full">
				<ResponsiveContainer height="100%" width="100%">
					<LineChart data={chartData}>
						<defs>
							<linearGradient id="netWorthGradient" x1="0" x2="0" y1="0" y2="1">
								<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
								<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
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
							domain={[minValue - margin, maxValue + margin]}
							tick={{ fontSize: 12 }}
							tickFormatter={(v: number) =>
								v >= 1000000 || v <= -1000000
									? `${(v / 1000000).toFixed(1)}M`
									: v >= 1000 || v <= -1000
										? `${(v / 1000).toFixed(0)}k`
										: v.toFixed(0)
							}
							width={60}
						/>
						<Tooltip content={<NetWorthTooltip />} />
						<Legend
							iconSize={12}
							iconType="line"
							wrapperStyle={{ fontSize: "12px" }}
						/>
						<Line
							connectNulls={false}
							dataKey="netWorth"
							dot={false}
							name="Net Worth"
							stroke="#3b82f6"
							strokeWidth={2.5}
							type="monotone"
						/>
						<Line
							connectNulls
							dataKey="conservative"
							dot={false}
							name="Conservative"
							stroke="#f59e0b"
							strokeDasharray="5 5"
							strokeWidth={2.5}
							type="monotone"
						/>
						<Line
							connectNulls
							dataKey="expected"
							dot={false}
							name="Expected"
							stroke="#10b981"
							strokeDasharray="5 5"
							strokeWidth={2.5}
							type="monotone"
						/>
						<Line
							connectNulls
							dataKey="aggressive"
							dot={false}
							name="Aggressive"
							stroke="#8b5cf6"
							strokeDasharray="5 5"
							strokeWidth={2.5}
							type="monotone"
						/>
					</LineChart>
				</ResponsiveContainer>
			</div>
		</div>
	);
}
