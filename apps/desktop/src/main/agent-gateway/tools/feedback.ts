import {
	mcpToolContracts,
	submitFeedbackInputSchema,
} from "@moat/mcp-contracts";
import { type LocalToolImplementation, localSchemaEnvelope } from "./types";

export const submitFeedbackTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.submitFeedback"],
	async execute(input) {
		const parsed = submitFeedbackInputSchema.parse(input ?? {});
		const { createCloudFeedback } = await import(
			"../../feedback/feedback-cloud-service"
		);
		const result = await createCloudFeedback({
			type: parsed.type,
			message: parsed.message,
			platform: "mcp",
			metadata: {
				relatedToolName: parsed.relatedToolName ?? null,
				severity: parsed.severity ?? null,
				mcpGateway: "local",
				...(parsed.metadata ?? {}),
			},
		});

		return localSchemaEnvelope("feedback.submitted", {
			feedbackId: result.feedbackId,
			status: "submitted" as const,
			message:
				"Feedback has been submitted. Thank you — the Moat team will review it.",
		});
	},
};
