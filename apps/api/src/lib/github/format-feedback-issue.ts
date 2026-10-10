import type { FeedbackSource, FeedbackType } from "../../../generated/prisma";

const typeLabelByFeedbackType = {
	BUG: "bug",
	FEATURE_REQUEST: "enhancement",
	GENERAL: "user-feedback",
	UX_FEEDBACK: "user-feedback",
	MCP_TOOL_ISSUE: "bug",
	INCORRECT_RESULT: "bug",
	OTHER: "user-feedback",
} as const satisfies Record<FeedbackType, string>;

export type FeedbackIssueInput = {
	feedbackId: string;
	type: FeedbackType;
	source: FeedbackSource;
	message: string;
	userId?: string;
	userEmail?: string;
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
	screenshotUrl?: string;
	metadata?: Record<string, unknown>;
};

export function buildFeedbackIssueTitle(message: string): string {
	const firstLine = message.split("\n")[0]?.trim() ?? "";
	const title = firstLine.length > 0 ? firstLine : "User feedback";
	return title.length > 80 ? `${title.slice(0, 77)}...` : title;
}

export function buildFeedbackIssueBody(input: FeedbackIssueInput): string {
	const metadataJson =
		input.metadata && Object.keys(input.metadata).length > 0
			? JSON.stringify(input.metadata, null, 2)
			: null;

	const screenshotLine = input.screenshotUrl
		? `- Screenshot: ${input.screenshotUrl}`
		: null;

	return [
		"## Feedback",
		input.message,
		"",
		"## Submission details",
		`- Feedback ID: ${input.feedbackId}`,
		`- Type: ${input.type}`,
		`- Source: ${input.source}`,
		`- User ID: ${input.userId ?? "Unknown"}`,
		`- User email: ${input.userEmail ?? "Not provided"}`,
		`- Platform: ${input.platform ?? "Unknown"}`,
		`- App version: ${input.appVersion ?? "Unknown"}`,
		`- Route: ${input.route ?? "Unknown"}`,
		input.userAgent ? `- User agent: ${input.userAgent}` : null,
		screenshotLine,
		`- Submitted: ${new Date().toISOString()}`,
		metadataJson ? "" : null,
		metadataJson ? "## Metadata" : null,
		metadataJson,
	]
		.filter((line) => line !== null)
		.join("\n");
}

export function buildFeedbackIssueLabels(
	type: FeedbackType,
	baseLabels: string[],
): string[] {
	const typeLabel = typeLabelByFeedbackType[type];
	return [...new Set([...baseLabels, typeLabel])];
}
