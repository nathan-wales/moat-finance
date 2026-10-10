import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
import { useEffect, useState } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	Line,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartInfoIcon } from "./chart-info-icon";
import { chartLineTooltipCursor } from "./chart-theme";
import { flattenSingleMonthSeries } from "./flatten-single-point";
import { MonthChangeBadge } from "./month-change-badge";
import { formatCurrency, formatMonthLabel } from "./utils";

const TOOLTIP_ORDER = ["netWorth", "forecast"];

const NET_WORTH_HELP =
	"Assets minus included liabilities. Credit cards reduce this total. Loans and mortgages are left out unless you opt them in — real estate already counts as equity. This can differ from Portfolio overview, which shows live assets only and ignores debts.";

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

export type NetWorthHistoricalPoint = {
	month: string;
	total: number;
};

export type NetWorthForecastPoint = {
	month: string;
	total: number;
};

interface Props {
	historical?: NetWorthHistoricalPoint[];
	forecast?: NetWorthForecastPoint[];
	forecastYears?: number;
	isLoading?: boolean;
	forecastSelector?: React.ReactNode;
	/** Optional actions rendered in the card header (e.g. Prompts menu). */
	headerActions?: React.ReactNode;
}

export function NetWorthChart({
	historical = [],
	forecast = [],
	forecastYears,
	isLoading,
	forecastSelector,
	headerActions,
}: Props) {
	const [isSmallScreen, setIsSmallScreen] = useState(false);

	useEffect(() => {
		const check = () => setIsSmallScreen(window.innerWidth < 1024);
		check();
		window.addEventListener("resize", check);
		return () => window.removeEventListener("resize", check);
	}, []);

	if (isLoading) {
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

	const historicalPoints = historical.map((p) => ({
		month: p.month,
		label: formatMonthLabel(p.month),
		netWorth: p.total,
	}));

	const currentNetWorth = historicalPoints.at(-1)?.netWorth ?? 0;
	const hasForecast = forecast.length > 0;
	const forecastedNetWorth = forecast.at(-1)?.total ?? currentNetWorth;
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
		...forecast.map((p) => ({
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
					<CardTitle className="flex items-center gap-1.5">
						Net Worth
						<ChartInfoIcon label="Net Worth" text={NET_WORTH_HELP} />
					</CardTitle>
					{historicalPoints.length > 0 && (
						<div className="mt-1 flex flex-wrap items-center gap-2 text-sm">
							<span className="font-semibold">
								{formatCurrency(currentNetWorth)}
							</span>
							<MonthChangeBadge
								points={historicalPoints.map((point) => ({
									total: point.netWorth,
								}))}
							/>
							{hasForecast && (
								<>
									<span className="text-muted-foreground text-xs">→</span>
									<span className="font-semibold text-emerald-600 dark:text-emerald-400">
										{formatCurrency(forecastedNetWorth)}
									</span>
									{forecastYears != null && (
										<span className="text-muted-foreground text-xs">
											in {forecastYears}y
										</span>
									)}
								</>
							)}
						</div>
					)}
				</div>
				<div className="flex items-center gap-1">
					{forecastSelector}
					{headerActions}
				</div>
			</CardHeader>
			<CardContent>
				<ResponsiveContainer height={300} width="100%">
					<AreaChart data={chartData}>
						<defs>
							<linearGradient
								id="netWorthAreaGradient"
								x1="0"
								x2="0"
								y1="0"
								y2="1"
							>
								<stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
								<stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
							</linearGradient>
						</defs>
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
						<Tooltip
							content={<NetWorthTooltip />}
							cursor={chartLineTooltipCursor}
						/>
						<Area
							dataKey="netWorth"
							dot={false}
							fill="url(#netWorthAreaGradient)"
							name="Historical"
							stroke="#3b82f6"
							strokeWidth={2}
							type="linear"
						/>
						{hasForecast && (
							<Line
								dataKey="forecast"
								dot={false}
								name="Forecast"
								stroke="#10b981"
								strokeDasharray="5 5"
								strokeWidth={1.5}
								type="monotone"
							/>
						)}
					</AreaChart>
				</ResponsiveContainer>
			</CardContent>
		</Card>
	);
}
