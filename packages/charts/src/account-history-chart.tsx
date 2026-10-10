"use client";

import { Skeleton } from "@moat/ui";
import { useId, useMemo, useState } from "react";
import {
	Area,
	AreaChart,
	Line,
	ResponsiveContainer,
	Tooltip,
	YAxis,
} from "recharts";
import { flattenSinglePointSeries } from "./flatten-single-point";
import { formatCurrency } from "./utils";

const POSITIVE = "#10b981";
const NEGATIVE = "#f43f5e";

export type AccountHistoryChartPoint = {
	date: string;
	balance: number;
};

export type AccountHistoryRange =
	| "1D"
	| "1W"
	| "1M"
	| "3M"
	| "YTD"
	| "1Y"
	| "ALL";

const RANGES: AccountHistoryRange[] = [
	"1D",
	"1W",
	"1M",
	"3M",
	"YTD",
	"1Y",
	"ALL",
];

function rangeLabel(range: AccountHistoryRange): string {
	switch (range) {
		case "1D":
			return "Today";
		case "1W":
			return "Past week";
		case "1M":
			return "Past month";
		case "3M":
			return "Past 3 months";
		case "YTD":
			return "Year to date";
		case "1Y":
			return "Past year";
		case "ALL":
			return "All time";
	}
}

function startOfUtcDay(date: Date): Date {
	return new Date(
		Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()),
	);
}

function addUtcDays(date: Date, days: number): Date {
	const next = new Date(date);
	next.setUTCDate(next.getUTCDate() + days);
	return next;
}

function rangeStart(range: AccountHistoryRange, now: Date): Date | null {
	const today = startOfUtcDay(now);
	switch (range) {
		case "1D":
			return addUtcDays(today, -1);
		case "1W":
			return addUtcDays(today, -7);
		case "1M":
			return addUtcDays(today, -30);
		case "3M":
			return addUtcDays(today, -90);
		case "YTD":
			return new Date(Date.UTC(today.getUTCFullYear(), 0, 1));
		case "1Y":
			return addUtcDays(today, -365);
		case "ALL":
			return null;
	}
}

function filterPoints(
	points: AccountHistoryChartPoint[],
	range: AccountHistoryRange,
	now: Date = new Date(),
): AccountHistoryChartPoint[] {
	if (points.length === 0) return [];
	const sorted = [...points].sort((a, b) => a.date.localeCompare(b.date));
	if (range === "1D") {
		if (sorted.length === 1) return sorted;
		return sorted.slice(-2);
	}
	const start = rangeStart(range, now);
	if (!start) return sorted;
	const startIso = start.toISOString().slice(0, 10);
	const inRange = sorted.filter((point) => point.date.slice(0, 10) >= startIso);
	if (inRange.length > 0) return inRange;
	return sorted.slice(-1);
}

function computeDelta(points: AccountHistoryChartPoint[]): {
	absolute: number;
	percent: number;
} {
	if (points.length === 0) return { absolute: 0, percent: 0 };
	const first = points[0]?.balance ?? 0;
	const last = points.at(-1)?.balance ?? 0;
	const absolute = last - first;
	const percent = first === 0 ? 0 : (absolute / Math.abs(first)) * 100;
	return { absolute, percent };
}

function todayIso(now: Date = new Date()): string {
	return now.toISOString().slice(0, 10);
}

function seedCurrentBalancePoint(
	points: AccountHistoryChartPoint[],
	currentBalance?: number,
): AccountHistoryChartPoint[] {
	if (points.length > 0) return points;
	if (currentBalance === undefined) return [];
	return [{ date: todayIso(), balance: currentBalance }];
}

function yDomain(values: number[]): [number, number] {
	if (values.length === 0) return [0, 1];
	const min = Math.min(...values);
	const max = Math.max(...values);
	const span = max - min;
	const pad = span === 0 ? Math.max(Math.abs(min) * 0.02, 1) : span * 0.16;
	return [min - pad, max + pad];
}

function scrubIndexFromTooltip(
	index: number | string | null | undefined,
): number | null {
	if (typeof index === "number" && Number.isInteger(index) && index >= 0) {
		return index;
	}
	if (typeof index === "string" && /^\d+$/.test(index)) return Number(index);
	return null;
}

function formatPointDate(iso: string, now: Date = new Date()): string {
	const [yearStr, monthStr, dayStr] = iso.slice(0, 10).split("-");
	const year = Number(yearStr);
	const month = Number(monthStr);
	const day = Number(dayStr);
	if (!year || !month || !day) return iso;
	const date = new Date(Date.UTC(year, month - 1, day));
	return date.toLocaleDateString("en-US", {
		month: "short",
		day: "numeric",
		year: year === now.getUTCFullYear() ? undefined : "numeric",
		timeZone: "UTC",
	});
}

type Props = {
	points?: AccountHistoryChartPoint[];
	currentBalance?: number;
	isLoading?: boolean;
	emptyLabel?: string;
};

function formatSignedCurrency(value: number): string {
	const absolute = formatCurrency(Math.abs(value));
	if (value > 0) return `+${absolute}`;
	if (value < 0) return `-${absolute}`;
	return absolute;
}

