// A fixed catalog of adverse scenarios the user does not choose.
//
// Every test is expressed as a lever stack on top of the user's active stack, so
// a stress test is the same code path as a What If — there is no second engine
// for "bad things". The biggest-vulnerability callout reads real insurance
// coverage rather than assuming a generic policy, which is the whole point of
// running this inside Moat.

import type {
	RetirementLever,
	RetirementScenarioLever,
	RetirementStressTestResult,
	RetirementStressTestsResponse,
	RetirementVulnerability,
} from "@moat/contracts";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import {
	DEFAULT_LTC_MONTHLY_COST,
	REDUCED_MONTE_CARLO_TRIALS,
} from "./constants";
import { runMonteCarloAsync } from "./monte-carlo";
import { projectRetirement } from "./project";
import type { RetirementPlanInputs } from "./types";

const INSURANCE_HREF = "/financial-profile#insurance";

type StressTest = {
	id: string;
	label: string;
	levers: RetirementLever[];
	/** For stresses with no lever representation, such as longevity. */
	transform?: (inputs: RetirementPlanInputs) => void;
	appliesTo?: (baseline: RetirementBaseline) => boolean;
};

function buildCatalog(baseline: RetirementBaseline): StressTest[] {
	const { currentAge, retirementAge, longevityAge } = baseline.inputs;
	const crashAge = Math.max(currentAge + 1, retirementAge);
	const ltcAge = Math.min(Math.max(retirementAge + 5, 80), longevityAge - 2);

	return [
		{
			id: "market_crash_next_year",
			label: "Market crash next year",
			levers: [
				{
					type: "market_crash",
					params: {
						atAge: currentAge + 1,
						dropPercent: 0.25,
						recoveryYears: 3,
					},
				},
			],
		},
		{
			id: "crash_2008",
			label: "2008-style crash",
			levers: [
				{
					type: "market_crash",
					params: { atAge: crashAge, dropPercent: 0.37, recoveryYears: 4 },
				},
			],
		},
		{
			id: "weak_returns",
			label: "Five years of weak returns",
			levers: [
				{ type: "sequence_risk", params: { years: 5, annualReturn: 0.01 } },
			],
		},
		{
			id: "high_inflation",
			label: "High inflation",
			levers: [{ type: "inflation_delta", params: { delta: 0.02 } }],
		},
		{
			id: "live_to_100",
			label: "Live to 100",
			levers: [],
			transform: (inputs) => {
				inputs.longevityAge = Math.max(100, inputs.longevityAge);
			},
		},
		{
			id: "healthcare_plus_50",
			label: "Healthcare costs +50%",
			levers: [
				{ type: "healthcare_cost_delta", params: { percentDelta: 0.5 } },
			],
		},
		{
			id: "social_security_cut",
			label: "Social Security reduced 20%",
			levers: [{ type: "social_security_haircut", params: { percent: 0.2 } }],
		},
		{
			id: "long_term_care",
			label: "Long-term care event",
			levers: [
				{
					type: "long_term_care_event",
					params: {
						atAge: ltcAge,
						years: 3,
						monthlyCost: DEFAULT_LTC_MONTHLY_COST,
						whom: "primary",
					},
				},
			],
		},
		{
			id: "early_spouse_death",
			label: "Early spouse death",
			levers: [{ type: "spouse_death", params: { atAge: retirementAge + 5 } }],
			appliesTo: (candidate) => candidate.plan.hasSpouse,
		},
	];
}

export type RunStressTestsInput = {
	baseline: RetirementBaseline;
	/** The user's active stack; every stress runs on top of it. */
	levers: RetirementScenarioLever[];
	trials?: number;
	seed?: number;
} & RetirementComputeOptions;

