import { Skeleton } from "@moat/ui";
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
import {
	forecastInvestmentGrowth,
	formatCurrency,
	formatMonthLabel,
	type InvestmentInputs,
} from "./utils";

interface Props extends InvestmentInputs {
	scenarioReturnRate?: number;
	forecastMonths?: number;
	isLoading?: boolean;
}

export function InvestmentGrowthChart({
	startingBalance,
	monthlyContribution,
	annualReturnRate,
	scenarioReturnRate,
	forecastMonths = 60,
	isLoading,
}: Props) {
	if (isLoading) return <Skeleton className="h-40 w-full" />;

	const baseForecast = forecastInvestmentGrowth(
		{ startingBalance, monthlyContribution, annualReturnRate },
		forecastMonths,
	);

	const scenarioForecast = scenarioReturnRate
		? forecastInvestmentGrowth(
				{
					startingBalance,
					monthlyContribution,
					annualReturnRate: scenarioReturnRate,
				},
				forecastMonths,
			)
		: null;

	const chartData = baseForecast.map((point, i) => ({
		label: formatMonthLabel(point.month),
		balance: point.balance,
		scenario: scenarioForecast?.[i]?.balance,
	}));

	return (
		<ResponsiveContainer height={180} width="100%">
			<AreaChart data={chartData}>
				<defs>
					<linearGradient id="balanceGradient" x1="0" x2="0" y1="0" y2="1">
						<stop offset="5%" stopColor="#3b82f6" stopOpacity={0.15} />
						<stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
					</linearGradient>
				</defs>
				<CartesianGrid className="stroke-muted" strokeDasharray="3 3" />
				<XAxis
					dataKey="label"
					interval={Math.max(0, Math.ceil(chartData.length / 8) - 1)}
					tick={{ fontSize: 10 }}
					tickLine={false}
				/>
				<YAxis
					tick={{ fontSize: 10 }}
					tickFormatter={(v: number) => formatCurrency(v)}
					tickLine={false}
					width={72}
				/>
				<Tooltip
					contentStyle={{
						backgroundColor: "var(--popover)",
						border: "1px solid var(--border)",
						borderRadius: "var(--radius)",
					}}
					cursor={chartLineTooltipCursor}
					formatter={(v) => [formatCurrency(Number(v)), ""]}
					labelStyle={{ color: "var(--popover-foreground)" }}
				/>
				<Area
					dataKey="balance"
					dot={false}
					fill="url(#balanceGradient)"
					name="Projected"
					stroke="#3b82f6"
					strokeWidth={2}
					type="monotone"
				/>
				{scenarioForecast && (
					<Area
						dataKey="scenario"
						dot={false}
						fill="none"
						name="Scenario"
						stroke="#8b5cf6"
						strokeDasharray="4 4"
						strokeWidth={1.5}
						type="monotone"
					/>
				)}
			</AreaChart>
		</ResponsiveContainer>
	);
}
