"use client";

import {
	DEFAULT_LIQUID_TYPE_MIX,
	type RetirementLiquidTypeMix,
	type RetirementMilestone,
	type RetirementProjectionYear,
} from "@moat/contracts";
import {
	Button,
	Card,
	CardAction,
	CardContent,
	CardHeader,
	CardTitle,
	Skeleton,
	WithTooltip,
} from "@moat/ui";
import { ArrowUpRight } from "lucide-react";
import { useMemo } from "react";
import {
	Bar,
	BarChart,
	CartesianGrid,
	Legend,
	ReferenceLine,
	ResponsiveContainer,
	Tooltip,
	XAxis,
	YAxis,
} from "recharts";
import { ChartInfoIcon } from "./chart-info-icon";
import { chartBarTooltipCursor } from "./chart-theme";
import {
	formatCompactCurrency,
	formatTodayDollarsLabel,
	shouldShowTodayDollars,
} from "./utils";

const REAL_ESTATE_COLOR = "#A8D5BA";
const DEBT_COLOR = "#E07A5F";

const ASSET_SERIES = [
	{ key: "stocks", label: "Stocks", color: "#3b82f6" },
	{ key: "four01k", label: "401(k)", color: "#10b981" },
	{ key: "rothIra", label: "Roth IRA", color: "#8b5cf6" },
	{ key: "hsa", label: "HSA", color: "#06b6d4" },
	{ key: "other", label: "Cash", color: "#64748b" },
	{ key: "realEstate", label: "Real Estate", color: REAL_ESTATE_COLOR },
] as const;

type AssetSeriesKey = (typeof ASSET_SERIES)[number]["key"];

export type ProjectedNetWorthPoint = {
	year: number;
	yearLabel: string;
	age: number;
	stocks: number;
	four01k: number;
	rothIra: number;
	hsa: number;
	other: number;
	savings: number;
	realEstate: number;
	debt: number;
	netWorth: number;
	netWorthTodayDollars: number;
	milestones?: string[];
};

export function toProjectedNetWorthPoints(
	years: RetirementProjectionYear[],
	mix: RetirementLiquidTypeMix = DEFAULT_LIQUID_TYPE_MIX,
	milestones: RetirementMilestone[] = [],
	opening?: RetirementProjectionYear,
): ProjectedNetWorthPoint[] {
	const labelsByYear = new Map<number, string[]>();
	for (const milestone of milestones) {
		const labels = labelsByYear.get(milestone.year);
		if (labels) {
			labels.push(milestone.label);
		} else {
			labelsByYear.set(milestone.year, [milestone.label]);
		}
	}
	const ledger = opening ? [opening, ...years] : years;
	return ledger.map((year, index) => {
		const isToday = opening !== undefined && index === 0;
		const mortgageBalance = Math.max(0, year.debtBalance - year.otherDebt);
		const realEstate = year.realEstateEquity + mortgageBalance;
		const debt = -year.debtBalance;
		const stocks = year.balanceTaxable * mix.stocksOfTaxable;
		const four01k = year.balanceTaxDeferred * mix.four01kOfDeferred;
		const rothIra = year.balanceTaxFree * mix.rothOfTaxFree;
		const hsa = year.balanceTaxFree * mix.hsaOfTaxFree;
		const allocated = stocks + four01k + rothIra + hsa;
		const other = Math.max(0, year.liquidAssets - allocated);
		return {
			year: year.year,
			yearLabel: isToday ? "Today" : String(year.year),
			age: year.age,
			stocks,
			four01k,
			rothIra,
			hsa,
			other,
			savings: year.liquidAssets,
			realEstate,
			debt,
			netWorth: year.netWorth,
			netWorthTodayDollars: year.netWorthTodayDollars,
			milestones: isToday ? [] : (labelsByYear.get(year.year) ?? []),
		};
	});
}

function yearTicks(points: ProjectedNetWorthPoint[]): string[] {
	const first = points[0];
	if (!first) return [];
	const ticks: string[] = [first.yearLabel];
	const rest = first.yearLabel === "Today" ? points.slice(1) : points;
	const start = rest[0]?.year ?? first.year;
	for (const point of rest) {
		if ((point.year - start) % 4 !== 0) continue;
		if (ticks.includes(point.yearLabel)) continue;
		ticks.push(point.yearLabel);
	}
	return ticks;
}

function seriesHasValue(
	points: ProjectedNetWorthPoint[],
	key: AssetSeriesKey | "debt",
): boolean {
	return points.some((point) => Math.abs(point[key]) >= 1);
}

