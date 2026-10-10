import { z } from "zod";

export const PromptVisibilitySchema = z.enum(["PRIVATE", "PUBLIC"]);
export type PromptVisibility = z.infer<typeof PromptVisibilitySchema>;

export const PromptReviewStatusSchema = z.enum([
	"NOT_SUBMITTED",
	"PENDING",
	"CHANGES_REQUESTED",
	"APPROVED",
	"REJECTED",
]);
export type PromptReviewStatus = z.infer<typeof PromptReviewStatusSchema>;

export const PromptModerationActionSchema = z.enum([
	"SUBMITTED",
	"WITHDRAWN",
	"APPROVED",
	"CHANGES_REQUESTED",
	"REJECTED",
	"UNPUBLISHED",
]);
export type PromptModerationAction = z.infer<
	typeof PromptModerationActionSchema
>;

export type PromptCategory = {
	id: string;
	slug: string;
	label: string;
	sortOrder: number;
};

export const PROMPT_CATEGORIES: PromptCategory[] = [
	{ id: "pcat_tax", slug: "tax", label: "Tax", sortOrder: 0 },
	{ id: "pcat_investing", slug: "investing", label: "Investing", sortOrder: 1 },
	{ id: "pcat_budgeting", slug: "budgeting", label: "Budgeting", sortOrder: 2 },
	{ id: "pcat_cash_flow", slug: "cash-flow", label: "Cash Flow", sortOrder: 3 },
	{ id: "pcat_debt", slug: "debt", label: "Debt", sortOrder: 4 },
	{
		id: "pcat_real_estate",
		slug: "real-estate",
		label: "Real Estate",
		sortOrder: 5,
	},
	{ id: "pcat_insurance", slug: "insurance", label: "Insurance", sortOrder: 6 },
	{ id: "pcat_goals", slug: "goals", label: "Goals", sortOrder: 7 },
	{ id: "pcat_net_worth", slug: "net-worth", label: "Net Worth", sortOrder: 8 },
	{ id: "pcat_rules", slug: "rules", label: "Rules", sortOrder: 9 },
	{ id: "pcat_hsa", slug: "hsa", label: "HSA", sortOrder: 10 },
];

export type UserPromptSummary = {
	id: string;
	title: string;
	description: string | null;
	categorySlug: string | null;
	categoryLabel: string | null;
	tags: string[];
	visibility: PromptVisibility;
	reviewStatus: PromptReviewStatus;
	createdAt: string;
	updatedAt: string;
	publishedAt: string | null;
	hasDraftRevision: boolean;
	launchCount: number;
};

export type CommunityPromptSummary = {
	id: string;
	title: string;
	description: string | null;
	categorySlug: string | null;
	categoryLabel: string | null;
	tags: string[];
	creatorDisplayName: string;
	publishedAt: string;
	updatedAt: string;
	requiredConnections: string[];
	requiredDataScopes: string[];
	launchCount: number;
};

export type PromptRevisionSummary = {
	id: string;
	version: number;
	reviewStatus: PromptReviewStatus;
	submittedAt: string | null;
	reviewedAt: string | null;
};

export type PromptModerationEventSummary = {
	id: string;
	action: PromptModerationAction;
	feedback: string | null;
	reason: string | null;
	actorId: string;
	createdAt: string;
};

export type UserPromptDetail = UserPromptSummary & {
	body: string;
	moderationFeedback: string | null;
	rejectionReason: string | null;
	submittedAt: string | null;
	requiredConnections: string[];
	requiredDataScopes: string[];
	sourcePromptId: string | null;
	sourceCommunityPromptId: string | null;
	draftRevision: PromptRevisionSummary | null;
	moderationHistory: PromptModerationEventSummary[];
};

export type CommunityPromptDetail = CommunityPromptSummary & {
	body: string;
	requiredConnections: string[];
	requiredDataScopes: string[];
};

export type ModerationQueueItem = {
	promptId: string;
	revisionId: string;
	version: number;
	title: string;
	description: string | null;
	body: string;
	categorySlug: string | null;
	categoryLabel: string | null;
	tags: string[];
	reviewStatus: PromptReviewStatus;
	creatorId: string;
	creatorDisplayName: string;
	submittedAt: string;
	requiredConnections: string[];
	requiredDataScopes: string[];
	safetyFlags: string[];
	priorHistory: PromptModerationEventSummary[];
};

export type GeneratePromptDraftInput = {
	goal: string;
	financialData?: string;
	responseInclude?: string;
	workflowType?: string;
	allowActions?: boolean;
	additionalConstraints?: string;
};

