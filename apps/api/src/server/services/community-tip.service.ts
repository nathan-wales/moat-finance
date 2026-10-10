import { createHash } from "node:crypto";
import {
	adminAuthorDisplayName,
	COMMUNITY_TIP_SUBMISSION_WINDOW_MS,
	type CommunityTipAdminDetail,
	type CommunityTipFeedResponse,
	type CommunityTipLlmReviewResult,
	type CommunityTipMetadataPatch,
	type CommunityTipOwnerDetail,
	type CommunityTipPublicDetail,
	type CommunityTipPublicSummary,
	type CommunityTipRecommendationMetadata,
	type CommunityTipStatus,
	type CommunityTipTransactionRecommendation,
	type CreateCommunityTipInput,
	communityTipLlmReviewResultSchema,
	communityTipMatchesSearchQuery,
	compareFeedItems,
	computeFeedScore,
	estimatePotentialBenefitAmount,
	getCommunityTipSubmissionLimitPer24h,
	heuristicCommunityTipReview,
	type ListCommunityTipsInput,
	normalizeKeywordList,
	previewBody,
	publicAuthorFromAttribution,
	rankCommunityTipMatches,
	type UpdateCommunityTipInput,
} from "@moat/community-tips";
import { sendCommunityTipModerationEmail } from "~/lib/email/send-community-tip-moderation-email";
import { logger } from "~/lib/logger";
import type { Prisma as PrismaTypes } from "../../../generated/prisma";
import { Prisma } from "../../../generated/prisma";
import { createApiError } from "../api-context";
import { db } from "../db";
import { runAsElevatedServiceActor } from "../db-actor";
import { reviewCommunityTipWithLlm } from "./community-tip-llm.service";

class CommunityTipError extends Error {
	status: number;
	code?: string;
	retryAfterSeconds?: number;

	constructor(
		message: string,
		status = 400,
		options?: { code?: string; retryAfterSeconds?: number },
	) {
		super(message);
		this.status = status;
		this.code = options?.code;
		this.retryAfterSeconds = options?.retryAfterSeconds;
	}
}

function toApiError(error: CommunityTipError): never {
	const err = createApiError(error.message, error.status) as Error & {
		code?: string;
		retryAfterSeconds?: number;
	};
	if (error.code) err.code = error.code;
	if (error.retryAfterSeconds !== undefined) {
		err.retryAfterSeconds = error.retryAfterSeconds;
	}
	throw err;
}

function throwTipError(
	message: string,
	status = 400,
	options?: { code?: string; retryAfterSeconds?: number },
): never {
	toApiError(new CommunityTipError(message, status, options));
}

function decimalToNumber(
	value: PrismaTypes.Decimal | number | null | undefined,
): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return value;
	return Number(value.toString());
}

function toIso(date: Date | null | undefined): string | null {
	return date ? date.toISOString() : null;
}

function metadataFromTip(tip: {
	keywords: string[];
	normalizedKeywords: string[];
	merchantNames: string[];
	normalizedMerchantNames: string[];
	transactionCategories: string[];
	tags: string[];
	tipType: string | null;
	potentialBenefit: string | null;
	estimatedSavingsPercent: PrismaTypes.Decimal | number | null;
	estimatedSavingsAmount: PrismaTypes.Decimal | number | null;
	countryCodes: string[];
	requirements: string[];
	externalUrl: string | null;
	personallyTested: boolean;
}): CommunityTipRecommendationMetadata {
	return {
		keywords: tip.keywords,
		normalizedKeywords: tip.normalizedKeywords,
		merchantNames: tip.merchantNames,
		normalizedMerchantNames: tip.normalizedMerchantNames,
		transactionCategories: tip.transactionCategories,
		tags: tip.tags,
		tipType: tip.tipType,
		potentialBenefit: tip.potentialBenefit,
		estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
		estimatedSavingsAmount: decimalToNumber(tip.estimatedSavingsAmount),
		countryCodes: tip.countryCodes,
		requirements: tip.requirements,
		externalUrl: tip.externalUrl,
		personallyTested: tip.personallyTested,
	};
}

function buildSubmissionFingerprint(
	userId: string,
	title: string,
	body: string,
): string {
	return createHash("sha256")
		.update(
			`${userId}:${title.trim().toLowerCase()}:${body.trim().toLowerCase()}`,
		)
		.digest("hex");
}

