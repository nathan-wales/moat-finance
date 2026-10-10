import type { RetirementConePoint } from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
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
import { formatCurrency } from "./utils";

export function RetirementConeChart({
	points,
	isLoading,
	title = "Monte Carlo range",
}: {
	points: RetirementConePoint[];
	isLoading?: boolean;
	title?: string;
}) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>{title}</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-72 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card>
			<CardHeader>
				<CardTitle>{title}</CardTitle>
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="h-80 w-full">
					<ResponsiveContainer height="100%" width="100%">
						<AreaChart data={points}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis
								dataKey="age"
								tick={{ fontSize: 11 }}
								tickFormatter={(value: number) => String(value)}
							/>
							<YAxis
								tick={{ fontSize: 11 }}
								tickFormatter={formatCurrency}
								width={80}
							/>
							<Tooltip
								content={({ active, payload, label }) => {
									if (!active || !payload?.length) return null;
									const point = payload[0]?.payload as
										| RetirementConePoint
										| undefined;
									const homeEquity = point?.realEstateEquity ?? 0;
									return (
										<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
											<p className="mb-1.5 font-medium text-foreground">
												Age {label}
											</p>
											{payload.map((entry) => (
												<div
													className="flex items-center gap-2"
													key={String(entry.dataKey)}
												>
													<span
														className="h-2 w-2 rounded-full"
														style={{ background: String(entry.color) }}
													/>
													<span className="text-muted-foreground">
														{entry.name}:
													</span>
													<span className="font-medium">
														{formatCurrency(Number(entry.value ?? 0))}
													</span>
												</div>
											))}
											{homeEquity > 1 ? (
												<p className="mt-1.5 text-muted-foreground">
													Plus {formatCurrency(homeEquity)} home equity
													{point !== undefined &&
													Math.abs(point.p10 - point.p25) < 1 &&
													point.p10 < 1
														? " · depleted trials sit on that floor"
														: ""}
												</p>
											) : null}
										</div>
									);
								}}
								cursor={chartLineTooltipCursor}
							/>
							<Area
								dataKey="p90"
								fill="var(--chart-1)"
								fillOpacity={0.08}
								name="90th"
								stroke="transparent"
								type="monotone"
							/>
							<Area
								dataKey="p75"
								fill="var(--chart-1)"
								fillOpacity={0.12}
								name="75th"
								stroke="transparent"
								type="monotone"
							/>
							<Area
								dataKey="p50"
								fill="none"
								name="Median"
								stroke="var(--chart-1)"
								strokeWidth={2}
								type="monotone"
							/>
							<Area
								dataKey="p25"
								fill="var(--chart-1)"
								fillOpacity={0.12}
								name="25th"
								stroke="transparent"
								type="monotone"
							/>
							<Area
								dataKey="p10"
								fill="var(--chart-1)"
								fillOpacity={0.08}
								name="10th"
								stroke="transparent"
								type="monotone"
							/>
						</AreaChart>
					</ResponsiveContainer>
				</div>
				<p className="text-muted-foreground text-xs">
					Range is investable (liquid) assets across simulated market paths.
					Home equity is not randomized and is shown separately in the tooltip.
				</p>
			</CardContent>
		</Card>
	);
}
