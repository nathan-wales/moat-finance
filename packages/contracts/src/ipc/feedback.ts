import { z } from "zod";

export const FEEDBACK_CHANNELS = {
	create: "feedback:create",
} as const;

export const CreateFeedbackInputSchema = z.object({
	type: z
		.enum([
			"GENERAL",
			"BUG",
			"FEATURE_REQUEST",
			"UX_FEEDBACK",
			"MCP_TOOL_ISSUE",
			"INCORRECT_RESULT",
			"OTHER",
		])
		.optional(),
	source: z.enum(["WEB_APP", "DESKTOP_APP", "MCP"]),
	message: z
		.string()
		.min(1)
		.max(2000)
		.transform((v) => v.trim())
		.refine((v) => v.length > 0),
	route: z.string().max(500).optional(),
	appVersion: z.string().max(50).optional(),
	platform: z.string().max(50).optional(),
	userAgent: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export const CreateFeedbackResponseSchema = z.object({
	feedbackId: z.string(),
	status: z.literal("created"),
});

export type IpcCreateFeedbackInput = z.infer<typeof CreateFeedbackInputSchema>;
export type IpcCreateFeedbackResponse = z.infer<
	typeof CreateFeedbackResponseSchema
>;
