import type { RetirementComparisonColumn } from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
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
import { chartLineTooltipCursor } from "./chart-theme";
import { formatCurrency } from "./utils";

const FALLBACK_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
];

export function RetirementComparisonChart({
	columns,
	isLoading,
}: {
	columns: RetirementComparisonColumn[];
	isLoading?: boolean;
}) {
	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Scenario overlay</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-72 w-full" />
				</CardContent>
			</Card>
		);
	}

	if (columns.length === 0) return null;

	const ages = Array.from(
		new Set(
			columns.flatMap((column) => column.series.map((point) => point.age)),
		),
	).sort((a, b) => a - b);

	const data = ages.map((age) => {
		const row: Record<string, number | string> = { age, ageLabel: String(age) };
		for (const column of columns) {
			const point = column.series.find((entry) => entry.age === age);
			if (point) row[column.name] = point.netWorth;
		}
		return row;
	});

	return (
		<Card>
			<CardHeader>
				<CardTitle>Scenario overlay</CardTitle>
			</CardHeader>
			<CardContent>
				<div className="h-80 w-full">
					<ResponsiveContainer height="100%" width="100%">
						<LineChart data={data}>
							<CartesianGrid strokeDasharray="3 3" vertical={false} />
							<XAxis dataKey="ageLabel" tick={{ fontSize: 11 }} />
							<YAxis
								tick={{ fontSize: 11 }}
								tickFormatter={formatCurrency}
								width={80}
							/>
							<Tooltip
								content={({ active, payload, label }) => {
									if (!active || !payload?.length) return null;
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
										</div>
									);
								}}
								cursor={chartLineTooltipCursor}
							/>
							<Legend />
							{columns.map((column, index) => (
								<Line
									connectNulls
									dataKey={column.name}
									dot={false}
									key={column.scenarioId ?? column.name}
									name={column.name}
									stroke={
										column.color ??
										FALLBACK_COLORS[index % FALLBACK_COLORS.length]
									}
									strokeDasharray={
										column.scenarioId === null ? "6 4" : undefined
									}
									strokeWidth={2}
									type="monotone"
								/>
							))}
						</LineChart>
					</ResponsiveContainer>
				</div>
			</CardContent>
		</Card>
	);
}
