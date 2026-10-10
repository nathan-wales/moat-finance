// Worker-safe retirement CPU jobs. Hosts prepare DB-backed inputs on the main
// / API thread, then hand a plain JSON payload to these functions. Do not import
// AppContext, Prisma, or Plaid from this module.

import type {
	RetirementComparison,
	RetirementGoalSeekResponse,
	RetirementMonteCarloResult,
	RetirementOpportunitiesResponse,
	RetirementStressTestsResponse,
} from "@moat/contracts";
import {
	computeRetirementComparison,
	type PreparedRetirementComparison,
} from "./compare-compute";
import type { SpendCarveOuts } from "./compose-spend";
import { toHeadlineMonthlySpend } from "./compose-spend";
import type { RetirementComputeOptions } from "./compute-options";
import {
	type SolveRetirementGoalInput,
	solveRetirementGoal,
} from "./goal-seek";
import { type FindOpportunitiesInput, findOpportunities } from "./improve-plan";
import { runMonteCarloAsync } from "./monte-carlo";
import { solveSafeSpending } from "./safe-spending";
import { type RunStressTestsInput, runStressTests } from "./stress-test";
import type { RetirementPlanInputs } from "./types";

export type PreparedRetirementMonteCarlo = {
	inputs: RetirementPlanInputs;
	trials: number;
	seed: number;
	includeCone: boolean;
	includeSafeSpending: boolean;
	confidenceTarget: number;
	spendingExclusions: SpendCarveOuts;
	projectionKey: string;
};

export async function computeRetirementMonteCarlo(
	prepared: PreparedRetirementMonteCarlo,
	options: RetirementComputeOptions = {},
): Promise<RetirementMonteCarloResult> {
	const outcome = await runMonteCarloAsync(prepared.inputs, {
		trials: prepared.trials,
		seed: prepared.seed,
		includeCone: prepared.includeCone,
		...options,
	});

	const safeMonthlySpending = prepared.includeSafeSpending
		? toHeadlineMonthlySpend(
				(
					await solveSafeSpending(prepared.inputs, {
						confidenceTarget: prepared.confidenceTarget,
						seed: prepared.seed,
						...options,
					})
				).monthlySpending,
				prepared.spendingExclusions,
			)
		: null;

	return {
		projectionKey: prepared.projectionKey,
		trials: outcome.trials,
		fundedTrials: outcome.fundedTrials,
		depletedTrials: outcome.depletedTrials,
		confidence: outcome.confidence,
		earliestDepletionAge: outcome.earliestDepletionAge,
		medianDepletionAge: outcome.medianDepletionAge,
		worstDecileLegacy: outcome.worstDecileLegacy,
		medianLegacy: outcome.medianLegacy,
		safeMonthlySpending,
		cone: outcome.cone,
	};
}

export type RetirementComputeJob =
	| { kind: "monteCarlo"; payload: PreparedRetirementMonteCarlo }
	| { kind: "stressTests"; payload: RunStressTestsInput }
	| { kind: "opportunities"; payload: FindOpportunitiesInput }
	| { kind: "compare"; payload: PreparedRetirementComparison }
	| { kind: "goalSeek"; payload: SolveRetirementGoalInput };

export { RetirementComputeAbortedError } from "./compute-options";

export type RetirementComputeJobResult = {
	monteCarlo: RetirementMonteCarloResult;
	stressTests: RetirementStressTestsResponse;
	opportunities: RetirementOpportunitiesResponse;
	compare: RetirementComparison;
	goalSeek: RetirementGoalSeekResponse;
};

export async function runRetirementComputeJob(
	job: RetirementComputeJob,
	options: RetirementComputeOptions = {},
): Promise<RetirementComputeJobResult[RetirementComputeJob["kind"]]> {
	switch (job.kind) {
		case "monteCarlo":
			return computeRetirementMonteCarlo(job.payload, options);
		case "stressTests":
			return runStressTests({ ...job.payload, ...options });
		case "opportunities":
			return {
				opportunities: await findOpportunities({
					...job.payload,
					...options,
				}),
			};
		case "compare":
			return computeRetirementComparison(job.payload, options);
		case "goalSeek":
			return solveRetirementGoal({ ...job.payload, ...options });
	}
}
