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
import type { LineChartBlock } from "../../schema/moat-report-document.schema";

const SERIES_COLORS = [
	"#3b82f6",
	"#8b5cf6",
	"#10b981",
	"#f59e0b",
	"#ef4444",
	"#06b6d4",
	"#ec4899",
	"#84cc16",
	"#f97316",
	"#6366f1",
];

interface Props {
	block: LineChartBlock;
}

export function LineChartBlock({ block }: Props) {
	const chartData = block.categories.map((cat, i) => {
		const point: Record<string, string | number> = { name: cat };
		for (const s of block.series) {
			point[s.name] = s.data[i] ?? 0;
		}
		return point;
	});

	return (
		<div className="space-y-2">
			{block.title && (
				<p className="font-medium text-foreground text-sm">{block.title}</p>
			)}
			{block.description && (
				<p className="text-muted-foreground text-xs">{block.description}</p>
			)}
			<ResponsiveContainer height={220} width="100%">
				<LineChart
					data={chartData}
					margin={{ top: 4, right: 8, bottom: 0, left: 0 }}
				>
					<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
					<XAxis dataKey="name" tick={{ fontSize: 11 }} tickLine={false} />
					<YAxis tick={{ fontSize: 11 }} tickLine={false} width={48} />
					<Tooltip />
					{block.series.length > 1 && <Legend />}
					{block.series.map((s, i) => (
						<Line
							dataKey={s.name}
							dot={false}
							key={s.name}
							stroke={SERIES_COLORS[i % SERIES_COLORS.length]}
							strokeWidth={2}
							type="monotone"
						/>
					))}
				</LineChart>
			</ResponsiveContainer>
		</div>
	);
}
