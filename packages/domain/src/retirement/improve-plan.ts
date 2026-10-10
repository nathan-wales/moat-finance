// Improve My Plan: What If answers questions the user asks, this asks hundreds
// for them.
//
// The catalog below is swept deterministically — cheap — and only the strongest
// handful are re-measured with Monte Carlo. Every number an opportunity claims
// comes from actually applying its lever, never from a heuristic, because the
// user will immediately click `Try it` and compare.

import type {
	RetirementLever,
	RetirementOpportunity,
	RetirementScenarioLever,
	RetirementTaxTreatment,
} from "@moat/contracts";
import {
	getEmployeeDeferralLimit,
	getIraContributionLimit,
} from "../federal-rules";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import {
	ASSUMED_EMPLOYER_MATCH_PERCENT,
	ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY,
	REDUCED_MONTE_CARLO_TRIALS,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
} from "./constants";
import { solveEarliestRetirementAge } from "./earliest-retirement";
import {
	formatConfidence,
	formatMoney,
	formatSignedMoneyCompact,
} from "./format";
import { runMonteCarloAsync } from "./monte-carlo";
import type { RetirementProjectionResult } from "./project";
import { projectRetirement } from "./project";
import { suggestLevers } from "./suggest-levers";

/** How many candidates survive the deterministic sweep into Monte Carlo. */
const FINALIST_COUNT = 8;
export const MAX_OPPORTUNITIES = 5;

type SecondaryMetric =
	| "legacy"
	| "assetsAtRetirement"
	| "lifetimeSocialSecurity"
	| "lifetimeTaxes";

type Candidate = {
	id: string;
	title: string;
	lever: RetirementLever;
	secondary: SecondaryMetric;
};

