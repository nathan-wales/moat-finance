import type {
	RetirementGoalSeekResponse,
	SolveRetirementGoalInput,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import {
	type SolveRetirementGoalInput as SolveRetirementGoalEngineInput,
	solveRetirementGoal as solve,
} from "./goal-seek";
import { resolveLeverStack } from "./resolve-levers";

export async function prepareRetirementGoalSeek(
	ctx: AppContext,
	input: SolveRetirementGoalInput & { now?: Date },
): Promise<SolveRetirementGoalEngineInput> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const stack = await resolveLeverStack(ctx, input);
	return {
		baseline,
		objective: input.objective,
		levers: stack.levers,
	};
}

export async function solveRetirementGoalForUser(
	ctx: AppContext,
	input: SolveRetirementGoalInput & { now?: Date },
	options: RetirementComputeOptions = {},
): Promise<RetirementGoalSeekResponse> {
	const prepared = await prepareRetirementGoalSeek(ctx, input);
	return solve({ ...prepared, ...options });
}
