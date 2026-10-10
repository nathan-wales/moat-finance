// Confidence and the percentile cone for a lever stack.
//
// Seeded from the projection key, so an unchanged baseline and stack always
// report the same percentage. Users notice when a number moves for no reason,
// and a jittering confidence badge destroys trust in every other number.

import type {
	RetirementMonteCarloResult,
	RunRetirementMonteCarloInput,
} from "@moat/contracts";
import { retirementProjectionKey } from "@moat/contracts";
import type { AppContext } from "../context";
import { applyLevers } from "./apply-levers";
import { buildRetirementBaseline } from "./build-baseline";
import {
	computeRetirementMonteCarlo,
	type PreparedRetirementMonteCarlo,
} from "./compute-jobs";
import type { RetirementComputeOptions } from "./compute-options";
import { seedFromKey } from "./monte-carlo";
import { resolveLeverStack } from "./resolve-levers";

export type { PreparedRetirementMonteCarlo };

export async function prepareRetirementMonteCarlo(
	ctx: AppContext,
	input: RunRetirementMonteCarloInput & { now?: Date },
): Promise<PreparedRetirementMonteCarlo> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const stack = await resolveLeverStack(ctx, input);
	const { inputs } = applyLevers(baseline, stack.levers);

	const projectionKey = retirementProjectionKey({
		baselineVersion: baseline.baselineVersion,
		levers: stack.levers,
	});
	const seed = seedFromKey(
		`${ctx.userId}:${stack.scenarioId ?? "adhoc"}:${projectionKey}`,
	);

	return {
		inputs,
		trials: input.trials ?? baseline.plan.monteCarloTrials,
		seed,
		includeCone: input.includeCone !== false,
		includeSafeSpending: input.includeSafeSpending === true,
		confidenceTarget: baseline.plan.confidenceTarget,
		spendingExclusions: baseline.spendingExclusions,
		projectionKey,
	};
}

export async function runRetirementMonteCarlo(
	ctx: AppContext,
	input: RunRetirementMonteCarloInput & { now?: Date },
	options: RetirementComputeOptions = {},
): Promise<RetirementMonteCarloResult> {
	const prepared = await prepareRetirementMonteCarlo(ctx, input);
	return computeRetirementMonteCarlo(prepared, options);
}