function buildCandidates(baseline: RetirementBaseline): Candidate[] {
	const { inputs, plan, detected } = baseline;
	const candidates: Candidate[] = [];

	const limit401k = getEmployeeDeferralLimit({
		taxYear: inputs.taxYear,
		age: inputs.currentAge,
		autoApplyCatchUp: true,
	}).amount;
	if (detected.annual401kContribution < limit401k) {
		candidates.push({
			id: "max_401k",
			title: "Max your 401(k)",
			lever: { type: "max_401k", params: { includeCatchUp: true } },
			secondary: "legacy",
		});
	}

	const iraLimit = getIraContributionLimit({
		taxYear: inputs.taxYear,
		age: inputs.currentAge,
		autoApplyCatchUp: true,
	}).amount;
	if (detected.annualRothContribution < iraLimit) {
		candidates.push({
			id: "max_roth_ira",
			title: "Max your Roth IRA",
			lever: { type: "max_roth_ira", params: { includeCatchUp: true } },
			secondary: "legacy",
		});
	}
	if (plan.hasSpouse) {
		candidates.push({
			id: "max_spousal_iras",
			title: "Max both spouses' IRAs",
			lever: { type: "max_spousal_iras", params: { includeCatchUp: true } },
			secondary: "legacy",
		});
	}
	if (detected.hasHsa) {
		candidates.push({
			id: "max_hsa",
			title: "Max your HSA",
			lever: {
				type: "max_hsa",
				params: { coverageType: plan.hasSpouse ? "family" : "self" },
			},
			secondary: "legacy",
		});
	}
	if (detected.employerMatchUnmodeled) {
		candidates.push({
			id: "employer_match",
			title: "Capture your full employer match",
			lever: {
				type: "employer_match",
				params: {
					matchPercent: ASSUMED_EMPLOYER_MATCH_PERCENT,
					upToPercentOfSalary: ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY,
				},
			},
			secondary: "legacy",
		});
	}

	// Parameter sweep on plain extra saving.
	for (const monthlyDelta of [250, 500, 1000]) {
		candidates.push({
			id: `contribution_change_${monthlyDelta}`,
			title: `Increase savings by ${formatMoney(monthlyDelta)}/month`,
			lever: {
				type: "contribution_change",
				params: { monthlyDelta, taxTreatment: "taxDeferred" },
			},
			secondary: "legacy",
		});
	}

	for (const years of [1, 2, 3]) {
		candidates.push({
			id: `retire_later_${years}`,
			title:
				years === 1 ? "Retire one year later" : `Retire ${years} years later`,
			lever: { type: "retire_later", params: { years } },
			secondary: "assetsAtRetirement",
		});
	}

	if (plan.socialSecurityClaimAge < SOCIAL_SECURITY_LATEST_CLAIM_AGE) {
		candidates.push({
			id: "social_security_claim_age",
			title: `Delay Social Security to ${SOCIAL_SECURITY_LATEST_CLAIM_AGE}`,
			lever: {
				type: "social_security_claim_age",
				params: { age: SOCIAL_SECURITY_LATEST_CLAIM_AGE },
			},
			secondary: "lifetimeSocialSecurity",
		});
	}

	for (const monthlyDelta of [-250, -500]) {
		candidates.push({
			id: `retirement_spending_change_${Math.abs(monthlyDelta)}`,
			title: `Spend ${formatMoney(Math.abs(monthlyDelta))}/month less in retirement`,
			lever: { type: "retirement_spending_change", params: { monthlyDelta } },
			secondary: "legacy",
		});
	}

	const mortgaged = baseline.properties.find(
		(property) => property.currentLoanBalance > 0,
	);
	if (mortgaged && baseline.mortgagePayoffAge !== null) {
		candidates.push({
			id: "mortgage_payoff_early",
			title: "Pay off your mortgage early",
			lever: {
				type: "mortgage_payoff_early",
				params: {
					propertyId: mortgaged.id,
					atAge: Math.max(
						inputs.currentAge + 1,
						baseline.mortgagePayoffAge - 5,
					),
				},
			},
			secondary: "legacy",
		});
	}

	if (baseline.primaryResidenceEquity > 200_000) {
		const primary = baseline.properties.find(
			(property) => property.isPrimaryResidence,
		);
		candidates.push({
			id: "downsize_home",
			title: "Downsize at age 70",
			lever: {
				type: "downsize_home",
				params: {
					atAge: 70,
					newHomePrice: Math.round((primary?.currentEstimatedValue ?? 0) * 0.6),
				},
			},
			secondary: "legacy",
		});
	}

	if (inputs.balances.taxDeferred > 0) {
		candidates.push({
			id: "roth_conversion",
			title: "Convert to Roth before RMDs begin",
			lever: {
				type: "roth_conversion",
				params: {
					fromAge: plan.targetRetirementAge,
					toAge: Math.max(plan.targetRetirementAge, inputs.rmdStartAge - 1),
					fillToBracket: 0.12,
				},
			},
			secondary: "lifetimeTaxes",
		});
	}

	const preferredOrder: RetirementTaxTreatment[] = [
		"taxable",
		"taxDeferred",
		"taxFree",
	];
	if (inputs.withdrawalOrder.join() !== preferredOrder.join()) {
		candidates.push({
			id: "withdrawal_order",
			title: "Change your withdrawal order",
			lever: { type: "withdrawal_order", params: { order: preferredOrder } },
			secondary: "lifetimeTaxes",
		});
	}

	if (
		plan.hasSpouse &&
		inputs.spouseEmploymentEndsAtAge !== null &&
		plan.spouseCurrentAge !== null &&
		plan.spouseCurrentAge < inputs.spouseEmploymentEndsAtAge
	) {
		candidates.push({
			id: "spouse_retire_at_age",
			title: "Spouse works three years longer",
			lever: {
				type: "spouse_retire_at_age",
				params: { age: inputs.spouseEmploymentEndsAtAge + 3 },
			},
			secondary: "assetsAtRetirement",
		});
	}

	return candidates;
}

function secondaryLabel(metric: SecondaryMetric, longevityAge: number): string {
	switch (metric) {
		case "legacy":
			return `Legacy at ${longevityAge}`;
		case "assetsAtRetirement":
			return "Assets at retirement";
		case "lifetimeSocialSecurity":
			return "Estimated lifetime benefit";
		case "lifetimeTaxes":
			return "Lifetime taxes";
	}
}

function secondaryValue(
	result: RetirementProjectionResult,
	metric: SecondaryMetric,
): number {
	switch (metric) {
		case "legacy":
			return result.legacyAtLongevity;
		case "assetsAtRetirement":
			return result.assetsAtRetirement;
		case "lifetimeSocialSecurity":
			return result.lifetimeSocialSecurity;
		case "lifetimeTaxes":
			return result.lifetimeTaxes;
	}
}

const OVERFUNDED_CONFIDENCE = 0.98;
const EXCLUDED_RANKED_IDS = new Set([
	"spend_more",
	"returns_lower",
	"spouse_stops_working",
]);
const EXCLUDED_RANKED_TYPES = new Set([
	"spouse_stops_working",
	"return_rate_delta",
]);
const SUGGEST_EXTRA_SECONDARY: Partial<Record<string, SecondaryMetric>> = {
	retire_earlier: "legacy",
	taxable_investing: "legacy",
};