function TooltipBody({
	label,
	rows,
	milestones,
}: {
	label?: string;
	rows: Array<{
		name: string;
		value: string;
		color?: string;
		detail?: string;
	}>;
	milestones?: string[];
}) {
	if (rows.length === 0) return null;
	const yearMilestones = milestones ?? [];
	return (
		<div className="rounded-lg border bg-popover px-3 py-2 text-xs shadow-md">
			<p className="mb-1.5 font-medium text-foreground">{label}</p>
			{rows.map((row) => (
				<div className="flex flex-col" key={row.name}>
					<div className="flex items-center gap-2">
						{row.color ? (
							<span
								className="h-2 w-2 rounded-full"
								style={{ background: row.color }}
							/>
						) : null}
						<span className="text-muted-foreground">{row.name}:</span>
						<span className="font-medium">{row.value}</span>
					</div>
					{row.detail ? (
						<p className="text-muted-foreground">{row.detail}</p>
					) : null}
				</div>
			))}
			{yearMilestones.length > 0 ? (
				<>
					<hr className="my-1.5 border-muted" />
					{yearMilestones.map((milestone) => (
						<div className="flex items-center gap-2" key={milestone}>
							<span className="text-muted-foreground">Milestone:</span>
							<span className="font-medium">{milestone}</span>
						</div>
					))}
				</>
			) : null}
		</div>
	);
}

function SummaryStat({
	label,
	value,
	sublabel,
}: {
	label: string;
	value: string;
	sublabel?: string;
}) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs">{label}</p>
			<p className="font-semibold text-2xl tracking-tight">{value}</p>
			{sublabel ? (
				<p className="text-muted-foreground text-xs">{sublabel}</p>
			) : null}
		</div>
	);
}

function todayDollarsSublabel(
	nominal: number | undefined,
	todayAmount: number | undefined,
): string | undefined {
	if (nominal === undefined) return undefined;
	if (!shouldShowTodayDollars(nominal, todayAmount)) return undefined;
	return formatTodayDollarsLabel(todayAmount);
}

const PROJECTED_NET_WORTH_HELP =
	"Current / Today is this mix right now: investments, cash, real estate equity, and other debts such as credit cards. Later bars grow that mix with assumed contributions, returns, appreciation, and debt paydown — those future years will not match the live cards above.";

function ChartHeader({
	isOverview,
	onOpenRetirement,
}: {
	isOverview?: boolean;
	onOpenRetirement?: () => void;
}) {
	return (
		<CardHeader>
			<CardTitle className="flex items-center gap-1.5">
				Projected net worth
				<ChartInfoIcon
					label="Projected net worth"
					text={PROJECTED_NET_WORTH_HELP}
				/>
			</CardTitle>
			{isOverview ? (
				<CardAction>
					<WithTooltip text="View retirement planner">
						<Button
							aria-label="View retirement planner"
							className="h-8 w-8 text-muted-foreground"
							onClick={onOpenRetirement}
							size="icon"
							variant="ghost"
						>
							<ArrowUpRight className="h-4 w-4" />
						</Button>
					</WithTooltip>
				</CardAction>
			) : null}
		</CardHeader>
	);
}