export type GeneratePromptDraftResult = {
	title: string;
	description: string;
	body: string;
	suggestedCategorySlug: string;
	suggestedTags: string[];
	requiredConnections: string[];
	requiredDataScopes: string[];
};

export type CreateUserPromptInput = {
	title: string;
	description?: string | null;
	body: string;
	categorySlug: string | null;
	tags?: string[];
	requiredConnections?: string[];
	requiredDataScopes?: string[];
	submitForReview?: boolean;
};

export type UpdateUserPromptInput = {
	promptId: string;
	title?: string;
	description?: string | null;
	body?: string;
	categorySlug?: string | null;
	tags?: string[];
	requiredConnections?: string[];
	requiredDataScopes?: string[];
	confirmWithdrawFromReview?: boolean;
};

export type LocalUserPromptSummary = {
	id: string;
	title: string;
	description: string | null;
	categorySlug: string | null;
	tags: string[];
	createdAt: string;
	updatedAt: string;
};

export type LocalUserPromptDetail = LocalUserPromptSummary & {
	body: string;
};

export type CreateLocalUserPromptInput = {
	title: string;
	description?: string | null;
	body: string;
	categorySlug: string | null;
	tags?: string[];
};

export type UpdateLocalUserPromptInput = {
	promptId: string;
	title?: string;
	description?: string | null;
	body?: string;
	categorySlug?: string | null;
	tags?: string[];
};

export const PromptLibrarySourceSchema = z.enum([
	"CURATED",
	"MINE",
	"COMMUNITY",
]);
export type PromptLibrarySource = z.infer<typeof PromptLibrarySourceSchema>;

export type PromptPinSummary = {
	source: PromptLibrarySource;
	promptId: string;
	pinnedAt: string;
};

export type TogglePromptPinInput = {
	source: PromptLibrarySource;
	promptId: string;
};

export type TogglePromptPinResult = {
	pinned: boolean;
};

export type PromptLaunchCountSummary = {
	source: PromptLibrarySource;
	promptId: string;
	launchCount: number;
};

export type RecordPromptLaunchInput = {
	source: PromptLibrarySource;
	promptId: string;
};

export type RecordPromptLaunchResult = {
	launchCount: number;
	counted: boolean;
};

export const PROMPT_CHANNELS = {
	LIST_MINE: "prompts:listMine",
	GET: "prompts:get",
	CREATE: "prompts:create",
	UPDATE: "prompts:update",
	DELETE: "prompts:delete",
	GENERATE_DRAFT: "prompts:generateDraft",
	LIST_PINS: "prompts:listPins",
	TOGGLE_PIN: "prompts:togglePin",
	LIST_LAUNCH_COUNTS: "prompts:listLaunchCounts",
	RECORD_LAUNCH: "prompts:recordLaunch",
} as const;

export const CreateUserPromptInputSchema = z.object({
	title: z.string().min(1).max(120),
	description: z.string().max(500).optional().nullable(),
	body: z.string().min(1).max(10_000),
	categorySlug: z.string().min(1).nullable(),
	tags: z.array(z.string().max(32)).max(10).optional(),
	requiredConnections: z.array(z.string()).optional(),
	requiredDataScopes: z.array(z.string()).optional(),
	submitForReview: z.boolean().optional(),
});

export const UpdateUserPromptInputSchema = z.object({
	promptId: z.string().min(1),
	title: z.string().min(1).max(120).optional(),
	description: z.string().max(500).optional().nullable(),
	body: z.string().min(1).max(10_000).optional(),
	categorySlug: z.string().min(1).nullable().optional(),
	tags: z.array(z.string().max(32)).max(10).optional(),
	requiredConnections: z.array(z.string()).optional(),
	requiredDataScopes: z.array(z.string()).optional(),
	confirmWithdrawFromReview: z.boolean().optional(),
});

export const PromptIdInputSchema = z.object({
	promptId: z.string().min(1),
});

export const GeneratePromptDraftInputSchema = z.object({
	goal: z.string().min(1).max(500),
	financialData: z.string().max(500).optional(),
	responseInclude: z.string().max(500).optional(),
	workflowType: z.string().max(200).optional(),
	allowActions: z.boolean().optional(),
	additionalConstraints: z.string().max(500).optional(),
});

export const ListPromptPinsInputSchema = z.object({
	source: PromptLibrarySourceSchema.optional(),
});

export const TogglePromptPinInputSchema = z.object({
	source: PromptLibrarySourceSchema,
	promptId: z.string().min(1),
});

export const ListPromptLaunchCountsInputSchema = z.object({
	source: PromptLibrarySourceSchema.optional(),
});

export const RecordPromptLaunchInputSchema = z.object({
	source: PromptLibrarySourceSchema,
	promptId: z.string().min(1),
});
