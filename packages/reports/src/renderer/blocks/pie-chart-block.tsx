import {
	Cell,
	Legend,
	Pie,
	PieChart,
	ResponsiveContainer,
	Tooltip,
} from "recharts";
import type { PieChartBlock } from "../../schema/moat-report-document.schema";

const COLORS = [
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
	block: PieChartBlock;
}

export function PieChartBlock({ block }: Props) {
	return (
		<div className="space-y-2">
			{block.title && (
				<p className="font-medium text-foreground text-sm">{block.title}</p>
			)}
			<ResponsiveContainer height={220} width="100%">
				<PieChart>
					<Pie
						cx="50%"
						cy="50%"
						data={block.data}
						dataKey="value"
						innerRadius={50}
						nameKey="name"
						outerRadius={90}
					>
						{block.data.map((entry, i) => (
							<Cell fill={COLORS[i % COLORS.length]} key={entry.name} />
						))}
					</Pie>
					<Tooltip />
					<Legend />
				</PieChart>
			</ResponsiveContainer>
		</div>
	);
}