function metadataCreateData(metadata?: CreateCommunityTipInput["metadata"]) {
	const keywords = normalizeKeywordList(metadata?.keywords ?? []);
	const merchantNames = metadata?.merchantNames ?? [];
	return {
		keywords: metadata?.keywords ?? [],
		normalizedKeywords: keywords,
		merchantNames,
		normalizedMerchantNames: normalizeKeywordList(merchantNames),
		transactionCategories: metadata?.transactionCategories ?? [],
		tags: metadata?.tags ?? [],
		tipType: metadata?.tipType ?? null,
		potentialBenefit: metadata?.potentialBenefit ?? null,
		estimatedSavingsPercent: metadata?.estimatedSavingsPercent ?? null,
		estimatedSavingsAmount: metadata?.estimatedSavingsAmount ?? null,
		countryCodes: metadata?.countryCodes ?? [],
		requirements: metadata?.requirements ?? [],
		externalUrl: metadata?.externalUrl ?? null,
		personallyTested: metadata?.personallyTested ?? false,
		expiresAt: metadata?.expiresAt ? new Date(metadata.expiresAt) : null,
	};
}

type TipAuthorFields = {
	name: string | null;
	username: string | null;
	image: string | null;
	email: string | null;
};

const MISSING_AUTHOR: TipAuthorFields = {
	name: null,
	username: null,
	image: null,
	email: null,
};

type TipWithAuthor = PrismaTypes.CommunityTipGetPayload<object> & {
	author: TipAuthorFields;
};

async function loadAuthorsByIds(
	userIds: string[],
): Promise<Map<string, TipAuthorFields>> {
	const uniqueIds = [...new Set(userIds)];
	if (uniqueIds.length === 0) return new Map();

	const users = await runAsElevatedServiceActor(() =>
		db.user.findMany({
			where: { id: { in: uniqueIds } },
			select: {
				id: true,
				name: true,
				username: true,
				image: true,
				email: true,
			},
		}),
	);

	return new Map(
		users.map((user) => [
			user.id,
			{
				name: user.name,
				username: user.username,
				image: user.image,
				email: user.email,
			},
		]),
	);
}

async function attachAuthors<T extends { authorUserId: string }>(
	tips: T[],
): Promise<Array<T & { author: TipAuthorFields }>> {
	const authors = await loadAuthorsByIds(tips.map((tip) => tip.authorUserId));
	return tips.map((tip) => ({
		...tip,
		author: authors.get(tip.authorUserId) ?? MISSING_AUTHOR,
	}));
}

async function attachAuthor<T extends { authorUserId: string }>(
	tip: T,
): Promise<T & { author: TipAuthorFields }>;
async function attachAuthor<T extends { authorUserId: string }>(
	tip: T | null,
): Promise<(T & { author: TipAuthorFields }) | null>;
async function attachAuthor<T extends { authorUserId: string }>(
	tip: T | null,
): Promise<(T & { author: TipAuthorFields }) | null> {
	if (!tip) return null;
	const [withAuthor] = await attachAuthors([tip]);
	return withAuthor ?? null;
}

function toPublicSummary(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
): CommunityTipPublicSummary {
	return {
		id: tip.id,
		title: tip.title,
		bodyPreview: previewBody(tip.body),
		attribution: tip.attribution,
		author: publicAuthorFromAttribution({
			attribution: tip.attribution,
			name: tip.author.name,
			username: tip.author.username,
			image: tip.author.image,
		}),
		tags: tip.tags.slice(0, 3),
		keywords: tip.keywords.slice(0, 3),
		tipType: tip.tipType,
		potentialBenefit: tip.potentialBenefit,
		likeCount: tip.likeCount,
		likedByCurrentUser,
		ownedByCurrentUser: tip.authorUserId === currentUserId,
		publishedAt: toIso(tip.publishedAt),
		personallyTested: tip.personallyTested,
	};
}

function toPublicDetail(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
): CommunityTipPublicDetail {
	return {
		...toPublicSummary(tip, likedByCurrentUser, currentUserId),
		body: tip.body,
		merchantNames: tip.merchantNames,
		transactionCategories: tip.transactionCategories,
		estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
		estimatedSavingsAmount: decimalToNumber(tip.estimatedSavingsAmount),
		countryCodes: tip.countryCodes,
		requirements: tip.requirements,
		externalUrl: tip.externalUrl,
		expiresAt: toIso(tip.expiresAt),
		tags: tip.tags,
		keywords: tip.keywords,
	};
}

function parseStoredLlmReview(
	value: PrismaTypes.JsonValue | null,
): CommunityTipLlmReviewResult | null {
	if (!value || typeof value !== "object" || Array.isArray(value)) return null;
	const parsed = communityTipLlmReviewResultSchema.safeParse(value);
	return parsed.success ? parsed.data : null;
}

