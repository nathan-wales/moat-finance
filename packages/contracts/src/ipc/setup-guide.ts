import { z } from "zod";
import { SetupGuideStateSchema } from "../setup-guide";

export const SETUP_GUIDE_CHANNELS = {
	get: "setupGuide:get",
	completeStep: "setupGuide:completeStep",
	dismiss: "setupGuide:dismiss",
	saveGoals: "setupGuide:saveGoals",
} as const;

export const SetupGuideSaveGoalsInputSchema = z.object({
	goals: z.array(z.string()),
});

export const SetupGuideGetResultSchema = SetupGuideStateSchema;

export const SetupGuideSuccessSchema = SetupGuideStateSchema;

export type SetupGuideIpcResult = z.infer<typeof SetupGuideStateSchema>;
