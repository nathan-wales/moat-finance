import { Skeleton } from "@moat/ui";
import { useId } from "react";
import {
	Area,
	AreaChart,
	CartesianGrid,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { chartLineTooltipCursor } from "./chart-theme";
import { flattenSingleMonthSeries } from "./flatten-single-point";
import { MonthChangeBadge } from "./month-change-badge";
import { formatCurrency, formatMonthLabel } from "./utils";

export type AssetValuePoint = {
	month: string;
	total: number;
};

function currentMonthKey(now = new Date()): string {
	const month = String(now.getMonth() + 1).padStart(2, "0");
	return `${now.getFullYear()}-${month}`;
}

type PlotPoint = {
	slot: number;
	month: string;
	label: string;
	value: number;
};

function toPlotPoints(points: AssetValuePoint[]): PlotPoint[] {
	return flattenSingleMonthSeries(points).map((point, index) => ({
		slot: index,
		month: point.month,
		label: formatMonthLabel(point.month),
		value: point.total,
	}));
}

function AssetValueTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: {
		name: string;
		value: number;
		color: string;
		payload?: PlotPoint;
	}[];
}) {
	if (!active || !payload?.length) return null;
	const entry = payload[0];
	if (!entry || entry.value == null) return null;
	const heading = entry.payload
		? formatMonthLabel(entry.payload.month)
		: undefined;
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			{heading ? (
				<p className="mb-1.5 font-medium text-foreground">{heading}</p>
			) : null}
			<div className="flex items-center gap-2">
				<span
					className="h-2 w-2 rounded-full"
					style={{ background: entry.color }}
				/>
				<span className="font-medium">{formatCurrency(entry.value)}</span>
			</div>
		</div>
	);
}

interface Props {
	points?: AssetValuePoint[];
	current?: number;
	isLoading?: boolean;
	showHeader?: boolean;
	height?: number;
}

export function AssetValueChart({
	points = [],
	current,
	isLoading,
	showHeader = true,
	height = 180,
}: Props) {
	const gradientId = `assetValueArea-${useId().replace(/:/g, "")}`;

	if (isLoading) {
		return (
			<div className="space-y-3">
				{showHeader ? <Skeleton className="h-6 w-40" /> : null}
				<Skeleton className="h-40 w-full" />
			</div>
		);
	}

	const currentValue = current ?? points.at(-1)?.total ?? 0;
	const resolvedPoints =
		points.length > 0
			? points
			: [{ month: currentMonthKey(), total: currentValue }];
	const chartData = toPlotPoints(resolvedPoints);

	return (
		<div>
			{showHeader ? (
				<div className="mb-2 flex flex-wrap items-center gap-2 text-sm">
					<span className="font-semibold">{formatCurrency(currentValue)}</span>
					<MonthChangeBadge points={resolvedPoints} />
				</div>
			) : null}
			<ResponsiveContainer height={height} width="100%">
				<AreaChart data={chartData}>
					<defs>
						<linearGradient id={gradientId} x1="0" x2="0" y1="0" y2="1">
							<stop offset="0%" stopColor="#3b82f6" stopOpacity={0.28} />
							<stop offset="100%" stopColor="#3b82f6" stopOpacity={0} />
						</linearGradient>
					</defs>
					<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
					<XAxis
						dataKey="slot"
						interval={Math.max(0, Math.ceil(chartData.length / 6) - 1)}
						tick={{ fontSize: 10 }}
						tickFormatter={(slot: number | string) =>
							chartData.find((point) => point.slot === Number(slot))?.label ??
							""
						}
						tickLine={false}
					/>
					<YAxis
						tick={{ fontSize: 10 }}
						tickFormatter={(v: number) => formatCurrency(v)}
						tickLine={false}
						width={72}
					/>
					<Tooltip
						content={<AssetValueTooltip />}
						cursor={chartLineTooltipCursor}
					/>
					<Area
						activeDot={false}
						dataKey="value"
						dot={false}
						fill={`url(#${gradientId})`}
						name="Value"
						stroke="#3b82f6"
						strokeWidth={2}
						type="linear"
					/>
				</AreaChart>
			</ResponsiveContainer>
		</div>
	);
}
