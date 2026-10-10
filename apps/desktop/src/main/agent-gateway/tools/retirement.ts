import { overlayRetirementMonteCarlo } from "@moat/contracts";
import {
	buildRetirementHeadline,
	createRetirementScenario,
	deleteRetirementScenario,
	getRetirementPlanOverview,
	listRetirementScenarios,
	projectRetirementScenario,
	updateRetirementScenario,
} from "@moat/domain";
import {
	compareRetirementScenariosInputSchema,
	createRetirementScenarioInputSchema,
	deleteRetirementScenarioInputSchema,
	mcpToolContracts,
	projectRetirementScenarioInputSchema,
	runRetirementStressTestInputSchema,
	solveRetirementGoalInputSchema,
	updateRetirementScenarioInputSchema,
} from "@moat/mcp-contracts";
import {
	queuedRetirementComparison,
	queuedRetirementGoalSeek,
	queuedRetirementMonteCarlo,
	queuedRetirementStressTests,
} from "../../retirement/run-queued";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

const DISCLAIMER =
	"This is Moat's estimate based on the user's live accounts, spending, and plan settings — not a guaranteed outcome. Do not recompute these numbers.";

function scenarioUrl(scenarioId?: string | null): string {
	return scenarioId
		? `/retirement?scenario=${encodeURIComponent(scenarioId)}`
		: "/retirement";
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

export const getRetirementPlanTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getRetirementPlan"],
	async execute(_input, ctx: LocalToolContext) {
		const [overview, monteCarlo] = await Promise.all([
			getRetirementPlanOverview(ctx.appRuntime),
			queuedRetirementMonteCarlo(ctx.appRuntime, {
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
		return localSchemaEnvelope("retirement.plan", {
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

export const listRetirementScenariosTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listRetirementScenarios"],
	async execute(_input, ctx: LocalToolContext) {
		const scenarios = await listRetirementScenarios(ctx.appRuntime);
		return localSchemaEnvelope("retirement.scenarios", {
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

export const projectRetirementScenarioTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.projectRetirementScenario"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = projectRetirementScenarioInputSchema.parse(input ?? {});
		const includeBaseline = parsed.includeBaseline ?? true;
		const stackMayDiffer =
			Boolean(parsed.scenarioId) || (parsed.levers?.length ?? 0) > 0;
		const [result, monteCarlo] = await Promise.all([
			projectRetirementScenario(ctx.appRuntime, {
				...parsed,
				includeBaseline,
			}),
			queuedRetirementMonteCarlo(ctx.appRuntime, {
				scenarioId: parsed.scenarioId,
				levers: parsed.levers,
				includeSafeSpending: true,
			}),
		]);
		const baselineMonteCarlo =
			includeBaseline && stackMayDiffer
				? await queuedRetirementMonteCarlo(ctx.appRuntime, {
						levers: [],
						includeSafeSpending: true,
					})
				: null;
		const baselineMc = baselineMonteCarlo ?? monteCarlo;
		return localSchemaEnvelope("retirement.projection", {
			resultType: "estimate" as const,
			disclaimer: DISCLAIMER,
			scenarioId: parsed.scenarioId ?? null,
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
			url: parsed.scenarioId ? scenarioUrl(parsed.scenarioId) : scenarioUrl(),
		});
	},
};

export const compareRetirementScenariosTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.compareRetirementScenarios"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = compareRetirementScenariosInputSchema.parse(input);
		const comparison = await queuedRetirementComparison(ctx.appRuntime, parsed);
		return localSchemaEnvelope("retirement.comparison", {
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
				url: column.scenarioId ? scenarioUrl(column.scenarioId) : scenarioUrl(),
			})),
		});
	},
};

export const runRetirementStressTestTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.runRetirementStressTest"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = runRetirementStressTestInputSchema.parse(input ?? {});
		const result = await queuedRetirementStressTests(ctx.appRuntime, parsed);
		return localSchemaEnvelope("retirement.stress", {
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

export const solveRetirementGoalTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.solveRetirementGoal"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = solveRetirementGoalInputSchema.parse(input);
		const result = await queuedRetirementGoalSeek(ctx.appRuntime, parsed);
		return localSchemaEnvelope("retirement.goal", {
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

export const createRetirementScenarioTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.createRetirementScenario"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = createRetirementScenarioInputSchema.parse(input);
		const scenario = await createRetirementScenario(ctx.appRuntime, parsed);
		const [projection, monteCarlo] = await Promise.all([
			projectRetirementScenario(ctx.appRuntime, {
				scenarioId: scenario.id,
				includeBaseline: true,
			}),
			queuedRetirementMonteCarlo(ctx.appRuntime, {
				scenarioId: scenario.id,
				includeSafeSpending: true,
			}),
		]);
		const baselineMonteCarlo = await queuedRetirementMonteCarlo(
			ctx.appRuntime,
			{
				levers: [],
				includeSafeSpending: true,
			},
		);
		return localSchemaEnvelope("retirement.scenarioCreated", {
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

export const updateRetirementScenarioTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateRetirementScenario"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = updateRetirementScenarioInputSchema.parse(input);
		const scenario = await updateRetirementScenario(ctx.appRuntime, parsed);
		return localSchemaEnvelope("retirement.scenarioUpdated", {
			scenarioId: scenario.id,
			name: scenario.name,
			leverCount: scenario.levers.length,
			url: scenarioUrl(scenario.id),
		});
	},
};

export const deleteRetirementScenarioTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteRetirementScenario"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = deleteRetirementScenarioInputSchema.parse(input);
		await deleteRetirementScenario(ctx.appRuntime, { id: parsed.id });
		return localSchemaEnvelope("retirement.scenarioDeleted", {
			success: true as const,
			id: parsed.id,
		});
	},
};
