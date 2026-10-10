export const COMMUNITY_TIP_ATTRIBUTIONS = ["PUBLIC", "ANONYMOUS"] as const;
export type CommunityTipAttribution =
	(typeof COMMUNITY_TIP_ATTRIBUTIONS)[number];

export const COMMUNITY_TIP_STATUSES = [
	"LLM_REVIEW",
	"PENDING_ADMIN_REVIEW",
	"CHANGES_REQUIRED",
	"APPROVED",
	"REJECTED",
	"ARCHIVED",
	"EXPIRED",
] as const;
export type CommunityTipStatus = (typeof COMMUNITY_TIP_STATUSES)[number];

export const COMMUNITY_TIP_LLM_DECISIONS = [
	"PASS_TO_ADMIN",
	"CHANGES_REQUIRED",
	"REJECT",
] as const;
export type CommunityTipLlmDecision =
	(typeof COMMUNITY_TIP_LLM_DECISIONS)[number];

export const COMMUNITY_TIP_FEED_SORTS = [
	"recommended",
	"newest",
	"most_liked",
] as const;
export type CommunityTipFeedSort = (typeof COMMUNITY_TIP_FEED_SORTS)[number];

export type CommunityTipPublicAuthor = {
	displayName: string;
	imageUrl: string | null;
} | null;

export type CommunityTipRecommendationMetadata = {
	keywords: string[];
	normalizedKeywords: string[];
	merchantNames: string[];
	normalizedMerchantNames: string[];
	transactionCategories: string[];
	tags: string[];
	tipType: string | null;
	potentialBenefit: string | null;
	estimatedSavingsPercent: number | null;
	estimatedSavingsAmount: number | null;
	countryCodes: string[];
	requirements: string[];
	externalUrl: string | null;
	personallyTested: boolean;
};

export type CommunityTipLlmReviewResult = {
	decision: CommunityTipLlmDecision;
	summary: string;
	reasons: string[];
	riskScore: number;
	containsSolicitation: boolean;
	containsReferralCode: boolean;
	containsSelfPromotion: boolean;
	containsUnsafeAdvice: boolean;
	containsIllegalAdvice: boolean;
	containsFinancialMisinformation: boolean;
	containsGuaranteedClaims: boolean;
	containsSensitiveInformation: boolean;
	suspiciousExternalLink: boolean;
	suggestedTitle?: string;
	suggestedKeywords: string[];
	suggestedMerchants: string[];
	suggestedCategories: string[];
	suggestedTags: string[];
	suggestedTipType?: string;
	suggestedPotentialBenefit?: string;
};

export type CommunityTipPublicSummary = {
	id: string;
	title: string;
	bodyPreview: string;
	attribution: CommunityTipAttribution;
	author: CommunityTipPublicAuthor;
	tags: string[];
	keywords: string[];
	tipType: string | null;
	potentialBenefit: string | null;
	likeCount: number;
	likedByCurrentUser: boolean;
	ownedByCurrentUser: boolean;
	publishedAt: string | null;
	personallyTested: boolean;
};

export type CommunityTipPublicDetail = CommunityTipPublicSummary & {
	body: string;
	merchantNames: string[];
	transactionCategories: string[];
	estimatedSavingsPercent: number | null;
	estimatedSavingsAmount: number | null;
	countryCodes: string[];
	requirements: string[];
	externalUrl: string | null;
	expiresAt: string | null;
};

export type CommunityTipOwnerDetail = CommunityTipPublicDetail & {
	status: CommunityTipStatus;
	moderationReason: string | null;
	createdAt: string;
	updatedAt: string;
	expiresAt: string | null;
	metadata: CommunityTipRecommendationMetadata;
};

export type CommunityTipAdminDetail = CommunityTipOwnerDetail & {
	authorUserId: string;
	authorDisplayName: string;
	authorEmail: string | null;
	llmReview: CommunityTipLlmReviewResult | null;
	moderationMetadata: Record<string, unknown> | null;
};

export type CommunityTipFeedResponse = {
	items: CommunityTipPublicSummary[];
	nextCursor: string | null;
};

export type CommunityTipMatchInput = {
	merchantName?: string;
	description?: string;
	originalDescription?: string;
	category?: string;
	countryCode?: string;
};

export type CommunityTipMatchCandidate = {
	tipId: string;
	title: string;
	body: string;
	normalizedKeywords: string[];
	normalizedMerchantNames: string[];
	transactionCategories: string[];
	countryCodes: string[];
	likeCount: number;
	estimatedSavingsPercent: number | null;
	expiresAt: Date | null;
	status: CommunityTipStatus;
};

export type CommunityTipMatchResult = {
	tipId: string;
	keywordMatchScore: number;
	merchantMatchScore: number;
	categoryMatchScore: number;
	likeScore: number;
	totalScore: number;
	matchedKeywords: string[];
};

export type CommunityTipTransactionRecommendation =
	CommunityTipPublicSummary & {
		matchedKeywords: string[];
		totalScore: number;
		potentialBenefitAmount: number | null;
	};
