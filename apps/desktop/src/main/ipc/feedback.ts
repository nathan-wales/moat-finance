import { CreateFeedbackInputSchema, FEEDBACK_CHANNELS } from "@moat/contracts";
import { ipcMain } from "electron";
import { createCloudFeedback } from "../feedback/feedback-cloud-service";

export function registerFeedbackHandlers(): void {
	ipcMain.handle(FEEDBACK_CHANNELS.create, async (_event, raw: unknown) => {
		const input = CreateFeedbackInputSchema.parse(raw);
		return createCloudFeedback({
			type: input.type,
			message: input.message,
			route: input.route,
			appVersion: input.appVersion,
			platform: input.platform,
			userAgent: input.userAgent,
			metadata: input.metadata,
		});
	});
}
