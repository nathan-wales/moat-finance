export type FeedbackType =
	| "GENERAL"
	| "BUG"
	| "FEATURE_REQUEST"
	| "UX_FEEDBACK"
	| "MCP_TOOL_ISSUE"
	| "INCORRECT_RESULT"
	| "OTHER";

export type FeedbackSource = "WEB_APP" | "DESKTOP_APP" | "MCP";

export type FeedbackStatus =
	| "NEW"
	| "REVIEWED"
	| "PLANNED"
	| "IN_PROGRESS"
	| "RESOLVED"
	| "CLOSED";

export type GitHubSyncStatus = "NOT_SYNCED" | "SYNCED" | "FAILED";

export type FeedbackSubmitAdapter = {
	submit: (input: CreateFeedbackInput) => Promise<CreateFeedbackResponse>;
};

export type FeedbackContext = {
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
};

export type CreateFeedbackInput = {
	type?: FeedbackType;
	source: FeedbackSource;
	message: string;
	route?: string;
	appVersion?: string;
	platform?: string;
	userAgent?: string;
	metadata?: Record<string, unknown>;
};

export type CreateFeedbackResponse = {
	feedbackId: string;
	status: "created";
};

export type UseSubmitFeedbackOptions = {
	source: FeedbackSource;
	submitAdapter: FeedbackSubmitAdapter;
	getContext?: () => FeedbackContext;
};
