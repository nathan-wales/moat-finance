import type { CommunityTipStatus } from "@moat/community-tips";

export const COMMUNITY_TIPS_QUERY_KEYS = {
	feed: (sort?: string, query?: string) =>
		["communityTipsFeed", sort, query] as const,
	mine: ["communityTipsMine"] as const,
	tip: (tipId: string) => ["communityTip", tipId] as const,
	moderation: (filter?: string) => ["communityTipsModeration", filter] as const,
	settings: ["communityTipsSettings"] as const,
	forTransaction: (transactionId: string) =>
		["communityTipsForTransaction", transactionId] as const,
};

export const STATUS_LABELS: Record<CommunityTipStatus, string> = {
	LLM_REVIEW: "Reviewing",
	PENDING_ADMIN_REVIEW: "Pending review",
	CHANGES_REQUIRED: "Changes required",
	APPROVED: "Approved",
	REJECTED: "Rejected",
	ARCHIVED: "Archived",
	EXPIRED: "Expired",
};

export const STATUS_BADGE_VARIANT: Record<
	CommunityTipStatus,
	"default" | "secondary" | "destructive" | "outline"
> = {
	LLM_REVIEW: "secondary",
	PENDING_ADMIN_REVIEW: "secondary",
	CHANGES_REQUIRED: "outline",
	APPROVED: "default",
	REJECTED: "destructive",
	ARCHIVED: "outline",
	EXPIRED: "outline",
};

export function splitList(value: string): string[] {
	return value
		.split(",")
		.map((v) => v.trim())
		.filter(Boolean);
}
