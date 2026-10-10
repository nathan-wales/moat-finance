import type { SubmitFeedbackInput } from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import type { FeedbackType } from "../../../api/generated/prisma";
import { createFeedbackRecord } from "../../../api/src/server/services/feedback-record.service";
import { scheduleFeedbackGitHubSync } from "../../../api/src/server/services/github-feedback-sync.service";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

async function submitFeedback(
	input: SubmitFeedbackInput,
	context: McpAuthContext,
): Promise<unknown> {
	const feedbackType = input.type as FeedbackType;
	const metadata = {
		relatedToolName: input.relatedToolName ?? null,
		severity: input.severity ?? null,
		...(input.metadata ?? {}),
	};

	const feedback = await createFeedbackRecord({
		userId: context.userId,
		householdId: context.householdId,
		type: feedbackType,
		source: "MCP",
		message: input.message,
		platform: "mcp",
		metadata,
	});

	scheduleFeedbackGitHubSync({
		feedbackId: feedback.id,
		userId: context.userId,
		type: feedbackType,
		source: "MCP",
		message: input.message,
		platform: "mcp",
		metadata,
	});

	return schemaEnvelope("feedback.submitted", {
		feedbackId: feedback.id,
		status: "submitted",
		message:
			"Feedback has been submitted. Thank you — the Moat team will review it.",
	});
}

export const submitFeedbackTool: McpToolImplementation<SubmitFeedbackInput> = {
	contract: mcpToolContracts["moat.submitFeedback"],
	execute: submitFeedback,
};
