import { overlayRetirementMonteCarlo } from "@moat/contracts";
import type { DbClient } from "@moat/db-postgres";
import { createPostgresAppContext } from "@moat/db-postgres";
import {
	buildRetirementHeadline,
	compareRetirementScenarios,
	createRetirementScenario,
	deleteRetirementScenario,
	getRetirementPlanOverview,
	listRetirementScenarios,
	projectRetirementScenario,
	runRetirementMonteCarlo,
	runRetirementStressTests,
	solveRetirementGoalForUser,
	updateRetirementScenario,
} from "@moat/domain";
import type {
	CompareRetirementScenariosInput,
	CreateRetirementScenarioInput,
	DeleteRetirementScenarioInput,
	ProjectRetirementScenarioInput,
	RunRetirementStressTestInput,
	SolveRetirementGoalInput,
	UpdateRetirementScenarioInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

const DISCLAIMER =
	"This is Moat's estimate based on the user's live accounts, spending, and plan settings — not a guaranteed outcome. Do not recompute these numbers.";

function appContext(context: McpAuthContext) {
	return createPostgresAppContext(
		context.userId,
		context.db as unknown as DbClient,
	);
}

function appBaseUrl(): string {
	return (process.env.MOAT_APP_URL ?? "https://app.moatfinance.com").replace(
		/\/$/,
		"",
	);
}

function scenarioUrl(scenarioId?: string | null): string {
	const base = `${appBaseUrl()}/retirement`;
	return scenarioId
		? `${base}?scenario=${encodeURIComponent(scenarioId)}`
		: base;
}

function compactSummary(summary: {
	targetRetirementAge: number;
	retirementAgeUsed: number;
	earliestSustainableAge: number | null;
	confidence: number | null;
	safeMonthlySpending: number | null;
	expectedMonthlySpending: number;
	assetsAtRetirement: number;
	legacyAtLongevity: number;
	fundedThroughLongevity: boolean;
	monthlyShortfallAtTarget: number;
}) {
	return {
		targetRetirementAge: summary.targetRetirementAge,
		retirementAgeUsed: summary.retirementAgeUsed,
		earliestSustainableAge: summary.earliestSustainableAge,
		confidence: summary.confidence,
		safeMonthlySpending: summary.safeMonthlySpending,
		expectedMonthlySpending: summary.expectedMonthlySpending,
		assetsAtRetirement: summary.assetsAtRetirement,
		legacyAtLongevity: summary.legacyAtLongevity,
		fundedThroughLongevity: summary.fundedThroughLongevity,
		monthlyShortfallAtTarget: summary.monthlyShortfallAtTarget,
	};
}

export const getRetirementPlanTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.getRetirementPlan"],
	async execute(_input, context: McpAuthContext) {
		const ctx = appContext(context);
		const [overview, monteCarlo] = await Promise.all([
			getRetirementPlanOverview(ctx),
			runRetirementMonteCarlo(ctx, {
				levers: [],
				includeSafeSpending: true,
			}),
		]);
		const summary = overlayRetirementMonteCarlo(
			overview.projection.summary,
			monteCarlo,
		);
		const headline = buildRetirementHeadline({
			dataStatus: overview.dataStatus,
			summary,
			confidence: monteCarlo.confidence,
		});
		return schemaEnvelope("retirement.plan", {
			resultType: "estimate" as const,
			disclaimer: DISCLAIMER,
			headline: headline.headline,
			supporting: headline.supporting,
			summary: compactSummary(summary),
			planConfidenceScore: overview.planConfidence.score,
			missingInputCount: overview.missingInputs.length,
			suggestedLeverCount: overview.suggestedLevers.length,
			url: scenarioUrl(),
		});
	},
};

export const listRetirementScenariosTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listRetirementScenarios"],
	async execute(_input, context: McpAuthContext) {
		const scenarios = await listRetirementScenarios(appContext(context));
		return schemaEnvelope("retirement.scenarios", {
			scenarios: scenarios.map((scenario) => ({
				id: scenario.id,
				name: scenario.name,
				description: scenario.description,
				isPinned: scenario.isPinned,
				leverCount: scenario.levers.length,
				leverTypes: scenario.levers.map((entry) => entry.lever.type),
				url: scenarioUrl(scenario.id),
			})),
		});
	},
};

export const projectRetirementScenarioTool: McpToolImplementation<ProjectRetirementScenarioInput> =
	{
		contract: mcpToolContracts["moat.projectRetirementScenario"],
		async execute(input, context: McpAuthContext) {
			const ctx = appContext(context);
			const includeBaseline = input.includeBaseline ?? true;
			const stackMayDiffer =
				Boolean(input.scenarioId) || (input.levers?.length ?? 0) > 0;
			const [result, monteCarlo, baselineMonteCarlo] = await Promise.all([
				projectRetirementScenario(ctx, {
					...input,
					includeBaseline,
				}),
				runRetirementMonteCarlo(ctx, {
					scenarioId: input.scenarioId,
					levers: input.levers,
					includeSafeSpending: true,
				}),
				includeBaseline && stackMayDiffer
					? runRetirementMonteCarlo(ctx, {
							levers: [],
							includeSafeSpending: true,
						})
					: Promise.resolve(null),
			]);
			const baselineMc = baselineMonteCarlo ?? monteCarlo;
			return schemaEnvelope("retirement.projection", {
				resultType: "estimate" as const,
				disclaimer: DISCLAIMER,
				scenarioId: input.scenarioId ?? null,
				summary: compactSummary(
					overlayRetirementMonteCarlo(result.projection.summary, monteCarlo),
				),
				baselineSummary: result.baseline
					? {
							safeMonthlySpending: baselineMc.safeMonthlySpending,
							confidence: baselineMc.confidence,
							earliestSustainableAge:
								result.baseline.summary.earliestSustainableAge,
							assetsAtRetirement: result.baseline.summary.assetsAtRetirement,
							legacyAtLongevity: result.baseline.summary.legacyAtLongevity,
						}
					: null,
				appliedLeverCount: result.projection.appliedLevers.filter(
					(entry) => entry.applied,
				).length,
				url: input.scenarioId ? scenarioUrl(input.scenarioId) : scenarioUrl(),
			});
		},
	};