function toOwnerDetail(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
): CommunityTipOwnerDetail {
	const publicDetail = toPublicDetail(tip, likedByCurrentUser, currentUserId);
	return {
		...publicDetail,
		author:
			tip.attribution === "ANONYMOUS"
				? publicAuthorFromAttribution({
						attribution: "PUBLIC",
						name: tip.author.name,
						username: tip.author.username,
						image: tip.author.image,
					})
				: publicDetail.author,
		status: tip.status,
		moderationReason: tip.moderationReason,
		createdAt: tip.createdAt.toISOString(),
		updatedAt: tip.updatedAt.toISOString(),
		expiresAt: toIso(tip.expiresAt),
		metadata: metadataFromTip(tip),
	};
}

function toAdminDetail(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
): CommunityTipAdminDetail {
	return {
		...toOwnerDetail(tip, likedByCurrentUser, currentUserId),
		authorUserId: tip.authorUserId,
		authorDisplayName: adminAuthorDisplayName({
			name: tip.author.name,
			username: tip.author.username,
			email: tip.author.email,
		}),
		authorEmail: tip.author.email,
		llmReview: parseStoredLlmReview(tip.llmReview),
		moderationMetadata:
			tip.moderationMetadata &&
			typeof tip.moderationMetadata === "object" &&
			!Array.isArray(tip.moderationMetadata)
				? (tip.moderationMetadata as Record<string, unknown>)
				: null,
	};
}

async function likedTipIdsForUser(
	userId: string,
	tipIds: string[],
): Promise<Set<string>> {
	if (tipIds.length === 0) return new Set();
	const likes = await db.communityTipLike.findMany({
		where: { userId, tipId: { in: tipIds } },
		select: { tipId: true },
	});
	return new Set(likes.map((like) => like.tipId));
}

async function assertSubmissionRateLimit(userId: string): Promise<void> {
	const limit = getCommunityTipSubmissionLimitPer24h(
		process.env.COMMUNITY_TIP_SUBMISSION_LIMIT_PER_24H,
	);
	const windowStart = new Date(Date.now() - COMMUNITY_TIP_SUBMISSION_WINDOW_MS);
	const recentCount = await db.communityTip.count({
		where: {
			authorUserId: userId,
			createdAt: { gte: windowStart },
		},
	});
	if (recentCount < limit) return;

	const oldestInWindow = await db.communityTip.findFirst({
		where: {
			authorUserId: userId,
			createdAt: { gte: windowStart },
		},
		orderBy: { createdAt: "asc" },
		select: { createdAt: true },
	});
	const nextEligibleAt = oldestInWindow
		? new Date(
				oldestInWindow.createdAt.getTime() + COMMUNITY_TIP_SUBMISSION_WINDOW_MS,
			)
		: new Date(Date.now() + COMMUNITY_TIP_SUBMISSION_WINDOW_MS);
	const retryAfterSeconds = Math.max(
		60,
		Math.ceil((nextEligibleAt.getTime() - Date.now()) / 1000),
	);
	throwTipError(
		`You can submit up to ${limit} Community Tips per 24 hours. Try again after ${nextEligibleAt.toISOString()}.`,
		429,
		{
			code: "COMMUNITY_TIP_RATE_LIMIT",
			retryAfterSeconds,
		},
	);
}

function applyLlmResultToTipData(
	review: CommunityTipLlmReviewResult,
	existing: ReturnType<typeof metadataCreateData>,
): PrismaTypes.CommunityTipUpdateInput {
	const parsedReview = communityTipLlmReviewResultSchema.parse(review);
	const normalizedKeywords = normalizeKeywordList([
		...existing.keywords,
		...parsedReview.suggestedKeywords,
	]);
	const normalizedMerchants = normalizeKeywordList([
		...existing.merchantNames,
		...parsedReview.suggestedMerchants,
	]);
	const normalizedTags = normalizeKeywordList(
		[...existing.tags, ...parsedReview.suggestedTags],
		10,
	);
	const normalizedCategories = normalizeKeywordList([
		...existing.transactionCategories,
		...parsedReview.suggestedCategories,
	]);

	let status: CommunityTipStatus = "PENDING_ADMIN_REVIEW";
	let moderationReason: string | null = null;
	if (parsedReview.decision === "CHANGES_REQUIRED") {
		status = "CHANGES_REQUIRED";
		moderationReason = parsedReview.summary;
	} else if (parsedReview.decision === "REJECT") {
		status = "REJECTED";
		moderationReason = parsedReview.summary;
	}

	return {
		status,
		moderationReason,
		llmReview: parsedReview,
		llmReviewCompletedAt: new Date(),
		keywords: existing.keywords,
		normalizedKeywords,
		merchantNames: existing.merchantNames,
		normalizedMerchantNames: normalizedMerchants,
		tags: existing.tags.length ? existing.tags : normalizedTags,
		transactionCategories: existing.transactionCategories.length
			? existing.transactionCategories
			: normalizedCategories,
		tipType: existing.tipType ?? parsedReview.suggestedTipType ?? null,
		potentialBenefit:
			existing.potentialBenefit ??
			parsedReview.suggestedPotentialBenefit ??
			null,
	};
}

