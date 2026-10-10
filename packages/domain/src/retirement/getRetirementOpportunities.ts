import type {
	RetirementLeverInput,
	RetirementOpportunitiesResponse,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import type { RetirementComputeOptions } from "./compute-options";
import { type FindOpportunitiesInput, findOpportunities } from "./improve-plan";
import { resolveLeverStack } from "./resolve-levers";

export type GetRetirementOpportunitiesInput = {
	scenarioId?: string;
	levers?: RetirementLeverInput[];
	now?: Date;
	limit?: number;
};

export async function prepareRetirementOpportunities(
	ctx: AppContext,
	input: GetRetirementOpportunitiesInput = {},
): Promise<FindOpportunitiesInput> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const stack = await resolveLeverStack(ctx, input);
	return {
		baseline,
		levers: stack.levers,
		limit: input.limit,
	};
}

export async function getRetirementOpportunities(
	ctx: AppContext,
	input: GetRetirementOpportunitiesInput = {},
	options: RetirementComputeOptions = {},
): Promise<RetirementOpportunitiesResponse> {
	const prepared = await prepareRetirementOpportunities(ctx, input);
	return {
		opportunities: await findOpportunities({ ...prepared, ...options }),
	};
}