export function ProjectedNetWorthChart({
	years,
	opening,
	retirementAge,
	longevityAge,
	netWorthAtRetirement,
	netWorthAtRetirementTodayDollars,
	legacyAtLongevity,
	legacyAtLongevityTodayDollars,
	liquidTypeMix = DEFAULT_LIQUID_TYPE_MIX,
	milestones = [],
	isLoading,
	isRecomputing,
	isOverview,
	onOpenRetirement,
}: {
	years: RetirementProjectionYear[];
	opening?: RetirementProjectionYear;
	retirementAge?: number;
	longevityAge?: number;
	netWorthAtRetirement?: number;
	netWorthAtRetirementTodayDollars?: number;
	legacyAtLongevity?: number;
	legacyAtLongevityTodayDollars?: number;
	liquidTypeMix?: RetirementLiquidTypeMix;
	milestones?: RetirementMilestone[];
	isLoading?: boolean;
	isRecomputing?: boolean;
	isOverview?: boolean;
	onOpenRetirement?: () => void;
}) {
	const points = useMemo(
		() => toProjectedNetWorthPoints(years, liquidTypeMix, milestones, opening),
		[years, liquidTypeMix, milestones, opening],
	);
	const ticks = yearTicks(points);
	const retirementYearLabel =
		retirementAge === undefined
			? undefined
			: points.find(
					(point) => point.yearLabel !== "Today" && point.age === retirementAge,
				)?.yearLabel;
	const visibleAssetSeries = ASSET_SERIES.filter((series) =>
		seriesHasValue(points, series.key),
	);
	const showDebt = seriesHasValue(points, "debt");

	const currentPoint = points[0];
	const currentLabel =
		currentPoint !== undefined ? `Current (${currentPoint.age})` : "Current";
	const currentValue =
		currentPoint !== undefined
			? formatCompactCurrency(currentPoint.netWorth)
			: "—";
	const retirementLabel =
		retirementAge !== undefined
			? `At retirement (${retirementAge})`
			: "At retirement";
	const longevityLabel =
		longevityAge !== undefined
			? `At longevity (${longevityAge})`
			: "At longevity";
	const retirementValue =
		netWorthAtRetirement !== undefined
			? formatCompactCurrency(netWorthAtRetirement)
			: "—";
	const longevityValue =
		legacyAtLongevity !== undefined
			? formatCompactCurrency(legacyAtLongevity)
			: "—";
	const retirementTodayLabel = todayDollarsSublabel(
		netWorthAtRetirement,
		netWorthAtRetirementTodayDollars,
	);
	const longevityTodayLabel = todayDollarsSublabel(
		legacyAtLongevity,
		legacyAtLongevityTodayDollars,
	);

	if (isLoading) {
		return (
			<Card>
				<ChartHeader
					isOverview={isOverview}
					onOpenRetirement={onOpenRetirement}
				/>
				<CardContent>
					<div className="flex flex-col gap-6 lg:flex-row lg:gap-3">
						<div className="flex shrink-0 flex-row gap-8 pt-2 lg:flex-col lg:items-start lg:gap-6">
							<Skeleton className="h-20 w-28" />
							<Skeleton className="h-20 w-28" />
							<Skeleton className="h-20 w-28" />
						</div>
						<Skeleton className="h-80 w-full" />
					</div>
				</CardContent>
			</Card>
		);
	}

	return (
		<Card className={isRecomputing ? "opacity-60" : undefined}>
			<ChartHeader
				isOverview={isOverview}
				onOpenRetirement={onOpenRetirement}
			/>
			<CardContent className="space-y-4">
				<div className="flex flex-col gap-6 lg:flex-row lg:gap-3">
					<div className="flex shrink-0 flex-row gap-8 pt-2 lg:flex-col lg:items-start lg:gap-6">
						<SummaryStat label={currentLabel} value={currentValue} />
						<SummaryStat
							label={retirementLabel}
							sublabel={retirementTodayLabel}
							value={retirementValue}
						/>
						<SummaryStat
							label={longevityLabel}
							sublabel={longevityTodayLabel}
							value={longevityValue}
						/>
					</div>
					<div className="min-w-0 flex-1 space-y-2">
						<div className="h-80 w-full">
							<ResponsiveContainer height="100%" width="100%">
								<BarChart
									barCategoryGap="12%"
									data={points}
									margin={{ top: 18, right: 8, left: 0, bottom: 0 }}
								>
									<CartesianGrid
										stroke="var(--chart-grid)"
										strokeDasharray="3 3"
										vertical={false}
									/>
									<XAxis
										dataKey="yearLabel"
										padding={{ left: 0, right: 0 }}
										tick={{ fontSize: 11 }}
										ticks={ticks}
									/>
									<YAxis
										orientation="right"
										tick={{ fontSize: 11 }}
										tickFormatter={formatCompactCurrency}
										width={64}
									/>
									<ReferenceLine stroke="var(--border)" strokeWidth={1} y={0} />
									{retirementYearLabel ? (
										<ReferenceLine
											label={{
												fill: "var(--muted-foreground)",
												fontSize: 11,
												position: "insideTopRight",
												dx: 8,
												textAnchor: "start",
												value: "Retirement",
											}}
											stroke="var(--muted-foreground)"
											strokeDasharray="3 3"
											x={retirementYearLabel}
										/>
									) : null}
									<Tooltip
										content={({ active, payload, label }) => {
											if (!active || !payload?.length) return null;
											const point = payload[0]?.payload as
												| ProjectedNetWorthPoint
												| undefined;
											const seriesRows = payload
												.filter((entry) => entry.dataKey !== "netWorth")
												.map((entry) => ({
													name: String(entry.name),
													value: formatCompactCurrency(
														Math.abs(Number(entry.value ?? 0)),
													),
													color: String(entry.color),
												}));
											const netWorth = point?.netWorth ?? 0;
											const netWorthToday = point?.netWorthTodayDollars;
											return (
												<TooltipBody
													label={`${label} · Age ${point?.age ?? "—"}`}
													milestones={point?.milestones}
													rows={[
														...seriesRows,
														{
															name: "Net worth",
															value: formatCompactCurrency(netWorth),
															detail: todayDollarsSublabel(
																netWorth,
																netWorthToday,
															),
														},
													]}
												/>
											);
										}}
										cursor={chartBarTooltipCursor}
									/>
									<Legend
										align="center"
										iconSize={8}
										iconType="circle"
										wrapperStyle={{ fontSize: 12, paddingTop: 8 }}
									/>
									{visibleAssetSeries.map((series) => (
										<Bar
											dataKey={series.key}
											fill={series.color}
											key={series.key}
											name={series.label}
											stackId="nw"
											stroke="none"
										/>
									))}
									{showDebt ? (
										<Bar
											dataKey="debt"
											fill={DEBT_COLOR}
											name="Debt"
											stackId="nw"
											stroke="none"
										/>
									) : null}
								</BarChart>
							</ResponsiveContainer>
						</div>
					</div>
				</div>
				<p className="text-muted-foreground text-xs">
					Current is today&apos;s balances. Bars after Today are year-end.
					Figures are future (nominal) dollars. Today&apos;s-dollar labels
					deflate by inflation so purchasing power sits next to the growth path,
					not instead of it.
				</p>
			</CardContent>
		</Card>
	);
}