export async function runStressTests(
	input: RunStressTestsInput,
): Promise<RetirementStressTestsResponse> {
	const trials = input.trials ?? REDUCED_MONTE_CARLO_TRIALS;
	const seed = input.seed ?? 11;
	const compute = {
		yieldEvery: input.yieldEvery,
		signal: input.signal,
		yieldFn: input.yieldFn,
	};
	const nextSortOrder =
		input.levers.reduce((max, entry) => Math.max(max, entry.sortOrder), -1) + 1;

	const measure = async (
		extra: StressTest | null,
	): Promise<RetirementStressTestResult> => {
		const stackedLevers: RetirementScenarioLever[] = [
			...input.levers,
			...(extra?.levers ?? []).map((lever, index) => ({
				id: `${extra?.id ?? "stress"}-${index}`,
				enabled: true,
				sortOrder: nextSortOrder + index,
				lever,
			})),
		];
		const { inputs } = applyLevers(input.baseline, stackedLevers);
		extra?.transform?.(inputs);
		const monteCarlo = await runMonteCarloAsync(inputs, {
			trials,
			seed,
			includeCone: false,
			...compute,
		});
		return {
			id: extra?.id ?? "baseline",
			label: extra?.label ?? "Baseline",
			confidence: monteCarlo.confidence,
			confidenceDelta: 0,
			legacyAtLongevity: projectRetirement(inputs).legacyAtLongevity,
			isBaseline: extra === null,
		};
	};

	const baselineResult = await measure(null);
	const catalog = buildCatalog(input.baseline).filter(
		(test) => test.appliesTo?.(input.baseline) ?? true,
	);
	const results: RetirementStressTestResult[] = [baselineResult];
	for (const test of catalog) {
		const result = await measure(test);
		results.push({
			...result,
			confidenceDelta: result.confidence - baselineResult.confidence,
		});
	}

	return {
		results,
		biggestVulnerability: findBiggestVulnerability(input.baseline, results),
	};
}

function findBiggestVulnerability(
	baseline: RetirementBaseline,
	results: RetirementStressTestResult[],
): RetirementVulnerability | null {
	const worst = results
		.filter((result) => !result.isBaseline)
		.reduce<RetirementStressTestResult | null>(
			(lowest, result) =>
				lowest === null || result.confidenceDelta < lowest.confidenceDelta
					? result
					: lowest,
			null,
		);
	if (worst === null || worst.confidenceDelta >= 0) return null;

	if (worst.id === "long_term_care") {
		return longTermCareVulnerability(baseline, worst);
	}

	const drop = Math.round(Math.abs(worst.confidenceDelta) * 100);
	return {
		testId: worst.id,
		label: worst.label,
		narrative: `${worst.label} is the largest single risk to your plan — it lowers your confidence by about ${drop} percentage points.`,
		actionLabel: null,
		actionHref: null,
	};
}

function longTermCareVulnerability(
	baseline: RetirementBaseline,
	worst: RetirementStressTestResult,
): RetirementVulnerability {
	const coverage = baseline.inputs.ltcCoverage;
	if (coverage === null) {
		return {
			testId: worst.id,
			label: worst.label,
			narrative:
				"A long-term care event is the largest single risk to your plan. You don't currently have a long-term care policy on file.",
			actionLabel: "Review your insurance",
			actionHref: INSURANCE_HREF,
		};
	}

	const monthlyBenefit = Math.round(coverage.monthlyBenefit);
	const fiveYearCost = DEFAULT_LTC_MONTHLY_COST * 12 * 5;
	const fiveYearCovered =
		coverage.monthlyBenefit * 12 * Math.min(coverage.benefitYears, 5);
	const uncovered =
		Math.round(Math.max(0, fiveYearCost - fiveYearCovered) / 1000) * 1000;
	const years = `${coverage.benefitYears} year${coverage.benefitYears === 1 ? "" : "s"}`;
	return {
		testId: worst.id,
		label: worst.label,
		narrative: `Your long-term care policy covers $${monthlyBenefit.toLocaleString("en-US")}/month for ${years} after a ${coverage.eliminationDays}-day elimination period, which absorbs most of a typical event. A five-year event would still cost about $${uncovered.toLocaleString("en-US")} out of pocket.`,
		actionLabel: "Review your insurance",
		actionHref: INSURANCE_HREF,
	};
}
