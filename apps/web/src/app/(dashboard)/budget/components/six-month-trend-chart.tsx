"use client";

import type { MonthlySpend } from "@moat/client-ts";
import { Bar, BarChart, Cell, XAxis } from "recharts";
import { formatCompactCurrency, formatMonthLabel } from "~/lib/budget-utils";

interface SixMonthTrendChartProps {
	data: MonthlySpend[];
}

const BAR_COLOR = "#3b82f6";
const CHART_WIDTH = 400; // Dialog sm:max-w-md (448px) - padding
const CHART_HEIGHT = 128; // h-32

export function SixMonthTrendChart({ data }: SixMonthTrendChartProps) {
	// Transform data for the chart
	const chartData = data.map((d) => ({
		month: formatMonthLabel(d.month),
		amount: d.amount,
	}));

	return (
		<BarChart
			data={chartData}
			height={CHART_HEIGHT}
			layout="horizontal"
			margin={{ top: 5, right: 5, bottom: 5, left: 5 }}
			width={CHART_WIDTH}
		>
			<XAxis
				axisLine={false}
				dataKey="month"
				tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
				tickLine={false}
			/>
			<Bar
				dataKey="amount"
				fill={BAR_COLOR}
				label={<CustomBarLabel />}
				radius={[4, 4, 0, 0]}
			>
				{chartData.map((_entry, index) => (
					// biome-ignore lint/suspicious/noArrayIndexKey: chart data is stable
					<Cell fill={BAR_COLOR} key={index} />
				))}
			</Bar>
		</BarChart>
	);
}

interface CustomBarLabelProps {
	x?: number;
	y?: number;
	width?: number;
	height?: number;
	value?: number;
}

function CustomBarLabel({
	x = 0,
	y = 0,
	width = 0,
	height = 0,
	value = 0,
}: CustomBarLabelProps) {
	if (value === 0) return null;

	const formattedValue = formatCompactCurrency(value);

	// Calculate if label should be inside or outside based on bar height
	const minHeightForInside = 20;
	const labelInside = height >= minHeightForInside;

	// Text styling
	const fontSize = 10;
	const textX = x + width / 2;
	const textY = labelInside ? y + height / 2 : y - 4;

	return (
		<text
			dominantBaseline={labelInside ? "middle" : "auto"}
			fill={labelInside ? "#ffffff" : "var(--foreground)"}
			fontSize={fontSize}
			fontWeight="500"
			textAnchor="middle"
			x={textX}
			y={textY}
		>
			{formattedValue}
		</text>
	);
}