function metadataPatchData(
	existing: TipWithAuthor,
	patch: CommunityTipMetadataPatch,
): ReturnType<typeof metadataCreateData> {
	const keywords = patch.keywords ?? existing.keywords;
	const merchantNames = patch.merchantNames ?? existing.merchantNames;
	const transactionCategories =
		patch.transactionCategories ?? existing.transactionCategories;
	const tags = patch.tags ?? existing.tags;
	const countryCodes = patch.countryCodes ?? existing.countryCodes;
	const requirements = patch.requirements ?? existing.requirements;

	return {
		keywords,
		normalizedKeywords: normalizeKeywordList(keywords),
		merchantNames,
		normalizedMerchantNames: normalizeKeywordList(merchantNames),
		transactionCategories,
		tags,
		tipType: patch.tipType !== undefined ? patch.tipType : existing.tipType,
		potentialBenefit:
			patch.potentialBenefit !== undefined
				? patch.potentialBenefit
				: existing.potentialBenefit,
		estimatedSavingsPercent:
			patch.estimatedSavingsPercent !== undefined
				? patch.estimatedSavingsPercent
				: decimalToNumber(existing.estimatedSavingsPercent),
		estimatedSavingsAmount:
			patch.estimatedSavingsAmount !== undefined
				? patch.estimatedSavingsAmount
				: decimalToNumber(existing.estimatedSavingsAmount),
		countryCodes,
		requirements,
		externalUrl:
			patch.externalUrl !== undefined
				? patch.externalUrl
				: existing.externalUrl,
		personallyTested:
			patch.personallyTested !== undefined
				? patch.personallyTested
				: existing.personallyTested,
		expiresAt:
			patch.expiresAt !== undefined
				? patch.expiresAt
					? new Date(patch.expiresAt)
					: null
				: existing.expiresAt,
	};
}

function shouldRerunModeration(
	status: CommunityTipStatus,
	contentChanging: boolean,
): boolean {
	if (!contentChanging) return false;
	return (
		status === "APPROVED" ||
		status === "CHANGES_REQUIRED" ||
		status === "REJECTED" ||
		status === "PENDING_ADMIN_REVIEW" ||
		status === "LLM_REVIEW"
	);
}

function notifyAdminIfPendingReview(tip: {
	id: string;
	title: string;
	status: CommunityTipStatus;
}): void {
	if (tip.status !== "PENDING_ADMIN_REVIEW") return;

	sendCommunityTipModerationEmail({
		tipId: tip.id,
		title: tip.title,
		status: tip.status,
	}).catch((err: unknown) => {
		logger.warn("community_tip.moderation_email_failed", {
			tipId: tip.id,
			error: err instanceof Error ? err.message : String(err),
		});
	});
}

