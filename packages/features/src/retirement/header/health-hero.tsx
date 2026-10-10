import type {
	RetirementHeadline,
	RetirementProjectionSummary,
} from "@moat/contracts";
import {
	Card,
	CardContent,
	CardHeader,
	cn,
	Progress,
	Skeleton,
} from "@moat/ui";
import {
	formatAge,
	formatMonthlyLong,
	formatPercent,
	formatSignedMoney,
	formatSignedPoints,
} from "../format";
import {
	chanceOfSuccessBarClass,
	DEFAULT_HERO_TRIALS,
	heroFundingCopy,
} from "./health-hero-copy";
import { HowThisWorksDialog } from "./how-this-works-dialog";

export function RetirementHealthHero({
	headline,
	summary,
	baseline,
	isLoading,
	isRecomputing = false,
	builderOpen = false,
	trials = DEFAULT_HERO_TRIALS,
}: {
	headline?: RetirementHeadline;
	summary?: RetirementProjectionSummary;
	baseline?: RetirementProjectionSummary;
	isLoading?: boolean;
	isRecomputing?: boolean;
	builderOpen?: boolean;
	trials?: number;
}) {
	const embeddedCardClassName = builderOpen
		? "border-0 bg-transparent shadow-none"
		: undefined;

	if (isLoading || !summary) {
		return (
			<Card className={cn("gap-0", embeddedCardClassName)}>
				<CardContent className="p-6">
					<Skeleton className="mb-6 h-3 w-40" />
					<div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-16">
						<div className="space-y-6">
							<Skeleton className="h-12 w-24" />
							<Skeleton className="h-2.5 w-72" />
							<Skeleton className="h-10 w-3/4" />
						</div>
						<div className="grid gap-4 sm:grid-cols-3 md:min-w-[11rem] md:grid-cols-1">
							<Skeleton className="h-16" />
							<Skeleton className="h-16" />
							<Skeleton className="h-16" />
						</div>
					</div>
				</CardContent>
			</Card>
		);
	}

	const safeSpendingLabel =
		summary.safeMonthlySpending === null
			? "Calculating"
			: formatMonthlyLong(summary.safeMonthlySpending);
	const confidenceDeltaLabel = pointsDelta(
		summary.confidence,
		baseline?.confidence,
	);
	const stats = [
		{
			label: "Retire at",
			value: formatAge(summary.retirementAgeUsed),
			delta: yearDelta(summary.retirementAgeUsed, baseline?.retirementAgeUsed),
		},
		{
			label: "Plan spending",
			value: formatMonthlyLong(summary.expectedMonthlySpending),
			delta: moneyDelta(
				summary.expectedMonthlySpending,
				baseline?.expectedMonthlySpending,
			),
		},
		{
			label: "Safe spending",
			value: safeSpendingLabel,
			delta: moneyDelta(
				summary.safeMonthlySpending,
				baseline?.safeMonthlySpending,
			),
		},
	];

	return (
		<Card
			aria-busy={isRecomputing}
			className={cn("relative gap-0 overflow-hidden", embeddedCardClassName)}
		>
			{isRecomputing ? (
				<div
					aria-hidden
					className="pointer-events-none absolute inset-0 z-10 animate-pulse bg-muted/60"
				/>
			) : null}
			<CardHeader className="pb-0">
				<p className="font-medium text-muted-foreground text-xs uppercase tracking-wide">
					Your retirement plan
				</p>
			</CardHeader>
			<CardContent className="pt-6">
				<div className="grid gap-8 md:grid-cols-[minmax(0,1fr)_auto] md:items-center md:gap-16">
					<div className="space-y-8">
						<div className="space-y-2">
							<div className="flex items-baseline gap-3">
								<ChanceOfSuccessValue confidence={summary.confidence} />
								{confidenceDeltaLabel ? (
									<p className="text-muted-foreground text-sm">
										{confidenceDeltaLabel}
									</p>
								) : null}
							</div>
							<p className="text-muted-foreground text-sm">Chance of success</p>
							<ChanceOfSuccessBar confidence={summary.confidence} />
						</div>
						<div className="space-y-3">
							<div className="space-y-1">
								{headline ? (
									<p className="font-medium text-lg tracking-tight">
										{headline.headline}
									</p>
								) : null}
								<p className="text-muted-foreground">
									{heroFundingCopy({
										firstShortfallAge: summary.firstShortfallAge,
										fundedThroughLongevity: summary.fundedThroughLongevity,
										longevityAge: summary.longevityAge,
									})}
								</p>
							</div>
							<HowThisWorksDialog
								confidence={summary.confidence}
								confidenceTarget={summary.confidenceTarget}
								longevityAge={summary.longevityAge}
								planMonthly={summary.expectedMonthlySpending}
								safeMonthly={summary.safeMonthlySpending}
								trials={trials}
							/>
						</div>
					</div>
					<div className="grid gap-6 sm:grid-cols-3 md:min-w-[11rem] md:grid-cols-1">
						{stats.map((stat) => (
							<HeroStat
								delta={stat.delta}
								key={stat.label}
								label={stat.label}
								value={stat.value}
							/>
						))}
					</div>
				</div>
			</CardContent>
		</Card>
	);
}

function ChanceOfSuccessValue({ confidence }: { confidence: number | null }) {
	if (confidence === null) {
		return (
			<Skeleton
				aria-label="Calculating chance of success"
				className="h-12 w-28"
			/>
		);
	}

	return (
		<p className="font-semibold text-5xl tabular-nums tracking-tight">
			{formatPercent(confidence)}
		</p>
	);
}

function ChanceOfSuccessBar({ confidence }: { confidence: number | null }) {
	if (confidence === null) {
		return (
			<Skeleton aria-hidden className="h-2.5 w-full max-w-72 rounded-full" />
		);
	}

	const successBar = chanceOfSuccessBarClass(confidence);
	return (
		<Progress
			aria-label="Chance of success"
			className={cn("h-2.5 max-w-72", successBar.className)}
			indicatorClassName={successBar.indicatorClassName}
			value={confidence * 100}
		/>
	);
}

function HeroStat({
	label,
	value,
	delta,
}: {
	label: string;
	value: string;
	delta: string | null;
}) {
	return (
		<div className="space-y-1">
			<p className="text-muted-foreground text-xs uppercase tracking-wide">
				{label}
			</p>
			<p className="font-semibold text-xl tabular-nums tracking-tight">
				{value}
			</p>
			{delta ? <p className="text-muted-foreground text-xs">{delta}</p> : null}
		</div>
	);
}

function yearDelta(current: number, previous?: number): string | null {
	if (previous === undefined || previous === current) return null;
	const diff = current - previous;
	return `${diff > 0 ? "+" : ""}${diff} yr`;
}

function moneyDelta(
	current: number | null,
	previous?: number | null,
): string | null {
	if (current === null || previous === null || previous === undefined) {
		return null;
	}
	if (current === previous) return null;
	return formatSignedMoney(current - previous);
}

function pointsDelta(
	current: number | null,
	previous?: number | null,
): string | null {
	if (current === null || previous === null || previous === undefined) {
		return null;
	}
	const label = formatSignedPoints(current - previous);
	if (label === "0 pts") return null;
	return label;
}