export const compareRetirementScenariosTool: McpToolImplementation<CompareRetirementScenariosInput> =
	{
		contract: mcpToolContracts["moat.compareRetirementScenarios"],
		async execute(input, context: McpAuthContext) {
			const comparison = await compareRetirementScenarios(
				appContext(context),
				input,
			);
			return schemaEnvelope("retirement.comparison", {
				resultType: "estimate" as const,
				disclaimer: DISCLAIMER,
				columns: comparison.columns.map((column) => ({
					scenarioId: column.scenarioId,
					name: column.name,
					confidence: column.confidence,
					runsOut: column.runsOut,
					safeMonthlySpending: column.summary.safeMonthlySpending,
					assetsAtRetirement: column.summary.assetsAtRetirement,
					legacyAtLongevity: column.summary.legacyAtLongevity,
					url: column.scenarioId
						? scenarioUrl(column.scenarioId)
						: scenarioUrl(),
				})),
			});
		},
	};

export const runRetirementStressTestTool: McpToolImplementation<RunRetirementStressTestInput> =
	{
		contract: mcpToolContracts["moat.runRetirementStressTest"],
		async execute(input, context: McpAuthContext) {
			const result = await runRetirementStressTests(appContext(context), input);
			return schemaEnvelope("retirement.stress", {
				resultType: "estimate" as const,
				disclaimer: DISCLAIMER,
				results: result.results.map((row) => ({
					id: row.id,
					label: row.label,
					confidence: row.confidence,
					confidenceDelta: row.confidenceDelta,
					isBaseline: row.isBaseline,
				})),
				biggestVulnerability: result.biggestVulnerability
					? {
							id: result.biggestVulnerability.testId,
							label: result.biggestVulnerability.label,
							narrative: result.biggestVulnerability.narrative,
						}
					: null,
			});
		},
	};

export const solveRetirementGoalTool: McpToolImplementation<SolveRetirementGoalInput> =
	{
		contract: mcpToolContracts["moat.solveRetirementGoal"],
		async execute(input, context: McpAuthContext) {
			const result = await solveRetirementGoalForUser(
				appContext(context),
				input,
			);
			return schemaEnvelope("retirement.goal", {
				resultType: "estimate" as const,
				disclaimer: DISCLAIMER,
				objectiveLabel: result.objectiveLabel,
				currentStateLabel: result.currentStateLabel,
				reachable: result.reachable,
				unreachableMessage: result.unreachableMessage,
				options: result.options.map((option) => ({
					id: option.id,
					label: option.label,
					detail: option.detail,
					reachesGoal: option.reachesGoal,
					resultingConfidence: option.resultingConfidence,
					leverTypes: option.levers.map((lever) => lever.type),
				})),
			});
		},
	};

export const createRetirementScenarioTool: McpToolImplementation<CreateRetirementScenarioInput> =
	{
		contract: mcpToolContracts["moat.createRetirementScenario"],
		async execute(input, context: McpAuthContext) {
			const ctx = appContext(context);
			const scenario = await createRetirementScenario(ctx, input);
			const [projection, monteCarlo, baselineMonteCarlo] = await Promise.all([
				projectRetirementScenario(ctx, {
					scenarioId: scenario.id,
					includeBaseline: true,
				}),
				runRetirementMonteCarlo(ctx, {
					scenarioId: scenario.id,
					includeSafeSpending: true,
				}),
				runRetirementMonteCarlo(ctx, {
					levers: [],
					includeSafeSpending: true,
				}),
			]);
			return schemaEnvelope("retirement.scenarioCreated", {
				resultType: "estimate" as const,
				disclaimer: DISCLAIMER,
				scenarioId: scenario.id,
				name: scenario.name,
				confidence: monteCarlo.confidence,
				safeMonthlySpending: monteCarlo.safeMonthlySpending,
				baselineSafeMonthlySpending: baselineMonteCarlo.safeMonthlySpending,
				earliestSustainableAge:
					projection.projection.summary.earliestSustainableAge,
				url: scenarioUrl(scenario.id),
			});
		},
	};

export const updateRetirementScenarioTool: McpToolImplementation<UpdateRetirementScenarioInput> =
	{
		contract: mcpToolContracts["moat.updateRetirementScenario"],
		async execute(input, context: McpAuthContext) {
			const scenario = await updateRetirementScenario(
				appContext(context),
				input,
			);
			return schemaEnvelope("retirement.scenarioUpdated", {
				scenarioId: scenario.id,
				name: scenario.name,
				leverCount: scenario.levers.length,
				url: scenarioUrl(scenario.id),
			});
		},
	};

export const deleteRetirementScenarioTool: McpToolImplementation<DeleteRetirementScenarioInput> =
	{
		contract: mcpToolContracts["moat.deleteRetirementScenario"],
		async execute(input, context: McpAuthContext) {
			await deleteRetirementScenario(appContext(context), { id: input.id });
			return schemaEnvelope("retirement.scenarioDeleted", {
				success: true as const,
				id: input.id,
			});
		},
	};