export async function runLlmReviewForTip(tipId: string): Promise<void> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) return;
	if (tip.status !== "LLM_REVIEW") return;
	if (tip.llmReviewCompletedAt) return;

	const claimed = await db.communityTip.updateMany({
		where: {
			id: tipId,
			status: "LLM_REVIEW",
			llmReviewCompletedAt: null,
			OR: [
				{ llmReviewStartedAt: null },
				{ llmReviewStartedAt: { lt: new Date(Date.now() - 5 * 60_000) } },
			],
		},
		data: { llmReviewStartedAt: new Date() },
	});
	if (claimed.count === 0) return;

	try {
		const review = await reviewCommunityTipWithLlm({
			title: tip.title,
			body: tip.body,
			externalUrl: tip.externalUrl,
			keywords: tip.keywords,
			merchantNames: tip.merchantNames,
			tags: tip.tags,
			categories: tip.transactionCategories,
			tipType: tip.tipType,
			potentialBenefit: tip.potentialBenefit,
		});
		await db.communityTip.update({
			where: { id: tipId },
			data: applyLlmResultToTipData(review, {
				keywords: tip.keywords,
				normalizedKeywords: tip.normalizedKeywords,
				merchantNames: tip.merchantNames,
				normalizedMerchantNames: tip.normalizedMerchantNames,
				transactionCategories: tip.transactionCategories,
				tags: tip.tags,
				tipType: tip.tipType,
				potentialBenefit: tip.potentialBenefit,
				estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
				estimatedSavingsAmount: decimalToNumber(tip.estimatedSavingsAmount),
				countryCodes: tip.countryCodes,
				requirements: tip.requirements,
				externalUrl: tip.externalUrl,
				personallyTested: tip.personallyTested,
				expiresAt: tip.expiresAt,
			}),
		});
	} catch (error) {
		logger.error(
			"Community tip LLM review failed; applying heuristic fallback",
			{
				feature: "community_tips",
				operation: "llm_review",
				tipId,
				error: error instanceof Error ? error.message : "unknown",
			},
		);
		const fallback = heuristicCommunityTipReview({
			title: tip.title,
			body: tip.body,
			externalUrl: tip.externalUrl,
			keywords: tip.keywords,
			merchantNames: tip.merchantNames,
			tags: tip.tags,
			categories: tip.transactionCategories,
			tipType: tip.tipType,
			potentialBenefit: tip.potentialBenefit,
		});
		const existingMetadata = {
			keywords: tip.keywords,
			normalizedKeywords: tip.normalizedKeywords,
			merchantNames: tip.merchantNames,
			normalizedMerchantNames: tip.normalizedMerchantNames,
			transactionCategories: tip.transactionCategories,
			tags: tip.tags,
			tipType: tip.tipType,
			potentialBenefit: tip.potentialBenefit,
			estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
			estimatedSavingsAmount: decimalToNumber(tip.estimatedSavingsAmount),
			countryCodes: tip.countryCodes,
			requirements: tip.requirements,
			externalUrl: tip.externalUrl,
			personallyTested: tip.personallyTested,
			expiresAt: tip.expiresAt,
		};
		const priorMetadata =
			tip.moderationMetadata &&
			typeof tip.moderationMetadata === "object" &&
			!Array.isArray(tip.moderationMetadata)
				? (tip.moderationMetadata as Record<string, unknown>)
				: {};
		await db.communityTip.update({
			where: { id: tipId },
			data: {
				...applyLlmResultToTipData(fallback, existingMetadata),
				moderationMetadata: {
					...priorMetadata,
					llmFailureAt: new Date().toISOString(),
					fallback: "heuristic",
				},
			},
		});
	}
}

export async function createCommunityTip(
	userId: string,
	input: CreateCommunityTipInput,
): Promise<CommunityTipOwnerDetail> {
	await assertSubmissionRateLimit(userId);

	const fingerprint = buildSubmissionFingerprint(
		userId,
		input.title,
		input.body,
	);
	const duplicate = await db.communityTip.findFirst({
		where: {
			authorUserId: userId,
			submissionFingerprint: fingerprint,
			createdAt: { gte: new Date(Date.now() - 60_000) },
			deletedAt: null,
		},
	});
	if (duplicate) {
		throwTipError(
			"Duplicate Community Tip submission detected. Please wait before retrying.",
			409,
			{ code: "COMMUNITY_TIP_DUPLICATE" },
		);
	}

	const metadata = metadataCreateData(input.metadata);
	let tip: TipWithAuthor;
	try {
		tip = await attachAuthor(
			await db.communityTip.create({
				data: {
					authorUserId: userId,
					title: input.title,
					body: input.body,
					attribution: input.attribution,
					status: "LLM_REVIEW",
					submissionFingerprint: fingerprint,
					...metadata,
				},
			}),
		);
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: string }).code === "P2002"
		) {
			throwTipError(
				"Duplicate Community Tip submission detected. Please wait before retrying.",
				409,
				{ code: "COMMUNITY_TIP_DUPLICATE" },
			);
		}
		throw error;
	}

	await runLlmReviewForTip(tip.id);

	const refreshed = await attachAuthor(
		await db.communityTip.findUniqueOrThrow({
			where: { id: tip.id },
		}),
	);
	notifyAdminIfPendingReview(refreshed);
	return toOwnerDetail(refreshed, false, userId);
}

