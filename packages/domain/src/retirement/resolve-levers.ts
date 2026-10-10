// Resolves a request's lever stack, which arrives one of two ways: inline (the
// user is exploring and has saved nothing) or by scenario id (they opened a
// saved plan). Inline levers win when both are present, because that is the
// unsaved edit sitting in front of the user.

import type {
	RetirementLeverInput,
	RetirementScenarioLever,
} from "@moat/contracts";
import type { AppContext } from "../context";
import { retirementNotFoundError } from "./errors";

export type ResolvedLeverStack = {
	levers: RetirementScenarioLever[];
	scenarioId: string | null;
	scenarioName: string | null;
};

export function normalizeLeverInputs(
	levers: RetirementLeverInput[],
): RetirementScenarioLever[] {
	return levers.map((entry, index) => ({
		id: entry.id ?? `lever-${index}`,
		enabled: entry.enabled ?? true,
		sortOrder: entry.sortOrder ?? index,
		lever: entry.lever,
	}));
}

export async function resolveLeverStack(
	ctx: AppContext,
	input: { scenarioId?: string; levers?: RetirementLeverInput[] },
): Promise<ResolvedLeverStack> {
	if (input.levers !== undefined) {
		return {
			levers: normalizeLeverInputs(input.levers),
			scenarioId: input.scenarioId ?? null,
			scenarioName: null,
		};
	}
	if (input.scenarioId === undefined) {
		return { levers: [], scenarioId: null, scenarioName: null };
	}

	const repo = ctx.repositories.retirement;
	if (!repo) throw new Error("Retirement repository is not configured");
	const scenario = await repo.getScenario({
		userId: ctx.userId,
		id: input.scenarioId,
	});
	if (scenario === null) {
		throw retirementNotFoundError();
	}
	return {
		levers: scenario.levers,
		scenarioId: scenario.id,
		scenarioName: scenario.name,
	};
}
