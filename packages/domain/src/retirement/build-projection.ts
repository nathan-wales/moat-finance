// Turns engine output into the wire `RetirementProjection`.
//
// Everything the UI reads about a projection is assembled here, in one place, so
// the API, the desktop IPC bridge, and the MCP tools cannot drift in what they
// report for the same lever stack.

import {
	DEFAULT_LIQUID_TYPE_MIX,
	type RetirementAppliedLever,
	type RetirementAssumptions,
	type RetirementProjection,
	type RetirementProjectionSummary,
	type RetirementScenarioLever,
	retirementProjectionKey,
} from "@moat/contracts";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import { toHeadlineMonthlySpend } from "./compose-spend";
import { solveEarliestRetirementAge } from "./earliest-retirement";
import {
	monthlySpendForAge,
	projectRetirement,
	type RetirementProjectionResult,
} from "./project";
import { toTodayDollars } from "./purchasing-power";
import { solveDeterministicSustainableSpending } from "./safe-spending";
import type { RetirementPlanInputs } from "./types";

export type BuildRetirementProjectionInput = {
	baseline: RetirementBaseline;
	levers: RetirementScenarioLever[];
	scenarioId?: string | null;
	scenarioName?: string | null;
	/** From Monte Carlo, when it has run. Deterministic callers pass nothing. */
	confidence?: number | null;
	safeMonthlySpending?: number | null;
	/** Skips the two binary searches for callers that only need the ledger. */
	includeSolvedMetrics?: boolean;
};

export type BuiltRetirementProjection = {
	projection: RetirementProjection;
	inputs: RetirementPlanInputs;
	result: RetirementProjectionResult;
	appliedLevers: RetirementAppliedLever[];
};

/** Headline monthly spending — the figure the user recognizes. */
export function headlineMonthlySpending(
	baseline: RetirementBaseline,
	inputs: RetirementPlanInputs,
): number {
	const engineMonthly = monthlySpendForAge(
		inputs.retirementAge,
		inputs.retirementMonthlySpending,
		inputs.spendingStages,
	);
	return toHeadlineMonthlySpend(engineMonthly, baseline.spendingExclusions);
}

export function buildRetirementProjection(
	input: BuildRetirementProjectionInput,
): BuiltRetirementProjection {
	const { baseline } = input;
	const { inputs, appliedLevers } = applyLevers(baseline, input.levers);
	const result = projectRetirement(inputs);
	const includeSolved = input.includeSolvedMetrics !== false;

	const expectedMonthlySpending = headlineMonthlySpending(baseline, inputs);
	const yearsToRetirement = Math.max(
		0,
		inputs.retirementAge - inputs.currentAge,
	);
	const yearsToLongevity = Math.max(0, inputs.longevityAge - inputs.currentAge);
	const retirementYear = result.years.find(
		(year) => year.age === inputs.retirementAge,
	);
	const earliestSustainableAge = includeSolved
		? solveEarliestRetirementAge(inputs)
		: null;
	const sustainableMonthly = includeSolved
		? toHeadlineMonthlySpend(
				solveDeterministicSustainableSpending(inputs),
				baseline.spendingExclusions,
			)
		: expectedMonthlySpending;

	const summary: RetirementProjectionSummary = {
		targetRetirementAge: baseline.plan.targetRetirementAge,
		retirementAgeUsed: inputs.retirementAge,
		earliestSustainableAge,
		longevityAge: inputs.longevityAge,
		confidence: input.confidence ?? null,
		safeMonthlySpending:
			input.safeMonthlySpending ?? (includeSolved ? sustainableMonthly : null),
		expectedMonthlySpending,
		assetsAtRetirement: result.assetsAtRetirement,
		netWorthAtRetirement:
			retirementYear?.netWorth ?? result.netWorthAtRetirement,
		assetsAtRetirementTodayDollars: toTodayDollars(
			result.assetsAtRetirement,
			inputs.inflationRate,
			yearsToRetirement,
		),
		netWorthAtRetirementTodayDollars:
			retirementYear?.netWorthTodayDollars ??
			toTodayDollars(
				result.netWorthAtRetirement,
				inputs.inflationRate,
				yearsToRetirement,
			),
		legacyAtLongevity: result.legacyAtLongevity,
		legacyAtLongevityTodayDollars: toTodayDollars(
			result.legacyAtLongevity,
			inputs.inflationRate,
			yearsToLongevity,
		),
		confidenceTarget: baseline.plan.confidenceTarget,
		lifetimeTaxes: result.lifetimeTaxes,
		lifetimeSocialSecurity: result.lifetimeSocialSecurity,
		firstShortfallAge: result.firstShortfallAge,
		fundedThroughLongevity: result.fundedThroughLongevity,
		monthlyShortfallAtTarget: Math.max(
			0,
			expectedMonthlySpending - sustainableMonthly,
		),
	};

	const assumptions: RetirementAssumptions = {
		investmentReturnRate: inputs.returnRate,
		inflationRate: inputs.inflationRate,
		salaryGrowthRate: inputs.incomeGrowthRate,
		contributionGrowthRate:
			inputs.contributionGrowthRate ?? inputs.incomeGrowthRate,
		expenseGrowthRate: inputs.expenseGrowthRate ?? inputs.inflationRate,
		realEstateAppreciationRate: baseline.context.realEstateAppreciationRate,
		cashYield: inputs.cashYield,
		volatility: inputs.volatility,
		federalFilingStatus: inputs.filingStatus,
		stateTaxRate: inputs.stateTaxRate,
		taxYear: inputs.taxYear,
		rmdStartAge: inputs.rmdStartAge,
		withdrawalOrder: inputs.withdrawalOrder,
		scenarioRatesSource: baseline.scenarioRatesSource,
	};

	return {
		projection: {
			projectionKey: retirementProjectionKey({
				baselineVersion: baseline.baselineVersion,
				levers: input.levers,
			}),
			baselineVersion: baseline.baselineVersion,
			baselineRefreshedAt: baseline.refreshedAt,
			scenarioId: input.scenarioId ?? null,
			scenarioName: input.scenarioName ?? null,
			summary,
			years: result.years,
			opening: result.opening,
			milestones: result.milestones,
			appliedLevers,
			assumptions,
			taxYear: inputs.taxYear,
			liquidTypeMix: inputs.liquidTypeMix ?? DEFAULT_LIQUID_TYPE_MIX,
		},
		inputs,
		result,
		appliedLevers,
	};
}