export async function updateCommunityTip(
	userId: string,
	input: UpdateCommunityTipInput,
): Promise<CommunityTipOwnerDetail> {
	const tip = await attachAuthor(
		await db.communityTip.findFirst({
			where: { id: input.tipId, authorUserId: userId, deletedAt: null },
		}),
	);
	if (!tip) throwTipError("Community Tip not found", 404);

	const contentChanging =
		input.title !== undefined ||
		input.body !== undefined ||
		input.metadata !== undefined;
	const rerunModeration = shouldRerunModeration(tip.status, contentChanging);

	const metadata = input.metadata
		? metadataPatchData(tip, input.metadata)
		: undefined;

	const updated = await db.communityTip.update({
		where: { id: tip.id },
		data: {
			title: input.title ?? tip.title,
			body: input.body ?? tip.body,
			attribution: input.attribution ?? tip.attribution,
			...(metadata ?? {}),
			...(rerunModeration
				? {
						status: "LLM_REVIEW" as const,
						publishedAt: null,
						llmReview: Prisma.DbNull,
						llmReviewStartedAt: null,
						llmReviewCompletedAt: null,
						moderationReason: null,
						moderationMetadata: Prisma.DbNull,
						reviewedAt: null,
						reviewedById: null,
					}
				: {}),
		},
	});

	if (rerunModeration) {
		await runLlmReviewForTip(updated.id);
	}

	const refreshed = await attachAuthor(
		await db.communityTip.findUniqueOrThrow({
			where: { id: updated.id },
		}),
	);
	if (rerunModeration) {
		notifyAdminIfPendingReview(refreshed);
	}
	const liked = await likedTipIdsForUser(userId, [refreshed.id]);
	return toOwnerDetail(refreshed, liked.has(refreshed.id), userId);
}

export async function deleteCommunityTip(
	userId: string,
	tipId: string,
): Promise<void> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, authorUserId: userId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);
	await db.communityTip.update({
		where: { id: tip.id },
		data: {
			deletedAt: new Date(),
			status: tip.status === "APPROVED" ? "ARCHIVED" : tip.status,
			publishedAt: null,
		},
	});
}

export async function getCommunityTip(
	userId: string,
	tipId: string,
): Promise<CommunityTipPublicDetail | CommunityTipOwnerDetail> {
	const tip = await attachAuthor(
		await db.communityTip.findFirst({
			where: { id: tipId, deletedAt: null },
		}),
	);
	if (!tip) throwTipError("Community Tip not found", 404);

	const liked = await likedTipIdsForUser(userId, [tip.id]);
	const isOwner = tip.authorUserId === userId;
	const isPublicApproved =
		tip.status === "APPROVED" &&
		(!tip.expiresAt || tip.expiresAt.getTime() > Date.now());

	if (!isOwner && !isPublicApproved) {
		throwTipError("Community Tip not found", 404);
	}

	if (isOwner) return toOwnerDetail(tip, liked.has(tip.id), userId);
	return toPublicDetail(tip, liked.has(tip.id), userId);
}

export async function listMyCommunityTips(
	userId: string,
): Promise<CommunityTipOwnerDetail[]> {
	const tips = await attachAuthors(
		await db.communityTip.findMany({
			where: { authorUserId: userId, deletedAt: null },
			orderBy: { createdAt: "desc" },
		}),
	);
	const liked = await likedTipIdsForUser(
		userId,
		tips.map((tip) => tip.id),
	);
	return tips.map((tip) => toOwnerDetail(tip, liked.has(tip.id), userId));
}

export async function listCommunityTips(
	userId: string,
	input: ListCommunityTipsInput,
): Promise<CommunityTipFeedResponse> {
	const now = new Date();
	const tips = await attachAuthors(
		await db.communityTip.findMany({
			where: {
				deletedAt: null,
				status: "APPROVED",
				OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
				...(input.tipType ? { tipType: input.tipType } : {}),
				...(input.personallyTested !== undefined
					? { personallyTested: input.personallyTested }
					: {}),
				...(input.category
					? { transactionCategories: { has: input.category } }
					: {}),
			},
			orderBy: { publishedAt: "desc" },
			take: 200,
		}),
	);

	const filtered = tips.filter((tip) =>
		communityTipMatchesSearchQuery(
			[
				tip.title,
				tip.body,
				...tip.keywords,
				...tip.normalizedKeywords,
				...tip.tags,
				...tip.merchantNames,
				...tip.normalizedMerchantNames,
			],
			input.query,
		),
	);

	const maxLikes = filtered.reduce(
		(max, tip) => Math.max(max, tip.likeCount),
		0,
	);
	const scored = filtered
		.filter((tip) => tip.publishedAt)
		.map((tip) => ({
			tip,
			likeCount: tip.likeCount,
			publishedAt: tip.publishedAt as Date,
			feedScore: computeFeedScore({
				likeCount: tip.likeCount,
				maxLikes,
				publishedAt: tip.publishedAt as Date,
				now,
			}),
		}));

	scored.sort((a, b) => compareFeedItems(a, b, input.sort));

	let startIndex = 0;
	if (input.cursor) {
		const cursorIndex = scored.findIndex(
			(item) => item.tip.id === input.cursor,
		);
		if (cursorIndex < 0) {
			return { items: [], nextCursor: null };
		}
		startIndex = cursorIndex + 1;
	}
	const page = scored.slice(startIndex, startIndex + input.limit);
	const liked = await likedTipIdsForUser(
		userId,
		page.map((item) => item.tip.id),
	);

	const last = page.at(-1);
	return {
		items: page.map((item) =>
			toPublicSummary(item.tip, liked.has(item.tip.id), userId),
		),
		nextCursor:
			last && startIndex + input.limit < scored.length ? last.tip.id : null,
	};
}

