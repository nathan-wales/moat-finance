import {
	CreateScenarioInputSchema,
	DeleteScenarioInputSchema,
	IpcForecastScenarioSchema,
	SCENARIO_CHANNELS,
	SeedDefaultScenariosResponseSchema,
	SetActiveScenarioInputSchema,
	UpdateScenarioInputSchema,
} from "@moat/contracts";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

export function registerScenarioHandlers(): void {
	ipcMain.handle(SCENARIO_CHANNELS.list, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		const scenarios = await appCtx.repositories.forecasts.listScenarios({
			userId: appCtx.userId,
		});
		return IpcForecastScenarioSchema.array().parse(scenarios);
	});

	ipcMain.handle(SCENARIO_CHANNELS.seedDefaults, async () => {
		const { appCtx } = getUnlockedDesktopDb();
		const result = await appCtx.repositories.forecasts.seedDefaultScenarios({
			userId: appCtx.userId,
		});
		return SeedDefaultScenariosResponseSchema.parse(result);
	});

	ipcMain.handle(SCENARIO_CHANNELS.create, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = CreateScenarioInputSchema.parse(raw);
		const scenario = await appCtx.repositories.forecasts.createScenario({
			userId: appCtx.userId,
			...input,
		});
		return IpcForecastScenarioSchema.parse(scenario);
	});

	ipcMain.handle(SCENARIO_CHANNELS.update, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { id, ...data } = UpdateScenarioInputSchema.parse(raw);
		const scenario = await appCtx.repositories.forecasts.updateScenario({
			userId: appCtx.userId,
			id,
			data,
		});
		return IpcForecastScenarioSchema.parse(scenario);
	});

	ipcMain.handle(SCENARIO_CHANNELS.delete, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { id } = DeleteScenarioInputSchema.parse(raw);
		await appCtx.repositories.forecasts.deleteScenario({
			userId: appCtx.userId,
			id,
		});
		return { success: true };
	});

	ipcMain.handle(SCENARIO_CHANNELS.setActive, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { id } = SetActiveScenarioInputSchema.parse(raw);
		await appCtx.repositories.forecasts.setActiveScenario({
			userId: appCtx.userId,
			id,
		});
		return { success: true };
	});
}
