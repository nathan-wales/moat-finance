import {
	CompleteSetupGuideStepInputSchema,
	SETUP_GUIDE_CHANNELS,
	SetupGuideSaveGoalsInputSchema,
	type SetupGuideState,
} from "@moat/contracts";
import { ipcMain } from "electron";
import {
	completeCloudSetupGuideStep,
	dismissCloudSetupGuide,
	fetchCloudSetupGuide,
	saveCloudSetupGuideGoals,
} from "../setup-guide/api-client";

export function registerSetupGuideHandlers(): void {
	ipcMain.handle(
		SETUP_GUIDE_CHANNELS.get,
		async (): Promise<SetupGuideState> => {
			return fetchCloudSetupGuide();
		},
	);

	ipcMain.handle(
		SETUP_GUIDE_CHANNELS.completeStep,
		async (_event, raw: unknown): Promise<SetupGuideState> => {
			const input = CompleteSetupGuideStepInputSchema.parse(raw);
			return completeCloudSetupGuideStep(input.stepId);
		},
	);

	ipcMain.handle(
		SETUP_GUIDE_CHANNELS.dismiss,
		async (): Promise<SetupGuideState> => {
			return dismissCloudSetupGuide();
		},
	);

	ipcMain.handle(
		SETUP_GUIDE_CHANNELS.saveGoals,
		async (_event, raw: unknown): Promise<SetupGuideState> => {
			const input = SetupGuideSaveGoalsInputSchema.parse(raw);
			return saveCloudSetupGuideGoals(input.goals);
		},
	);
}