export async function likeCommunityTip(
	userId: string,
	tipId: string,
): Promise<CommunityTipPublicSummary> {
	const tip = await attachAuthor(
		await db.communityTip.findFirst({
			where: {
				id: tipId,
				deletedAt: null,
				status: "APPROVED",
			},
		}),
	);
	if (!tip) throwTipError("Only approved Community Tips can be liked", 400);

	try {
		await db.$transaction(async (tx) => {
			await tx.communityTipLike.create({
				data: { tipId, userId },
			});
			await tx.communityTip.update({
				where: { id: tipId },
				data: { likeCount: { increment: 1 } },
			});
		});
	} catch (error) {
		if (
			error &&
			typeof error === "object" &&
			"code" in error &&
			(error as { code?: string }).code === "P2002"
		) {
			// already liked
		} else {
			throw error;
		}
	}

	const refreshed = await attachAuthor(
		await db.communityTip.findUniqueOrThrow({
			where: { id: tipId },
		}),
	);
	return toPublicSummary(refreshed, true, userId);
}

export async function unlikeCommunityTip(
	userId: string,
	tipId: string,
): Promise<CommunityTipPublicSummary> {
	await db.$transaction(async (tx) => {
		const deleted = await tx.communityTipLike.deleteMany({
			where: { tipId, userId },
		});
		if (deleted.count === 0) return;
		await tx.communityTip.updateMany({
			where: { id: tipId, likeCount: { gt: 0 } },
			data: { likeCount: { decrement: 1 } },
		});
	});

	const tip = await attachAuthor(
		await db.communityTip.findFirst({
			where: { id: tipId, deletedAt: null },
		}),
	);
	if (!tip) throwTipError("Community Tip not found", 404);
	return toPublicSummary(tip, false, userId);
}

export async function listAdminCommunityTips(input: {
	filter: CommunityTipStatus | "ALL";
	cursor?: string;
	limit: number;
}): Promise<{ items: CommunityTipAdminDetail[]; nextCursor: string | null }> {
	const tips = await attachAuthors(
		await db.communityTip.findMany({
			where: {
				deletedAt: null,
				...(input.filter === "ALL" ? {} : { status: input.filter }),
				...(input.cursor ? { createdAt: { lt: new Date(input.cursor) } } : {}),
			},
			orderBy: { createdAt: "desc" },
			take: input.limit,
		}),
	);

	return {
		items: tips.map((tip) => toAdminDetail(tip, false, "")),
		nextCursor:
			tips.length === input.limit
				? (tips.at(-1)?.createdAt.toISOString() ?? null)
				: null,
	};
}

export async function getAdminCommunityTip(
	tipId: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await attachAuthor(
		await db.communityTip.findFirst({
			where: { id: tipId, deletedAt: null },
		}),
	);
	if (!tip) throwTipError("Community Tip not found", 404);
	return toAdminDetail(tip, false, "");
}

