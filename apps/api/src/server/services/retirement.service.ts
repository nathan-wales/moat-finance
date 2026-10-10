import type {
	CompareRetirementScenariosInput,
	CreateRetirementScenarioInput,
	DeleteRetirementScenarioInput,
	DeleteRetirementStandingRuleInput,
	DuplicateRetirementScenarioInput,
	ProjectRetirementScenarioInput,
	RetirementComparison,
	RetirementGoalSeekResponse,
	RetirementMonteCarloResult,
	RetirementOpportunitiesResponse,
	RetirementPlanOverview,
	RetirementPlanSettings,
	RetirementProjectionResponse,
	RetirementScenario,
	RetirementSpendingPlan,
	RetirementStandingRule,
	RetirementStressTestsResponse,
	RunRetirementMonteCarloInput,
	RunRetirementStressTestsInput,
	SolveRetirementGoalInput,
	UpdateRetirementPlanInput,
	UpdateRetirementScenarioInput,
	UpdateRetirementSpendingPlanInput,
	UpsertRetirementStandingRuleInput,
} from "@moat/contracts";
import type { AppContext } from "@moat/domain";
import {
	compareRetirementScenarios,
	createRetirementScenario,
	deleteRetirementScenario,
	deleteRetirementStandingRule,
	duplicateRetirementScenario,
	getRetirementOpportunities,
	getRetirementPlanOverview,
	getRetirementPlanSettings,
	getRetirementSpendingPlan,
	listRetirementScenarios,
	listRetirementStandingRules,
	projectRetirementScenario,
	runRetirementMonteCarlo,
	runRetirementStressTests,
	solveRetirementGoalForUser,
	updateRetirementPlanSettings,
	updateRetirementScenario,
	updateRetirementSpendingPlan,
	upsertRetirementStandingRule,
} from "@moat/domain";
import { logger } from "~/lib/logger";

type TimedInput = { now?: Date };

function leverCountOf(input: { levers?: Array<unknown> | null }): number {
	return input.levers?.length ?? 0;
}

async function timed<T>(
	ctx: AppContext,
	operation: string,
	leverCount: number,
	work: () => Promise<T>,
): Promise<T> {
	const started = Date.now();
	try {
		return await work();
	} finally {
		logger.info("retirement_operation", {
			userId: ctx.userId,
			feature: "retirement",
			operation,
			leverCount,
			durationMs: Date.now() - started,
		});
	}
}

export function getPlanOverview(
	ctx: AppContext,
	input: TimedInput = {},
): Promise<RetirementPlanOverview> {
	return timed(ctx, "getPlanOverview", 0, () =>
		getRetirementPlanOverview(ctx, input),
	);
}

export function projectScenario(
	ctx: AppContext,
	input: ProjectRetirementScenarioInput & TimedInput,
): Promise<RetirementProjectionResponse> {
	return timed(ctx, "projectScenario", leverCountOf(input), () =>
		projectRetirementScenario(ctx, input),
	);
}

export function runMonteCarlo(
	ctx: AppContext,
	input: RunRetirementMonteCarloInput & TimedInput,
): Promise<RetirementMonteCarloResult> {
	return timed(ctx, "runMonteCarlo", leverCountOf(input), () =>
		runRetirementMonteCarlo(ctx, input),
	);
}

export function compareScenarios(
	ctx: AppContext,
	input: CompareRetirementScenariosInput & TimedInput,
): Promise<RetirementComparison> {
	return timed(ctx, "compareScenarios", 0, () =>
		compareRetirementScenarios(ctx, input),
	);
}

export function runStressTests(
	ctx: AppContext,
	input: RunRetirementStressTestsInput & TimedInput,
): Promise<RetirementStressTestsResponse> {
	return timed(ctx, "runStressTests", leverCountOf(input), () =>
		runRetirementStressTests(ctx, input),
	);
}

export function solveGoal(
	ctx: AppContext,
	input: SolveRetirementGoalInput & TimedInput,
): Promise<RetirementGoalSeekResponse> {
	return timed(ctx, "solveGoal", leverCountOf(input), () =>
		solveRetirementGoalForUser(ctx, input),
	);
}

export function getOpportunities(
	ctx: AppContext,
	input: { scenarioId?: string; limit?: number } & TimedInput = {},
): Promise<RetirementOpportunitiesResponse> {
	return timed(ctx, "getOpportunities", 0, () =>
		getRetirementOpportunities(ctx, input),
	);
}

export function getSpendingPlan(
	ctx: AppContext,
	input: TimedInput = {},
): Promise<RetirementSpendingPlan> {
	return timed(ctx, "getSpendingPlan", 0, () =>
		getRetirementSpendingPlan(ctx, input),
	);
}

export function updateSpendingPlan(
	ctx: AppContext,
	input: UpdateRetirementSpendingPlanInput & TimedInput,
): Promise<RetirementSpendingPlan> {
	return timed(ctx, "updateSpendingPlan", 0, () =>
		updateRetirementSpendingPlan(ctx, input),
	);
}

export function getPlan(
	ctx: AppContext,
	input: TimedInput = {},
): Promise<RetirementPlanSettings> {
	return timed(ctx, "getPlan", 0, () => getRetirementPlanSettings(ctx, input));
}

export function updatePlan(
	ctx: AppContext,
	input: UpdateRetirementPlanInput & TimedInput,
): Promise<RetirementPlanSettings> {
	return timed(ctx, "updatePlan", 0, () =>
		updateRetirementPlanSettings(ctx, input),
	);
}

export function listScenarios(ctx: AppContext): Promise<RetirementScenario[]> {
	return timed(ctx, "listScenarios", 0, () => listRetirementScenarios(ctx));
}

export function createScenario(
	ctx: AppContext,
	input: CreateRetirementScenarioInput,
): Promise<RetirementScenario> {
	return timed(ctx, "createScenario", leverCountOf(input), () =>
		createRetirementScenario(ctx, input),
	);
}

export function updateScenario(
	ctx: AppContext,
	input: UpdateRetirementScenarioInput,
): Promise<RetirementScenario> {
	return timed(ctx, "updateScenario", leverCountOf(input), () =>
		updateRetirementScenario(ctx, input),
	);
}

export function duplicateScenario(
	ctx: AppContext,
	input: DuplicateRetirementScenarioInput,
): Promise<RetirementScenario> {
	return timed(ctx, "duplicateScenario", 0, () =>
		duplicateRetirementScenario(ctx, input),
	);
}

export function deleteScenario(
	ctx: AppContext,
	input: DeleteRetirementScenarioInput,
): Promise<void> {
	return timed(ctx, "deleteScenario", 0, () =>
		deleteRetirementScenario(ctx, input),
	);
}

export function listStandingRules(
	ctx: AppContext,
): Promise<RetirementStandingRule[]> {
	return timed(ctx, "listStandingRules", 0, () =>
		listRetirementStandingRules(ctx),
	);
}

export function upsertStandingRule(
	ctx: AppContext,
	input: UpsertRetirementStandingRuleInput,
): Promise<RetirementStandingRule> {
	return timed(ctx, "upsertStandingRule", 0, () =>
		upsertRetirementStandingRule(ctx, input),
	);
}

export function deleteStandingRule(
	ctx: AppContext,
	input: DeleteRetirementStandingRuleInput,
): Promise<void> {
	return timed(ctx, "deleteStandingRule", 0, () =>
		deleteRetirementStandingRule(ctx, input),
	);
}