function enabledLeverTypes(levers: RetirementScenarioLever[]): Set<string> {
	return new Set(
		levers.filter((entry) => entry.enabled).map((entry) => entry.lever.type),
	);
}

function isRankedCandidate(candidate: Candidate): boolean {
	if (EXCLUDED_RANKED_IDS.has(candidate.id)) return false;
	if (EXCLUDED_RANKED_TYPES.has(candidate.lever.type)) return false;
	return true;
}

/**
 * Union of the Improve catalog and improvement-shaped suggestLevers rows
 * that catalog is missing (`retire_earlier`, `taxable_investing`, …).
 * Framing cards stay out of the ranked pool.
 */
export function buildRankedCandidates(
	baseline: RetirementBaseline,
	earliestSustainableAge: number | null = null,
): Candidate[] {
	const catalog = buildCandidates(baseline);
	const seen = new Set(catalog.map((candidate) => candidate.id));
	const extras: Candidate[] = [];
	for (const suggestion of suggestLevers({
		baseline,
		earliestSustainableAge,
	})) {
		if (seen.has(suggestion.id)) continue;
		const candidate: Candidate = {
			id: suggestion.id,
			title: suggestion.title,
			lever: suggestion.lever,
			secondary: SUGGEST_EXTRA_SECONDARY[suggestion.id] ?? "legacy",
		};
		if (!isRankedCandidate(candidate)) continue;
		seen.add(candidate.id);
		extras.push(candidate);
	}
	return [...catalog, ...extras].filter(isRankedCandidate);
}

export type LeverCandidate = Candidate;

export type RankedLever = {
	id: string;
	rank: number;
	title: string;
	lever: RetirementLever;
	confidenceBefore: number;
	confidenceAfter: number;
	deterministicScore: number;
	estimatedImpactScore: number;
	primaryMetricLabel: string;
	primaryMetricBefore: string;
	primaryMetricAfter: string;
	secondaryMetricLabel: string | null;
	secondaryMetricDelta: string | null;
};

export type RankLeverCandidatesInput = {
	baseline: RetirementBaseline;
	/** The user's active stack; candidates apply on top of it. */
	levers: RetirementScenarioLever[];
	/** From the unified builder when omitted. */
	candidates?: LeverCandidate[];
	trials?: number;
	seed?: number;
	limit?: number;
} & RetirementComputeOptions;

function measuredImpactScore(
	confidenceBefore: number,
	confidenceAfter: number,
	deterministicScore: number,
): number {
	if (confidenceBefore >= OVERFUNDED_CONFIDENCE) {
		return Math.max(0, Math.round(deterministicScore / 1000));
	}
	return Math.round((confidenceAfter - confidenceBefore) * 1000);
}

function keepBestPerType<T>(entries: T[], keyOf: (entry: T) => string): T[] {
	const seen = new Set<string>();
	return entries.filter((entry) => {
		const key = keyOf(entry);
		if (seen.has(key)) return false;
		seen.add(key);
		return true;
	});
}

