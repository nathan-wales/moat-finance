"use client";

import { getMonthlyAggregates } from "@moat/client-ts";
import { useQuery } from "@tanstack/react-query";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { Skeleton } from "~/components/ui/skeleton";
import { formatCurrency } from "~/lib/forecasting";
import type { WidgetConfig } from "~/lib/widgets/widget-registry";

export function MonthlyCashFlowWidget({ config }: { config: WidgetConfig }) {
	const months =
		config.timeframe === "1M"
			? 1
			: config.timeframe === "3M"
				? 3
				: config.timeframe === "6M"
					? 6
					: 12;

	const { data, isLoading } = useQuery({
		queryKey: ["transaction", "getMonthlyAggregates", { months }],
		queryFn: async () => {
			const response = await getMonthlyAggregates({ months });
			if (response.status !== 200 && response.status !== 304) {
				throw new Error("Failed to fetch monthly aggregates");
			}
			return response.data.data;
		},
	});

	if (isLoading) {
		return <Skeleton className="h-64 w-full" />;
	}

	const monthlyPoints = data?.months ?? [];

	if (monthlyPoints.length === 0) {
		return (
			<div className="flex h-48 items-center justify-center text-muted-foreground text-sm">
				No cash flow data available
			</div>
		);
	}

	const chartData = monthlyPoints.map((item) => ({
		month: item.month,
		income: item.income,
		expenses: Math.abs(item.expenses),
		net: item.netGain,
	}));

	return (
		<div className="h-64 w-full">
			<ResponsiveContainer height="100%" width="100%">
				<BarChart data={chartData}>
					<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
					<XAxis
						className="text-muted-foreground text-xs"
						dataKey="month"
						tick={{ fontSize: 12 }}
					/>
					<YAxis
						className="text-muted-foreground text-xs"
						tick={{ fontSize: 12 }}
						tickFormatter={(v: number) =>
							v >= 10000 ? `${(v / 1000).toFixed(0)}k` : v.toFixed(0)
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
					<Legend
						iconSize={12}
						iconType="rect"
						wrapperStyle={{ fontSize: "12px" }}
					/>
					<Bar
						dataKey="income"
						fill="#10b981"
						name="Income"
						radius={[4, 4, 0, 0]}
					/>
					<Bar
						dataKey="expenses"
						fill="#ef4444"
						name="Expenses"
						radius={[4, 4, 0, 0]}
					/>
				</BarChart>
			</ResponsiveContainer>
		</div>
	);
}
