import {
	IpcCompareRetirementScenariosInputSchema,
	IpcCreateRetirementScenarioInputSchema,
	IpcDeleteRetirementScenarioInputSchema,
	IpcDeleteRetirementStandingRuleInputSchema,
	IpcDuplicateRetirementScenarioInputSchema,
	IpcProjectRetirementScenarioInputSchema,
	IpcRetirementOpportunitiesInputSchema,
	IpcRunRetirementMonteCarloInputSchema,
	IpcRunRetirementStressTestsInputSchema,
	IpcSolveRetirementGoalInputSchema,
	IpcUpdateRetirementPlanInputSchema,
	IpcUpdateRetirementScenarioInputSchema,
	IpcUpdateRetirementSpendingPlanInputSchema,
	IpcUpsertRetirementStandingRuleInputSchema,
	RETIREMENT_CHANNELS,
} from "@moat/contracts";
import {
	createRetirementScenario,
	deleteRetirementScenario,
	deleteRetirementStandingRule,
	duplicateRetirementScenario,
	getRetirementPlanOverview,
	getRetirementPlanSettings,
	getRetirementSpendingPlan,
	listRetirementScenarios,
	listRetirementStandingRules,
	projectRetirementScenario,
	updateRetirementPlanSettings,
	updateRetirementScenario,
	updateRetirementSpendingPlan,
	upsertRetirementStandingRule,
} from "@moat/domain";
import { ipcMain } from "electron";
import {
	queuedRetirementComparison,
	queuedRetirementGoalSeek,
	queuedRetirementMonteCarlo,
	queuedRetirementOpportunities,
	queuedRetirementStressTests,
} from "../retirement/run-queued";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerRetirementHandlers(): void {
	ipcMain.handle(RETIREMENT_CHANNELS.getPlanOverview, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return getRetirementPlanOverview(appCtx);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.projectScenario, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcProjectRetirementScenarioInputSchema.parse(raw);
		return projectRetirementScenario(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.runMonteCarlo, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcRunRetirementMonteCarloInputSchema.parse(raw);
		return queuedRetirementMonteCarlo(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.compareScenarios, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcCompareRetirementScenariosInputSchema.parse(raw);
		return queuedRetirementComparison(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.runStressTests, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcRunRetirementStressTestsInputSchema.parse(raw);
		return queuedRetirementStressTests(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.solveGoal, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcSolveRetirementGoalInputSchema.parse(raw);
		return queuedRetirementGoalSeek(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.getOpportunities, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcRetirementOpportunitiesInputSchema.parse(raw ?? {});
		return queuedRetirementOpportunities(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.getSpendingPlan, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return getRetirementSpendingPlan(appCtx);
	});

	ipcMain.handle(
		RETIREMENT_CHANNELS.updateSpendingPlan,
		async (_event, raw) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = IpcUpdateRetirementSpendingPlanInputSchema.parse(raw);
			return updateRetirementSpendingPlan(appCtx, input);
		},
	);

	ipcMain.handle(RETIREMENT_CHANNELS.getPlan, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return getRetirementPlanSettings(appCtx);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.updatePlan, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcUpdateRetirementPlanInputSchema.parse(raw);
		return updateRetirementPlanSettings(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.listScenarios, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return listRetirementScenarios(appCtx);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.createScenario, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcCreateRetirementScenarioInputSchema.parse(raw);
		return createRetirementScenario(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.updateScenario, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcUpdateRetirementScenarioInputSchema.parse(raw);
		return updateRetirementScenario(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.duplicateScenario, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcDuplicateRetirementScenarioInputSchema.parse(raw);
		return duplicateRetirementScenario(appCtx, input);
	});

	// Mirrors the API handler, which resolves with no payload.
	ipcMain.handle(RETIREMENT_CHANNELS.deleteScenario, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = IpcDeleteRetirementScenarioInputSchema.parse(raw);
		await deleteRetirementScenario(appCtx, input);
	});

	ipcMain.handle(RETIREMENT_CHANNELS.listStandingRules, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		return listRetirementStandingRules(appCtx);
	});

	ipcMain.handle(
		RETIREMENT_CHANNELS.upsertStandingRule,
		async (_event, raw) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = IpcUpsertRetirementStandingRuleInputSchema.parse(raw);
			return upsertRetirementStandingRule(appCtx, input);
		},
	);

	ipcMain.handle(
		RETIREMENT_CHANNELS.deleteStandingRule,
		async (_event, raw) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = IpcDeleteRetirementStandingRuleInputSchema.parse(raw);
			await deleteRetirementStandingRule(appCtx, input);
		},
	);
}