export async function rankLeverCandidates(
	input: RankLeverCandidatesInput,
): Promise<RankedLever[]> {
	const trials = input.trials ?? REDUCED_MONTE_CARLO_TRIALS;
	const seed = input.seed ?? 13;
	const limit = input.limit ?? MAX_OPPORTUNITIES;
	const compute = {
		yieldEvery: input.yieldEvery,
		signal: input.signal,
		yieldFn: input.yieldFn,
	};
	const nextSortOrder =
		input.levers.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;
	const stackedTypes = enabledLeverTypes(input.levers);

	const base = applyLevers(input.baseline, input.levers);
	const baseResult = projectRetirement(base.inputs);
	const baseConfidence = (
		await runMonteCarloAsync(base.inputs, {
			trials,
			seed,
			includeCone: false,
			...compute,
		})
	).confidence;

	const pool = (
		input.candidates ??
		buildRankedCandidates(
			input.baseline,
			solveEarliestRetirementAge(base.inputs),
		)
	).filter(
		(candidate) =>
			isRankedCandidate(candidate) && !stackedTypes.has(candidate.lever.type),
	);

	const withCandidate = (candidate: Candidate) =>
		applyLevers(input.baseline, [
			...input.levers,
			{
				id: `opportunity-${candidate.id}`,
				enabled: true,
				sortOrder: nextSortOrder,
				lever: candidate.lever,
			},
		]);

	// Cheap deterministic sweep first: legacy and shortfall are enough to throw
	// away the candidates that cannot possibly rank.
	const swept = pool
		.map((candidate) => {
			const applied = withCandidate(candidate);
			const meta = applied.appliedLevers.at(-1);
			if (meta?.applied !== true) return null;
			const result = projectRetirement(applied.inputs);
			return {
				candidate,
				inputs: applied.inputs,
				result,
				deterministicScore:
					result.legacyAtLongevity -
					baseResult.legacyAtLongevity -
					(result.totalShortfall - baseResult.totalShortfall) * 5,
			};
		})
		.filter(
			(entry): entry is NonNullable<typeof entry> =>
				entry !== null && entry.deterministicScore > 0,
		)
		.sort((a, b) => b.deterministicScore - a.deterministicScore)
		.slice(0, FINALIST_COUNT);

	const measured: Array<(typeof swept)[number] & { confidence: number }> = [];
	for (const entry of swept) {
		measured.push({
			...entry,
			confidence: (
				await runMonteCarloAsync(entry.inputs, {
					trials,
					seed,
					includeCone: false,
					...compute,
				})
			).confidence,
		});
	}
	measured.sort((a, b) => {
		if (baseConfidence >= OVERFUNDED_CONFIDENCE) {
			return b.deterministicScore - a.deterministicScore;
		}
		const byConfidence = b.confidence - a.confidence;
		if (Math.abs(byConfidence) > 0.001) return byConfidence;
		return b.deterministicScore - a.deterministicScore;
	});

	const collapsed = keepBestPerType(measured, (entry) =>
		entry.candidate.lever.type === "retire_later"
			? "retire_later"
			: entry.candidate.id,
	).slice(0, limit);

	const overfunded = baseConfidence >= OVERFUNDED_CONFIDENCE;
	return collapsed.map((entry, index) => {
		const before = secondaryValue(baseResult, entry.candidate.secondary);
		const after = secondaryValue(entry.result, entry.candidate.secondary);
		return {
			id: entry.candidate.id,
			rank: index + 1,
			title: entry.candidate.title,
			lever: entry.candidate.lever,
			confidenceBefore: baseConfidence,
			confidenceAfter: entry.confidence,
			deterministicScore: entry.deterministicScore,
			estimatedImpactScore: measuredImpactScore(
				baseConfidence,
				entry.confidence,
				entry.deterministicScore,
			),
			primaryMetricLabel: overfunded
				? secondaryLabel(entry.candidate.secondary, entry.inputs.longevityAge)
				: "Retirement confidence",
			primaryMetricBefore: overfunded
				? formatMoney(before)
				: formatConfidence(baseConfidence),
			primaryMetricAfter: overfunded
				? formatMoney(after)
				: formatConfidence(entry.confidence),
			secondaryMetricLabel: secondaryLabel(
				entry.candidate.secondary,
				entry.inputs.longevityAge,
			),
			secondaryMetricDelta: formatSignedMoneyCompact(after - before),
		};
	});
}

export type FindOpportunitiesInput = {
	baseline: RetirementBaseline;
	/** The user's active stack; opportunities stack on top of it. */
	levers: RetirementScenarioLever[];
	trials?: number;
	seed?: number;
	limit?: number;
} & RetirementComputeOptions;

export async function findOpportunities(
	input: FindOpportunitiesInput,
): Promise<RetirementOpportunity[]> {
	return (await rankLeverCandidates(input)).map((entry) => ({
		id: entry.id,
		rank: entry.rank,
		title: entry.title,
		primaryMetricLabel: entry.primaryMetricLabel,
		primaryMetricBefore: entry.primaryMetricBefore,
		primaryMetricAfter: entry.primaryMetricAfter,
		secondaryMetricLabel: entry.secondaryMetricLabel,
		secondaryMetricDelta: entry.secondaryMetricDelta,
		confidenceBefore: entry.confidenceBefore,
		confidenceAfter: entry.confidenceAfter,
		lever: entry.lever,
	}));
}

/** Exported for Goal Seek, which reuses the same candidate space. */
export function opportunityCandidates(
	baseline: RetirementBaseline,
): Array<{ id: string; title: string; lever: RetirementLever }> {
	return buildCandidates(baseline).map((candidate) => ({
		id: candidate.id,
		title: candidate.title,
		lever: candidate.lever,
	}));
}
