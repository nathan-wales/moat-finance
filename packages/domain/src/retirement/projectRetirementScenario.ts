// Projects an ad-hoc or saved lever stack, optionally alongside the untouched
// baseline so the UI can render an impact delta table without a second request.

import type {
	ProjectRetirementScenarioInput,
	RetirementProjectionResponse,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import { buildRetirementProjection } from "./build-projection";
import { resolveLeverStack } from "./resolve-levers";

export async function projectRetirementScenario(
	ctx: AppContext,
	input: ProjectRetirementScenarioInput & { now?: Date },
): Promise<RetirementProjectionResponse> {
	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const stack = await resolveLeverStack(ctx, input);

	const { projection } = buildRetirementProjection({
		baseline,
		levers: stack.levers,
		scenarioId: stack.scenarioId,
		scenarioName: stack.scenarioName,
	});

	const includeBaseline = input.includeBaseline !== false;
	const baselineProjection = includeBaseline
		? buildRetirementProjection({ baseline, levers: [] }).projection
		: null;

	return { projection, baseline: baselineProjection };
}
