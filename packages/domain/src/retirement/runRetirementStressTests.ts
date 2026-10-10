import type {
	RetirementStressTestsResponse,
	RunRetirementStressTestsInput,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import { resolveLeverStack } from "./resolve-levers";
import { type RunStressTestsInput, runStressTests } from "./stress-test";

export async function prepareRetirementStressTests(
	ctx: AppContext,
	input: RunRetirementStressTestsInput & { now?: Date },
): Promise<RunStressTestsInput> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const stack = await resolveLeverStack(ctx, input);
	return {
		baseline,
		levers: stack.levers,
		trials: input.trials,
	};
}

export async function runRetirementStressTests(
	ctx: AppContext,
	input: RunRetirementStressTestsInput & { now?: Date },
	options: RetirementComputeOptions = {},
): Promise<RetirementStressTestsResponse> {
	const prepared = await prepareRetirementStressTests(ctx, input);
	return runStressTests({ ...prepared, ...options });
}
