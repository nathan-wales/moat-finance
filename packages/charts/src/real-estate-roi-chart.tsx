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
import { formatCurrency, type RealEstateProjectionPoint } from "./utils";

interface Props {
	data: RealEstateProjectionPoint[];
}

function CustomTooltip({
	active,
	payload,
}: {
	active?: boolean;
	payload?: { payload: RealEstateProjectionPoint }[];
}) {
	if (!active || !payload?.[0]) return null;
	const d = payload[0].payload;

	return (
		<div className="min-w-[200px] space-y-1 rounded-lg border bg-background p-3 text-xs shadow-md">
			<p className="font-semibold text-sm">Year {d.year}</p>
			<div className="grid grid-cols-2 gap-x-4 gap-y-0.5">
				<span className="text-muted-foreground">Equity</span>
				<span className="font-medium">{formatCurrency(d.projectedEquity)}</span>
				<span className="text-muted-foreground">Property Value</span>
				<span className="font-medium">
					{formatCurrency(d.projectedPropertyValue)}
				</span>
				<span className="text-muted-foreground">Loan Balance</span>
				<span className="font-medium">
					{formatCurrency(d.projectedLoanBalance)}
				</span>
				<span className="text-muted-foreground">Annual Cash Flow</span>
				<span
					className={
						d.annualCashFlow >= 0
							? "font-medium text-green-600"
							: "font-medium text-red-500"
					}
				>
					{formatCurrency(d.annualCashFlow)}
				</span>
				<span className="text-muted-foreground">Cumulative Cash Flow</span>
				<span
					className={
						d.cumulativeCashFlow >= 0
							? "font-medium text-green-600"
							: "font-medium text-red-500"
					}
				>
					{formatCurrency(d.cumulativeCashFlow)}
				</span>
				<span className="text-muted-foreground">Total Gain</span>
				<span className="font-medium">{formatCurrency(d.totalGain)}</span>
			</div>
		</div>
	);
}

export function RealEstateEquityChart({ data }: Props) {
	if (!data.length) return null;

	const yearTicks = Array.from(new Set(data.map((point) => point.year))).sort(
		(a, b) => a - b,
	);
	const firstYearTick = yearTicks[0] ?? 0;
	const lastYearTick = yearTicks[yearTicks.length - 1] ?? firstYearTick;

	const formatYAxis = (v: number) => {
		if (v >= 1_000_000) return `$${(v / 1_000_000).toFixed(1)}M`;
		if (v >= 1_000) return `$${(v / 1_000).toFixed(0)}k`;
		return `$${v.toFixed(0)}`;
	};

	return (
		<ResponsiveContainer height={200} width="100%">
			<AreaChart data={data} margin={{ top: 4, right: 8, bottom: 0, left: 0 }}>
				<defs>
					<linearGradient id="equityGradient" x1="0" x2="0" y1="0" y2="1">
						<stop offset="5%" stopColor="#22c55e" stopOpacity={0.15} />
						<stop offset="95%" stopColor="#22c55e" stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid stroke="var(--chart-grid)" strokeDasharray="3 3" />
				<XAxis
					allowDecimals={false}
					dataKey="year"
					domain={[firstYearTick, lastYearTick]}
					interval={0}
					tick={{ fontSize: 11 }}
					tickFormatter={(v: number) => `Yr ${v}`}
					ticks={yearTicks}
					type="number"
				/>
				<YAxis tick={{ fontSize: 11 }} tickFormatter={formatYAxis} width={56} />
				<Tooltip content={<CustomTooltip />} cursor={chartLineTooltipCursor} />
				<Area
					baseValue="dataMin"
					dataKey="projectedEquity"
					dot={{ r: 3 }}
					fill="url(#equityGradient)"
					name="Equity"
					stroke="#22c55e"
					strokeWidth={2}
					type="monotone"
				/>
			</AreaChart>
		</ResponsiveContainer>
	);
}