export async function approveCommunityTip(
	adminUserId: string,
	tipId: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);
	if (
		tip.status !== "PENDING_ADMIN_REVIEW" &&
		tip.status !== "CHANGES_REQUIRED" &&
		tip.status !== "LLM_REVIEW"
	) {
		throwTipError("Community Tip cannot be approved from this status", 400);
	}
	if (tip.expiresAt && tip.expiresAt.getTime() <= Date.now()) {
		throwTipError(
			"Community Tip is already expired and cannot be approved",
			400,
		);
	}

	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			status: "APPROVED",
			publishedAt: new Date(),
			reviewedAt: new Date(),
			reviewedById: adminUserId,
			moderationReason: null,
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function rejectCommunityTip(
	adminUserId: string,
	tipId: string,
	reason?: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);

	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			status: "REJECTED",
			publishedAt: null,
			reviewedAt: new Date(),
			reviewedById: adminUserId,
			moderationReason: reason ?? "Rejected by moderator",
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function requestCommunityTipChanges(
	adminUserId: string,
	tipId: string,
	reason: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);

	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			status: "CHANGES_REQUIRED",
			publishedAt: null,
			reviewedAt: new Date(),
			reviewedById: adminUserId,
			moderationReason: reason,
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function archiveCommunityTip(
	adminUserId: string,
	tipId: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);

	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			status: "ARCHIVED",
			publishedAt: null,
			reviewedAt: new Date(),
			reviewedById: adminUserId,
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function expireCommunityTip(
	adminUserId: string,
	tipId: string,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);

	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			status: "EXPIRED",
			expiresAt: new Date(),
			publishedAt: null,
			reviewedAt: new Date(),
			reviewedById: adminUserId,
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function updateCommunityTipMetadata(
	adminUserId: string,
	tipId: string,
	metadata: NonNullable<CreateCommunityTipInput["metadata"]>,
): Promise<CommunityTipAdminDetail> {
	const tip = await db.communityTip.findFirst({
		where: { id: tipId, deletedAt: null },
	});
	if (!tip) throwTipError("Community Tip not found", 404);

	const data = metadataCreateData(metadata);
	const updated = await db.communityTip.update({
		where: { id: tipId },
		data: {
			...data,
			reviewedAt: new Date(),
			reviewedById: adminUserId,
		},
	});
	return toAdminDetail(await attachAuthor(updated), false, adminUserId);
}

export async function getCommunityTipSettings(userId: string): Promise<{
	showCommunityTipsOnTransactions: boolean;
}> {
	const settings = await db.userSettings.findUnique({
		where: { userId },
		select: { showCommunityTipsOnTransactions: true },
	});
	return {
		showCommunityTipsOnTransactions:
			settings?.showCommunityTipsOnTransactions ?? true,
	};
}

export async function setCommunityTipSettings(
	userId: string,
	enabled: boolean,
): Promise<{ showCommunityTipsOnTransactions: boolean }> {
	const settings = await db.userSettings.upsert({
		where: { userId },
		create: { userId, showCommunityTipsOnTransactions: enabled },
		update: { showCommunityTipsOnTransactions: enabled },
		select: { showCommunityTipsOnTransactions: true },
	});
	return {
		showCommunityTipsOnTransactions: settings.showCommunityTipsOnTransactions,
	};
}

export async function listTipsForTransaction(
	userId: string,
	transactionId: string,
	limit = 1,
): Promise<CommunityTipTransactionRecommendation[]> {
	const settings = await getCommunityTipSettings(userId);
	if (!settings.showCommunityTipsOnTransactions) return [];

	const transaction = await db.transaction.findFirst({
		where: { id: transactionId, userId },
		select: {
			id: true,
			merchantName: true,
			description: true,
			originalDescription: true,
			category: true,
			amount: true,
		},
	});
	if (!transaction) throwTipError("Transaction not found", 404);

	const now = new Date();
	const tips = await attachAuthors(
		await db.communityTip.findMany({
			where: {
				deletedAt: null,
				status: "APPROVED",
				OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
			},
			take: 300,
		}),
	);

	const matches = rankCommunityTipMatches(
		tips.map((tip) => ({
			tipId: tip.id,
			title: tip.title,
			body: tip.body,
			normalizedKeywords: tip.normalizedKeywords,
			normalizedMerchantNames: tip.normalizedMerchantNames,
			transactionCategories: tip.transactionCategories,
			countryCodes: tip.countryCodes,
			likeCount: tip.likeCount,
			estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
			expiresAt: tip.expiresAt,
			status: tip.status,
		})),
		{
			merchantName: transaction.merchantName ?? undefined,
			description: transaction.description ?? undefined,
			originalDescription: transaction.originalDescription ?? undefined,
			category: transaction.category,
		},
		{ limit },
	);

	if (matches.length === 0) return [];

	const tipById = new Map(tips.map((tip) => [tip.id, tip]));
	const liked = await likedTipIdsForUser(
		userId,
		matches.map((match) => match.tipId),
	);

	return matches.flatMap((match) => {
		const tip = tipById.get(match.tipId);
		if (!tip) return [];
		const summary = toPublicSummary(tip, liked.has(tip.id), userId);
		return [
			{
				...summary,
				matchedKeywords: match.matchedKeywords,
				totalScore: match.totalScore,
				potentialBenefitAmount: estimatePotentialBenefitAmount({
					transactionAmount: Number(transaction.amount),
					estimatedSavingsPercent: decimalToNumber(tip.estimatedSavingsPercent),
				}),
			},
		];
	});
}