function formatPercent(value: number): string {
	const absolute = Math.abs(value).toFixed(2);
	if (value > 0) return `+${absolute}%`;
	if (value < 0) return `-${absolute}%`;
	return `${absolute}%`;
}

export function AccountHistoryChart({
	points = [],
	currentBalance,
	isLoading = false,
	emptyLabel = "Balance history will appear after the next sync.",
}: Props) {
	const gradientId = `accountHistoryArea-${useId().replace(/:/g, "")}`;
	const [range, setRange] = useState<AccountHistoryRange>("1M");
	const [scrubIndex, setScrubIndex] = useState<number | null>(null);

	const series = useMemo(
		() => seedCurrentBalancePoint(points, currentBalance),
		[points, currentBalance],
	);
	const filtered = useMemo(() => filterPoints(series, range), [series, range]);
	const drawable = useMemo(
		() => flattenSinglePointSeries(filtered),
		[filtered],
	);
	const delta = useMemo(() => computeDelta(filtered), [filtered]);
	const isPositive = delta.absolute >= 0;
	const color = isPositive ? POSITIVE : NEGATIVE;
	const hoveredPoint = scrubIndex != null ? drawable[scrubIndex] : undefined;
	const displayBalance =
		hoveredPoint?.balance ?? currentBalance ?? drawable.at(-1)?.balance ?? 0;
	const hoverDate = hoveredPoint ? formatPointDate(hoveredPoint.date) : null;

	const chartData = drawable.map((point, index) => ({
		...point,
		index,
		label: point.date,
	}));
	const domain = yDomain(chartData.map((point) => point.balance));

	if (isLoading) {
		return (
			<div className="space-y-3">
				<Skeleton className="h-9 w-40" />
				<Skeleton className="h-4 w-48" />
				<Skeleton className="h-40 w-full" />
				<Skeleton className="h-8 w-full" />
			</div>
		);
	}

	if (series.length === 0) {
		return (
			<div className="rounded-lg border border-dashed p-6 text-center text-muted-foreground text-sm">
				{emptyLabel}
			</div>
		);
	}

	return (
		<div className="space-y-3">
			<div>
				<p className="font-semibold text-3xl tracking-tight">
					{formatCurrency(displayBalance)}
				</p>
				<p
					className="mt-1 flex items-center gap-1 whitespace-nowrap text-sm"
					style={{ color }}
				>
					<span aria-hidden>{isPositive ? "▲" : "▼"}</span>
					<span>
						{formatSignedCurrency(delta.absolute)} (
						{formatPercent(delta.percent)}) {rangeLabel(range)}
						{hoverDate ? <span> • {hoverDate}</span> : null}
					</span>
				</p>
			</div>

			<div className="h-44 w-full">
				<ResponsiveContainer height="100%" width="100%">
					<AreaChart
						data={chartData}
						margin={{ top: 8, right: 8, left: 0, bottom: 0 }}
						onMouseLeave={() => setScrubIndex(null)}
						onMouseMove={(state) => {
							setScrubIndex(scrubIndexFromTooltip(state?.activeTooltipIndex));
						}}
					>
						<defs>
							<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
								<stop offset="0%" stopColor={color} stopOpacity={0.28} />
								<stop offset="100%" stopColor={color} stopOpacity={0} />
							</linearGradient>
						</defs>
						<YAxis domain={domain} hide />
						<Tooltip content={() => null} cursor={false} />
						<Area
							activeDot={{ r: 5, fill: color, strokeWidth: 0 }}
							baseValue={domain[0]}
							dataKey="balance"
							dot={false}
							fill={`url(#${gradientId})`}
							isAnimationActive={false}
							stroke={color}
							strokeWidth={2}
							type="monotone"
						/>
						{chartData.length > 0 && (
							<Line
								dataKey="balance"
								dot={(props) => {
									const { cx, cy, index } = props;
									if (
										index !== chartData.length - 1 ||
										cx == null ||
										cy == null
									) {
										return <g key={`dot-${index}`} />;
									}
									return (
										<circle
											cx={cx}
											cy={cy}
											fill={color}
											key={`end-dot-${index}`}
											r={4}
										/>
									);
								}}
								isAnimationActive={false}
								legendType="none"
								stroke="transparent"
								strokeWidth={0}
								tooltipType="none"
								type="monotone"
							/>
						)}
					</AreaChart>
				</ResponsiveContainer>
			</div>

			<div className="flex flex-wrap items-center gap-1 border-border border-t border-dashed pt-3">
				{RANGES.map((option) => {
					const selected = option === range;
					return (
						<button
							className={
								selected
									? "rounded-full px-2.5 py-1 font-semibold text-xs"
									: "rounded-full px-2.5 py-1 text-xs hover:bg-muted"
							}
							key={option}
							onClick={() => {
								setRange(option);
								setScrubIndex(null);
							}}
							style={
								selected ? { backgroundColor: color, color: "#000" } : { color }
							}
							type="button"
						>
							{option}
						</button>
					);
				})}
			</div>
		</div>
	);
}
