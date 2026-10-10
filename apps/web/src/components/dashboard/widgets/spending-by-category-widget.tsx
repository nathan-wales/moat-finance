"use client";

import {
	type CategoryBreakdown,
	getSpendingCategoryBreakdown,
} from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/forecasting";
import type { WidgetConfig } from "~/lib/widgets/widget-registry";

const COLORS = [
	"#3b82f6", // blue
	"#10b981", // green
	"#f59e0b", // amber
	"#ef4444", // red
	"#8b5cf6", // purple
	"#ec4899", // pink
	"#14b8a6", // teal
	"#f97316", // orange
];

export function SpendingByCategoryWidget({ config }: { config: WidgetConfig }) {
	const months =
		config.timeframe === "1M"
			? 1
			: config.timeframe === "3M"
				? 3
				: config.timeframe === "6M"
					? 6
					: 12;

	const { data, isLoading } = useQuery({
		queryKey: ["spending", "byCategory", { months }],
		queryFn: async () => {
			const response = await getSpendingCategoryBreakdown({ months });
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to fetch spending by category");
			}
			return response.data.data;
		},
	});

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	if (!data || data.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
				No spending data available
			</div>
		);
	}

	const chartData = data
		.map((item: CategoryBreakdown) => ({
			name: item.category || "Uncategorized",
			value: Math.abs(item.total),
		}))
		.filter((item: { name: string; value: number }) => item.value > 0)
		.slice(0, 8);

	return (
		<div className="h-64 w-full">
			<ResponsiveContainer height="100%" width="100%">
				<PieChart>
					<Pie
						cx="50%"
						cy="50%"
						data={chartData}
						dataKey="value"
						fill="#8884d8"
						label={({ name, percent }: { name?: string; percent?: number }) =>
							`${name || "Unknown"} ${percent ? (percent * 100).toFixed(0) : 0}%`
						}
						labelLine={false}
						outerRadius={80}
					>
						{chartData.map(
							(entry: { name: string; value: number }, idx: number) => (
								<Cell fill={COLORS[idx % COLORS.length]} key={entry.name} />
							),
						)}
					</Pie>
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
					<Legend
						iconSize={8}
						iconType="circle"
						wrapperStyle={{ fontSize: "11px" }}
					/>
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
