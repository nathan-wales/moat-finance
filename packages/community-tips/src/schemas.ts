import { z } from "zod";
import {
	COMMUNITY_TIP_BODY_MAX,
	COMMUNITY_TIP_BODY_MIN,
	COMMUNITY_TIP_CATEGORIES_MAX,
	COMMUNITY_TIP_COUNTRIES_MAX,
	COMMUNITY_TIP_KEYWORD_MAX_LENGTH,
	COMMUNITY_TIP_KEYWORDS_MAX,
	COMMUNITY_TIP_MERCHANT_MAX_LENGTH,
	COMMUNITY_TIP_MERCHANTS_MAX,
	COMMUNITY_TIP_REQUIREMENTS_MAX,
	COMMUNITY_TIP_TAG_MAX_LENGTH,
	COMMUNITY_TIP_TAGS_MAX,
	COMMUNITY_TIP_TITLE_MAX,
	COMMUNITY_TIP_TITLE_MIN,
} from "./constants";
import {
	COMMUNITY_TIP_ATTRIBUTIONS,
	COMMUNITY_TIP_FEED_SORTS,
	COMMUNITY_TIP_LLM_DECISIONS,
	COMMUNITY_TIP_STATUSES,
} from "./types";

export const communityTipAttributionSchema = z.enum(COMMUNITY_TIP_ATTRIBUTIONS);
export const communityTipStatusSchema = z.enum(COMMUNITY_TIP_STATUSES);
export const communityTipLlmDecisionSchema = z.enum(
	COMMUNITY_TIP_LLM_DECISIONS,
);
export const communityTipFeedSortSchema = z.enum(COMMUNITY_TIP_FEED_SORTS);

const trimmedString = (min: number, max: number) =>
	z.string().trim().min(min).max(max);

const stringList = (maxItems: number, maxLength: number) =>
	z
		.array(z.string().trim().min(1).max(maxLength))
		.max(maxItems)
		.optional()
		.default([]);

const httpUrlSchema = z
	.string()
	.trim()
	.url()
	.refine((value) => {
		try {
			const parsed = new URL(value);
			return parsed.protocol === "http:" || parsed.protocol === "https:";
		} catch {
			return false;
		}
	}, "URL must use http or https")
	.optional()
	.nullable();

const optionalStringList = (maxItems: number, maxLength: number) =>
	z.array(z.string().trim().min(1).max(maxLength)).max(maxItems).optional();

export const communityTipMetadataInputSchema = z.object({
	keywords: stringList(
		COMMUNITY_TIP_KEYWORDS_MAX,
		COMMUNITY_TIP_KEYWORD_MAX_LENGTH,
	),
	merchantNames: stringList(
		COMMUNITY_TIP_MERCHANTS_MAX,
		COMMUNITY_TIP_MERCHANT_MAX_LENGTH,
	),
	transactionCategories: stringList(COMMUNITY_TIP_CATEGORIES_MAX, 64),
	tags: stringList(COMMUNITY_TIP_TAGS_MAX, COMMUNITY_TIP_TAG_MAX_LENGTH),
	tipType: z.string().trim().max(64).optional().nullable(),
	potentialBenefit: z.string().trim().max(240).optional().nullable(),
	estimatedSavingsPercent: z.number().min(0).max(100).optional().nullable(),
	estimatedSavingsAmount: z.number().min(0).optional().nullable(),
	countryCodes: z
		.array(
			z
				.string()
				.trim()
				.length(2)
				.transform((v) => v.toUpperCase()),
		)
		.max(COMMUNITY_TIP_COUNTRIES_MAX)
		.optional()
		.default([]),
	requirements: stringList(COMMUNITY_TIP_REQUIREMENTS_MAX, 160),
	externalUrl: httpUrlSchema,
	personallyTested: z.boolean().optional().default(false),
	expiresAt: z
		.string()
		.datetime()
		.optional()
		.nullable()
		.refine(
			(value) => value == null || new Date(value).getTime() > Date.now(),
			"Expiration date must be in the future",
		),
});

/** Partial metadata for updates — omitted fields are left unchanged. */
export const communityTipMetadataPatchSchema = z.object({
	keywords: optionalStringList(
		COMMUNITY_TIP_KEYWORDS_MAX,
		COMMUNITY_TIP_KEYWORD_MAX_LENGTH,
	),
	merchantNames: optionalStringList(
		COMMUNITY_TIP_MERCHANTS_MAX,
		COMMUNITY_TIP_MERCHANT_MAX_LENGTH,
	),
	transactionCategories: optionalStringList(COMMUNITY_TIP_CATEGORIES_MAX, 64),
	tags: optionalStringList(COMMUNITY_TIP_TAGS_MAX, COMMUNITY_TIP_TAG_MAX_LENGTH),
	tipType: z.string().trim().max(64).optional().nullable(),
	potentialBenefit: z.string().trim().max(240).optional().nullable(),
	estimatedSavingsPercent: z.number().min(0).max(100).optional().nullable(),
	estimatedSavingsAmount: z.number().min(0).optional().nullable(),
	countryCodes: z
		.array(
			z
				.string()
				.trim()
				.length(2)
				.transform((v) => v.toUpperCase()),
		)
		.max(COMMUNITY_TIP_COUNTRIES_MAX)
		.optional(),
	requirements: optionalStringList(COMMUNITY_TIP_REQUIREMENTS_MAX, 160),
	externalUrl: httpUrlSchema,
	personallyTested: z.boolean().optional(),
	expiresAt: z.string().datetime().optional().nullable(),
});

