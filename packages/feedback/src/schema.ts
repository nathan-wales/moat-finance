import { z } from "zod";

export const MAX_FEEDBACK_LENGTH = 2000;

export const feedbackMessageSchema = z
	.string()
	.min(1, "Message is required")
	.max(
		MAX_FEEDBACK_LENGTH,
		`Message must be at most ${MAX_FEEDBACK_LENGTH} characters`,
	)
	.transform((v) => v.trim())
	.refine((v) => v.length > 0, "Message cannot be empty");

export const createFeedbackInputSchema = z.object({
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
	message: feedbackMessageSchema,
	route: z.string().max(500).optional(),
	appVersion: z.string().max(50).optional(),
	platform: z.string().max(50).optional(),
	userAgent: z.string().max(500).optional(),
	metadata: z.record(z.unknown()).optional(),
});

export type CreateFeedbackInputParsed = z.infer<
	typeof createFeedbackInputSchema
>;
