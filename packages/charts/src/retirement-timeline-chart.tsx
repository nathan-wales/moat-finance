import {
	RETIREMENT_TIMELINE_LENSES,
	type RetirementMilestone,
	type RetirementProjectionYear,
	type RetirementTimelineLens,
} from "@moat/contracts";
import { Card, CardContent, CardHeader, CardTitle, Skeleton } from "@moat/ui";
import {
	Area,
	AreaChart,
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	Line,
	LineChart,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { type ChartInteractionState, useChartActiveIndex } from "./chart-click";
import { chartLineTooltipCursor } from "./chart-theme";
import { formatCurrency } from "./utils";

export const RETIREMENT_LENS_LABELS: Record<RetirementTimelineLens, string> = {
	netWorth: "Net worth",
	investments: "Investments",
	incomeVsExpenses: "Cash flow",
	paycheck: "Income",
	taxes: "Taxes",
	withdrawals: "Withdrawals",
};

export type RetirementTimelinePoint = RetirementProjectionYear & {
	ageLabel: string;
};

function toPoints(
	years: RetirementProjectionYear[],
): RetirementTimelinePoint[] {
	return years.map((year) => ({
		...year,
		ageLabel: String(year.age),
	}));
}

function formatRate(value: number): string {
	return `${(value * 100).toFixed(1)}%`;
}

function TooltipBody({
	label,
	rows,
}: {
	label?: string;
	rows: Array<{ name: string; value: string; color?: string }>;
}) {
	if (rows.length === 0) return null;
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">Age {label}</p>
			{rows.map((row) => (
				<div className="flex items-center gap-2" key={row.name}>
					{row.color ? (
						<span
							className="h-2 w-2 rounded-full"
							style={{ background: row.color }}
						/>
					) : null}
					<span className="text-muted-foreground">{row.name}:</span>
					<span className="font-medium">{row.value}</span>
				</div>
			))}
		</div>
	);
}

function milestoneAtAge(
	milestones: RetirementMilestone[],
	age: number,
): RetirementMilestone | undefined {
	return milestones.find((milestone) => milestone.age === age);
}

