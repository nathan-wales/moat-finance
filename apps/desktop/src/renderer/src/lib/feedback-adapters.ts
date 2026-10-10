import type {
	CreateFeedbackInput,
	CreateFeedbackResponse,
	FeedbackContext,
	FeedbackSubmitAdapter,
} from "@moat/feedback";

export const desktopFeedbackSubmitAdapter: FeedbackSubmitAdapter = {
	async submit(input: CreateFeedbackInput): Promise<CreateFeedbackResponse> {
		return window.moatDesktop.feedback.create({
			type: input.type,
			source: input.source,
			message: input.message,
			route: input.route,
			appVersion: input.appVersion,
			platform: input.platform,
			userAgent: input.userAgent,
			metadata: input.metadata,
		});
	},
};

export function getDesktopFeedbackContext(): FeedbackContext {
	return {
		platform: "desktop",
		appVersion: undefined, // TODO: read from Electron app.getVersion() via IPC
		userAgent:
			typeof navigator !== "undefined" ? navigator.userAgent : undefined,
	};
}