export const createCommunityTipInputSchema = z.object({
	title: trimmedString(COMMUNITY_TIP_TITLE_MIN, COMMUNITY_TIP_TITLE_MAX),
	body: trimmedString(COMMUNITY_TIP_BODY_MIN, COMMUNITY_TIP_BODY_MAX),
	attribution: communityTipAttributionSchema,
	metadata: communityTipMetadataInputSchema.optional(),
});

export const updateCommunityTipInputSchema = z.object({
	tipId: z.string().min(1),
	title: trimmedString(
		COMMUNITY_TIP_TITLE_MIN,
		COMMUNITY_TIP_TITLE_MAX,
	).optional(),
	body: trimmedString(
		COMMUNITY_TIP_BODY_MIN,
		COMMUNITY_TIP_BODY_MAX,
	).optional(),
	attribution: communityTipAttributionSchema.optional(),
	metadata: communityTipMetadataPatchSchema.optional(),
});

export const communityTipSettingsInputSchema = z.object({
	showCommunityTipsOnTransactions: z.boolean(),
});

export const communityTipIdInputSchema = z.object({
	tipId: z.string().min(1),
});

export const listCommunityTipsInputSchema = z.object({
	query: z.string().trim().max(240).optional(),
	sort: communityTipFeedSortSchema.optional().default("recommended"),
	category: z.string().trim().max(64).optional(),
	tipType: z.string().trim().max(64).optional(),
	personallyTested: z.boolean().optional(),
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const listForTransactionInputSchema = z.object({
	transactionId: z.string().min(1),
	limit: z.coerce.number().int().min(1).max(3).optional().default(1),
});

export const adminModerationFilterSchema = z.object({
	filter: z
		.enum([
			"LLM_REVIEW",
			"PENDING_ADMIN_REVIEW",
			"CHANGES_REQUIRED",
			"APPROVED",
			"REJECTED",
			"ARCHIVED",
			"EXPIRED",
			"ALL",
		])
		.optional()
		.default("PENDING_ADMIN_REVIEW"),
	cursor: z.string().optional(),
	limit: z.coerce.number().int().min(1).max(50).optional().default(20),
});

export const adminDecisionInputSchema = z.object({
	tipId: z.string().min(1),
	reason: z.string().trim().min(1).max(2000).optional(),
});

export const adminRequestChangesInputSchema = z.object({
	tipId: z.string().min(1),
	reason: z.string().trim().min(1).max(2000),
});

export const adminUpdateMetadataInputSchema = z.object({
	tipId: z.string().min(1),
	metadata: communityTipMetadataInputSchema,
});

export const communityTipLlmReviewResultSchema = z.object({
	decision: communityTipLlmDecisionSchema,
	summary: z.string(),
	reasons: z.array(z.string()),
	riskScore: z.number().min(0).max(1),
	containsSolicitation: z.boolean(),
	containsReferralCode: z.boolean(),
	containsSelfPromotion: z.boolean(),
	containsUnsafeAdvice: z.boolean(),
	containsIllegalAdvice: z.boolean(),
	containsFinancialMisinformation: z.boolean(),
	containsGuaranteedClaims: z.boolean(),
	containsSensitiveInformation: z.boolean(),
	suspiciousExternalLink: z.boolean(),
	suggestedTitle: z.string().optional(),
	suggestedKeywords: z.array(z.string()).default([]),
	suggestedMerchants: z.array(z.string()).default([]),
	suggestedCategories: z.array(z.string()).default([]),
	suggestedTags: z.array(z.string()).default([]),
	suggestedTipType: z.string().optional(),
	suggestedPotentialBenefit: z.string().optional(),
});

export type CreateCommunityTipInput = z.infer<
	typeof createCommunityTipInputSchema
>;
export type UpdateCommunityTipInput = z.infer<
	typeof updateCommunityTipInputSchema
>;
export type ListCommunityTipsInput = z.infer<
	typeof listCommunityTipsInputSchema
>;
export type CommunityTipMetadataInput = z.infer<
	typeof communityTipMetadataInputSchema
>;
export type CommunityTipMetadataPatch = z.infer<
	typeof communityTipMetadataPatchSchema
>;