export function RetirementTimelineChart({
	years,
	compareYears,
	compareLabel = "Baseline",
	milestones = [],
	lens,
	isLoading,
	isRecomputing,
	onSelectYear,
	headerActions,
}: {
	years: RetirementProjectionYear[];
	compareYears?: RetirementProjectionYear[];
	compareLabel?: string;
	milestones?: RetirementMilestone[];
	lens: RetirementTimelineLens;
	isLoading?: boolean;
	isRecomputing?: boolean;
	onSelectYear?: (year: RetirementProjectionYear) => void;
	headerActions?: React.ReactNode;
}) {
	const compareByAge = new Map(
		(compareYears ?? []).map((year) => [year.age, year.netWorth]),
	);
	const points = toPoints(years).map((point) => ({
		...point,
		compareNetWorth: compareByAge.get(point.age),
	}));
	const lastYear = years.at(-1);
	const lastSeriesValue =
		lastYear === undefined || (lens !== "netWorth" && lens !== "investments")
			? undefined
			: lens === "investments"
				? lastYear.liquidAssets
				: lastYear.netWorth;
	const lastTodayValue =
		lastYear === undefined || (lens !== "netWorth" && lens !== "investments")
			? undefined
			: lens === "investments"
				? lastYear.liquidAssetsTodayDollars
				: lastYear.netWorthTodayDollars;
	const endLabel =
		lastYear !== undefined && lastSeriesValue !== undefined
			? `Age ${lastYear.age}: ${formatCurrency(lastSeriesValue)}${
					lastTodayValue !== undefined &&
					Math.abs(lastSeriesValue - lastTodayValue) >= 1
						? ` · ≈ ${formatCurrency(lastTodayValue)} in today's dollars`
						: ""
				}`
			: null;
	const { onMouseMove, onMouseLeave, resolveIndex } = useChartActiveIndex();

	const handleClick = (state: unknown) => {
		const index = resolveIndex(state as ChartInteractionState);
		if (index === undefined) return;
		const year = years[index];
		if (year) onSelectYear?.(year);
	};

	if (isLoading) {
		return (
			<Card>
				<CardHeader>
					<CardTitle>Timeline</CardTitle>
				</CardHeader>
				<CardContent>
					<Skeleton className="h-72 w-full" />
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={isRecomputing ? "opacity-60" : undefined}>
			<CardHeader className="flex flex-row items-center justify-between space-y-0">
				<CardTitle>{RETIREMENT_LENS_LABELS[lens]}</CardTitle>
				{headerActions}
			</CardHeader>
			<CardContent className="space-y-3">
				<div className="h-80 w-full">
					<ResponsiveContainer height="100%" width="100%">
						{renderLens({
							lens,
							points,
							milestones,
							compareLabel: compareYears?.length ? compareLabel : undefined,
							onClick: handleClick,
							onMouseMove,
							onMouseLeave,
						})}
					</ResponsiveContainer>
				</div>
				{endLabel ? (
					<p className="text-muted-foreground text-xs">{endLabel}</p>
				) : null}
				<p className="text-muted-foreground text-xs">
					Chart plots future (nominal) dollars so the growth path stays visible.
					Today&apos;s-dollar values appear as extra labels.
				</p>
				{milestones.length > 0 ? (
					<div className="flex flex-wrap gap-x-4 gap-y-1 text-muted-foreground text-xs">
						{milestones.map((milestone) => (
							<span key={`${milestone.kind}-${milestone.age}`}>
								Age {milestone.age} · {milestone.label}
							</span>
						))}
					</div>
				) : null}
			</CardContent>
		</Card>
	);
}

function renderLens({
	lens,
	points,
	milestones,
	compareLabel,
	onClick,
	onMouseMove,
	onMouseLeave,
}: {
	lens: RetirementTimelineLens;
	points: Array<RetirementTimelinePoint & { compareNetWorth?: number }>;
	milestones: RetirementMilestone[];
	compareLabel?: string;
	onClick: (state: unknown) => void;
	onMouseMove: (state: unknown) => void;
	onMouseLeave: () => void;
}) {
	const retirementAge = milestones.find(
		(milestone) => milestone.kind === "retirement",
	)?.age;

	const refs = (yAxisId: string | number = 0) =>
		milestones
			.slice(0, 6)
			.map((milestone) => (
				<ReferenceLine
					key={`${milestone.kind}-${milestone.age}`}
					stroke="var(--border)"
					strokeDasharray="3 3"
					x={String(milestone.age)}
					yAxisId={yAxisId}
				/>
			));

	if (lens === "incomeVsExpenses") {
		return (
			<LineChart
				data={points}
				onClick={onClick}
				onMouseLeave={onMouseLeave}
				onMouseMove={onMouseMove}
			>
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
							<TooltipBody
								label={String(label)}
								rows={payload.map((entry) => ({
									name: String(entry.name),
									value: formatCurrency(Number(entry.value ?? 0)),
									color: String(entry.color),
								}))}
							/>
						);
					}}
					cursor={chartLineTooltipCursor}
				/>
				<Legend />
				{refs()}
				<Line
					dataKey="grossIncome"
					dot={false}
					name="Income"
					stroke="var(--chart-1)"
					strokeWidth={2}
					type="monotone"
				/>
				<Line
					dataKey="totalOutflow"
					dot={false}
					name="Expenses"
					stroke="var(--chart-2)"
					strokeWidth={2}
					type="monotone"
				/>
			</LineChart>
		);
	}

	if (lens === "paycheck") {
		const retired = points.filter((point) =>
			retirementAge !== undefined
				? point.age >= retirementAge
				: point.isRetired,
		);
		return (
			<AreaChart
				data={retired}
				onClick={onClick}
				onMouseLeave={onMouseLeave}
				onMouseMove={onMouseMove}
			>
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
							<TooltipBody
								label={String(label)}
								rows={payload.map((entry) => ({
									name: String(entry.name),
									value: formatCurrency(Number(entry.value ?? 0)),
									color: String(entry.color),
								}))}
							/>
						);
					}}
				/>
				<Legend />
				{refs()}
				<Area
					dataKey="socialSecurityIncome"
					fill="var(--chart-1)"
					name="Social Security"
					stackId="paycheck"
					stroke="var(--chart-1)"
					type="monotone"
				/>
				<Area
					dataKey="spouseSocialSecurityIncome"
					fill="var(--chart-2)"
					name="Spouse SS"
					stackId="paycheck"
					stroke="var(--chart-2)"
					type="monotone"
				/>
				<Area
					dataKey="rentalIncome"
					fill="var(--chart-3)"
					name="Rental"
					stackId="paycheck"
					stroke="var(--chart-3)"
					type="monotone"
				/>
				<Area
					dataKey="otherIncome"
					fill="var(--chart-4)"
					name="Other"
					stackId="paycheck"
					stroke="var(--chart-4)"
					type="monotone"
				/>
			</AreaChart>
		);
	}

	if (lens === "taxes") {
		return (
			<LineChart
				data={points}
				onClick={onClick}
				onMouseLeave={onMouseLeave}
				onMouseMove={onMouseMove}
			>
				<CartesianGrid strokeDasharray="3 3" vertical={false} />
				<XAxis dataKey="ageLabel" tick={{ fontSize: 11 }} />
				<YAxis
					tick={{ fontSize: 11 }}
					tickFormatter={formatCurrency}
					width={80}
					yAxisId="tax"
				/>
				<YAxis
					orientation="right"
					tick={{ fontSize: 11 }}
					tickFormatter={formatRate}
					yAxisId="rate"
				/>
				<Tooltip
					content={({ active, payload, label }) => {
						if (!active || !payload?.length) return null;
						return (
							<TooltipBody
								label={String(label)}
								rows={payload.map((entry) => ({
									name: String(entry.name),
									value:
										entry.dataKey === "marginalRate"
											? formatRate(Number(entry.value ?? 0))
											: formatCurrency(Number(entry.value ?? 0)),
									color: String(entry.color),
								}))}
							/>
						);
					}}
					cursor={chartLineTooltipCursor}
				/>
				<Legend />
				{refs("tax")}
				<Line
					dataKey="taxesPaid"
					dot={false}
					name="Taxes paid"
					stroke="var(--chart-1)"
					strokeWidth={2}
					type="monotone"
					yAxisId="tax"
				/>
				<Line
					dataKey="marginalRate"
					dot={false}
					name="Marginal rate"
					stroke="var(--chart-5)"
					strokeDasharray="4 4"
					type="monotone"
					yAxisId="rate"
				/>
			</LineChart>
		);
	}

	if (lens === "withdrawals") {
		return (
			<BarChart
				data={points}
				onClick={onClick}
				onMouseLeave={onMouseLeave}
				onMouseMove={onMouseMove}
			>
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
							<TooltipBody
								label={String(label)}
								rows={payload.map((entry) => ({
									name: String(entry.name),
									value: formatCurrency(Number(entry.value ?? 0)),
									color: String(entry.color),
								}))}
							/>
						);
					}}
				/>
				<Legend />
				{refs()}
				<Bar
					dataKey="withdrawalsTaxable"
					fill="var(--chart-1)"
					name="Taxable"
					stackId="w"
				/>
				<Bar
					dataKey="withdrawalsTaxDeferred"
					fill="var(--chart-2)"
					name="Tax-deferred"
					stackId="w"
				/>
				<Bar
					dataKey="withdrawalsTaxFree"
					fill="var(--chart-3)"
					name="Tax-free"
					stackId="w"
				/>
			</BarChart>
		);
	}

	const seriesKey = lens === "investments" ? "liquidAssets" : "netWorth";
	const seriesName = lens === "investments" ? "Investments" : "Net worth";

	return (
		<AreaChart
			data={points}
			onClick={onClick}
			onMouseLeave={onMouseLeave}
			onMouseMove={onMouseMove}
		>
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
					const age = Number(label);
					const milestone = Number.isFinite(age)
						? milestoneAtAge(milestones, age)
						: undefined;
					return (
						<TooltipBody
							label={String(label)}
							rows={[
								...payload.map((entry) => {
									const point = entry.payload as
										| RetirementTimelinePoint
										| undefined;
									const today =
										entry.dataKey === "liquidAssets"
											? point?.liquidAssetsTodayDollars
											: entry.dataKey === "netWorth"
												? point?.netWorthTodayDollars
												: undefined;
									const nominal = Number(entry.value ?? 0);
									return {
										name: String(entry.name),
										value:
											today !== undefined && Math.abs(nominal - today) >= 1
												? `${formatCurrency(nominal)} · ≈ ${formatCurrency(today)} today`
												: formatCurrency(nominal),
										color: String(entry.color),
									};
								}),
								...(milestone
									? [{ name: "Milestone", value: milestone.label }]
									: []),
							]}
						/>
					);
				}}
				cursor={chartLineTooltipCursor}
			/>
			{compareLabel ? <Legend /> : null}
			{refs()}
			<Area
				dataKey={seriesKey}
				fill="var(--chart-1)"
				fillOpacity={0.2}
				name={seriesName}
				stroke="var(--chart-1)"
				strokeWidth={2}
				type="monotone"
			/>
			{compareLabel ? (
				<Line
					connectNulls
					dataKey="compareNetWorth"
					dot={false}
					name={compareLabel}
					stroke="var(--chart-2)"
					strokeDasharray="4 4"
					strokeWidth={2}
					type="monotone"
				/>
			) : null}
		</AreaChart>
	);
}

export { RETIREMENT_TIMELINE_LENSES };
