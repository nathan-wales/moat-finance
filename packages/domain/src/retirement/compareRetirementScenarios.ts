// Baseline plus up to three saved scenarios, aligned so the comparison table and
// the overlay chart cannot disagree: both read the same columns.

import type { CompareRetirementScenariosInput } from "@moat/contracts";
import { RETIREMENT_COMPARISON_MAX_SCENARIOS } from "@moat/contracts";
import type { AppContext } from "../context";
import { buildRetirementBaseline } from "./build-baseline";
import {
	computeRetirementComparison,
	type PreparedRetirementComparison,
} from "./compare-compute";
import type { RetirementComputeOptions } from "./compute-options";
import { REDUCED_MONTE_CARLO_TRIALS } from "./constants";
import { retirementNotFoundError } from "./errors";

export type { PreparedRetirementComparison };

export async function prepareRetirementComparison(
	ctx: AppContext,
	input: CompareRetirementScenariosInput & { now?: Date },
): Promise<PreparedRetirementComparison> {
	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");

	const baseline = await buildRetirementBaseline(ctx, { now: input.now });
	const saved = await repo.listScenarios({ userId: ctx.userId });
	const requestedIds = input.scenarioIds.slice(
		0,
		RETIREMENT_COMPARISON_MAX_SCENARIOS,
	);
	const requested = requestedIds.flatMap((id) =>
		saved.filter((scenario) => scenario.id === id),
	);
	if (requested.length !== requestedIds.length) {
		throw retirementNotFoundError();
	}

	return {
		userId: ctx.userId,
		trials: input.trials ?? REDUCED_MONTE_CARLO_TRIALS,
		includeBaseline: input.includeBaseline !== false,
		baseline,
		scenarios: requested.map((scenario) => ({
			id: scenario.id,
			name: scenario.name,
			color: scenario.color,
			levers: scenario.levers,
		})),
	};
}

export async function compareRetirementScenarios(
	ctx: AppContext,
	input: CompareRetirementScenariosInput & { now?: Date },
	options: RetirementComputeOptions = {},
) {
	const prepared = await prepareRetirementComparison(ctx, input);
	return computeRetirementComparison(prepared, options);
}
