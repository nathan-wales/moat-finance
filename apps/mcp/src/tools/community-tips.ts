import { createHash } from "node:crypto";
import {
	COMMUNITY_TIP_SUBMISSION_WINDOW_MS,
	type CreateCommunityTipInput,
	communityTipMatchesSearchQuery,
	compareFeedItems,
	computeFeedScore,
	getCommunityTipSubmissionLimitPer24h,
	heuristicCommunityTipReview,
	normalizeKeywordList,
	previewBody,
	publicAuthorFromAttribution,
	type UpdateCommunityTipInput,
} from "@moat/community-tips";
import type {
	McpCreateCommunityTipInput,
	McpGetCommunityTipInput,
	McpListCommunityTipsInput,
	McpListMyCommunityTipsInput,
	McpUpdateCommunityTipInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import {
	type Prisma,
	Prisma as PrismaClient,
} from "../../../api/generated/prisma";
import { runAsElevatedServiceActor } from "../../../api/src/server/db-actor";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

const REVIEW_REMINDER =
	"Your tip was submitted and must go through a review process before it can appear publicly. You can change attribution later (for example to anonymous) with moat.updateCommunityTip or in My tips in Moat.";

type TipAuthorFields = {
	name: string | null;
	username: string | null;
	image: string | null;
};

const MISSING_AUTHOR: TipAuthorFields = {
	name: null,
	username: null,
	image: null,
};

type TipWithAuthor = Prisma.CommunityTipGetPayload<object> & {
	author: TipAuthorFields;
};

async function attachAuthors<T extends { authorUserId: string }>(
	db: McpAuthContext["db"],
	tips: T[],
): Promise<Array<T & { author: TipAuthorFields }>> {
	const uniqueIds = [...new Set(tips.map((tip) => tip.authorUserId))];
	if (uniqueIds.length === 0) {
		return tips.map((tip) => ({ ...tip, author: MISSING_AUTHOR }));
	}

	const users = await runAsElevatedServiceActor(() =>
		db.user.findMany({
			where: { id: { in: uniqueIds } },
			select: { id: true, name: true, username: true, image: true },
		}),
	);
	const authors = new Map(
		users.map((user) => [
			user.id,
			{ name: user.name, username: user.username, image: user.image },
		]),
	);

	return tips.map((tip) => ({
		...tip,
		author: authors.get(tip.authorUserId) ?? MISSING_AUTHOR,
	}));
}

async function attachAuthor<T extends { authorUserId: string }>(
	db: McpAuthContext["db"],
	tip: T,
): Promise<T & { author: TipAuthorFields }>;
async function attachAuthor<T extends { authorUserId: string }>(
	db: McpAuthContext["db"],
	tip: T | null,
): Promise<(T & { author: TipAuthorFields }) | null>;
async function attachAuthor<T extends { authorUserId: string }>(
	db: McpAuthContext["db"],
	tip: T | null,
): Promise<(T & { author: TipAuthorFields }) | null> {
	if (!tip) return null;
	const [withAuthor] = await attachAuthors(db, [tip]);
	return withAuthor ?? null;
}

function decimalToNumber(
	value: Prisma.Decimal | number | null | undefined,
): number | null {
	if (value === null || value === undefined) return null;
	if (typeof value === "number") return value;
	return Number(value.toString());
}

function toIso(date: Date | null | undefined): string | null {
	return date ? date.toISOString() : null;
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

function metadataFromTip(tip: TipWithAuthor) {
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

function toPublicSummary(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
) {
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

function toOwnerDetail(
	tip: TipWithAuthor,
	likedByCurrentUser: boolean,
	currentUserId: string,
) {
	const publicDetail = {
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

async function likedTipIdsForUser(
	db: McpAuthContext["db"],
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

async function assertSubmissionRateLimit(
	db: McpAuthContext["db"],
	userId: string,
): Promise<void> {
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
	throw new Error(
		`You can submit up to ${limit} Community Tips per 24 hours. Try again after ${nextEligibleAt.toISOString()}.`,
	);
}

function applyReviewToTip(
	tip: TipWithAuthor,
	review: ReturnType<typeof heuristicCommunityTipReview>,
) {
	const normalizedKeywords = normalizeKeywordList([
		...tip.keywords,
		...review.suggestedKeywords,
	]);
	const normalizedMerchants = normalizeKeywordList([
		...tip.merchantNames,
		...review.suggestedMerchants,
	]);
	const normalizedTags = normalizeKeywordList(
		[...tip.tags, ...review.suggestedTags],
		10,
	);
	const normalizedCategories = normalizeKeywordList([
		...tip.transactionCategories,
		...review.suggestedCategories,
	]);

	let status: TipWithAuthor["status"] = "PENDING_ADMIN_REVIEW";
	let moderationReason: string | null = null;
	if (review.decision === "CHANGES_REQUIRED") {
		status = "CHANGES_REQUIRED";
		moderationReason = review.summary;
	} else if (review.decision === "REJECT") {
		status = "REJECTED";
		moderationReason = review.summary;
	}

	return {
		status,
		moderationReason,
		llmReview: review,
		llmReviewCompletedAt: new Date(),
		keywords: tip.keywords,
		normalizedKeywords,
		merchantNames: tip.merchantNames,
		normalizedMerchantNames: normalizedMerchants,
		tags: tip.tags.length ? tip.tags : normalizedTags,
		transactionCategories: tip.transactionCategories.length
			? tip.transactionCategories
			: normalizedCategories,
		tipType: tip.tipType ?? review.suggestedTipType ?? null,
		potentialBenefit:
			tip.potentialBenefit ?? review.suggestedPotentialBenefit ?? null,
	};
}

async function runHeuristicReview(
	db: McpAuthContext["db"],
	tip: TipWithAuthor,
): Promise<TipWithAuthor> {
	const review = heuristicCommunityTipReview({
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

	return attachAuthor(
		db,
		await db.communityTip.update({
			where: { id: tip.id },
			data: applyReviewToTip(tip, review),
		}),
	);
}

export const listCommunityTipsTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listCommunityTips"],
	async execute(input, context: McpAuthContext) {
		const parsed = input as McpListCommunityTipsInput;
		const now = new Date();
		const tips = await attachAuthors(
			context.db,
			await context.db.communityTip.findMany({
				where: {
					deletedAt: null,
					status: "APPROVED",
					OR: [{ expiresAt: null }, { expiresAt: { gt: now } }],
					...(parsed.tipType ? { tipType: parsed.tipType } : {}),
					...(parsed.personallyTested !== undefined
						? { personallyTested: parsed.personallyTested }
						: {}),
					...(parsed.category
						? { transactionCategories: { has: parsed.category } }
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
				parsed.query,
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

		scored.sort((a, b) => compareFeedItems(a, b, parsed.sort));

		let startIndex = 0;
		if (parsed.cursor) {
			const cursorIndex = scored.findIndex(
				(item) => item.tip.id === parsed.cursor,
			);
			if (cursorIndex < 0) {
				return schemaEnvelope("communityTips.list", {
					items: [],
					nextCursor: null,
				});
			}
			startIndex = cursorIndex + 1;
		}

		const page = scored.slice(startIndex, startIndex + parsed.limit);
		const liked = await likedTipIdsForUser(
			context.db,
			context.userId,
			page.map((item) => item.tip.id),
		);
		const last = page.at(-1);

		return schemaEnvelope("communityTips.list", {
			items: page.map((item) =>
				toPublicSummary(item.tip, liked.has(item.tip.id), context.userId),
			),
			nextCursor:
				last && startIndex + parsed.limit < scored.length ? last.tip.id : null,
		});
	},
};

export const getCommunityTipTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.getCommunityTip"],
	async execute(input, context: McpAuthContext) {
		const parsed = input as McpGetCommunityTipInput;
		const tip = await attachAuthor(
			context.db,
			await context.db.communityTip.findFirst({
				where: { id: parsed.tipId, deletedAt: null },
			}),
		);
		if (!tip) throw new Error("Community Tip not found");

		const liked = await likedTipIdsForUser(context.db, context.userId, [
			tip.id,
		]);
		const isOwner = tip.authorUserId === context.userId;
		const isPublicApproved =
			tip.status === "APPROVED" &&
			(!tip.expiresAt || tip.expiresAt.getTime() > Date.now());

		if (!isOwner && !isPublicApproved) {
			throw new Error("Community Tip not found");
		}

		if (isOwner) {
			return schemaEnvelope("communityTip.detail", {
				tip: toOwnerDetail(tip, liked.has(tip.id), context.userId),
			});
		}

		return schemaEnvelope("communityTip.detail", {
			tip: {
				...toPublicSummary(tip, liked.has(tip.id), context.userId),
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
			},
		});
	},
};

export const listMyCommunityTipsTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listMyCommunityTips"],
	async execute(_input: McpListMyCommunityTipsInput, context: McpAuthContext) {
		const tips = await attachAuthors(
			context.db,
			await context.db.communityTip.findMany({
				where: { authorUserId: context.userId, deletedAt: null },
				orderBy: { createdAt: "desc" },
			}),
		);
		const liked = await likedTipIdsForUser(
			context.db,
			context.userId,
			tips.map((tip) => tip.id),
		);
		return schemaEnvelope("communityTips.mine", {
			tips: tips.map((tip) =>
				toOwnerDetail(tip, liked.has(tip.id), context.userId),
			),
		});
	},
};

export const createCommunityTipTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.createCommunityTip"],
	async execute(input, context: McpAuthContext) {
		const parsed = input as McpCreateCommunityTipInput;
		await assertSubmissionRateLimit(context.db, context.userId);

		const fingerprint = buildSubmissionFingerprint(
			context.userId,
			parsed.title,
			parsed.body,
		);
		const duplicate = await context.db.communityTip.findFirst({
			where: {
				authorUserId: context.userId,
				submissionFingerprint: fingerprint,
				createdAt: { gte: new Date(Date.now() - 60_000) },
				deletedAt: null,
			},
		});
		if (duplicate) {
			throw new Error(
				"Duplicate Community Tip submission detected. Please wait before retrying.",
			);
		}

		const metadata = metadataCreateData(parsed.metadata);
		let tip: TipWithAuthor;
		try {
			tip = await attachAuthor(
				context.db,
				await context.db.communityTip.create({
					data: {
						authorUserId: context.userId,
						title: parsed.title,
						body: parsed.body,
						attribution: parsed.attribution ?? "PUBLIC",
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
				throw new Error(
					"Duplicate Community Tip submission detected. Please wait before retrying.",
				);
			}
			throw error;
		}

		const reviewed = await runHeuristicReview(context.db, tip);
		return schemaEnvelope("communityTip.created", {
			tip: toOwnerDetail(reviewed, false, context.userId),
			note: REVIEW_REMINDER,
		});
	},
};

export const updateCommunityTipTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.updateCommunityTip"],
	async execute(input, context: McpAuthContext) {
		const parsed = input as McpUpdateCommunityTipInput;
		const tip = await attachAuthor(
			context.db,
			await context.db.communityTip.findFirst({
				where: {
					id: parsed.tipId,
					authorUserId: context.userId,
					deletedAt: null,
				},
			}),
		);
		if (!tip) throw new Error("Community Tip not found");

		const contentChanging =
			parsed.title !== undefined || parsed.body !== undefined;
		const nextTitle = parsed.title ?? tip.title;
		const nextBody = parsed.body ?? tip.body;

		const patch: UpdateCommunityTipInput["metadata"] = parsed.metadata;
		const nextMetadata = patch
			? {
					keywords: patch.keywords ?? tip.keywords,
					normalizedKeywords: normalizeKeywordList(
						patch.keywords ?? tip.keywords,
					),
					merchantNames: patch.merchantNames ?? tip.merchantNames,
					normalizedMerchantNames: normalizeKeywordList(
						patch.merchantNames ?? tip.merchantNames,
					),
					transactionCategories:
						patch.transactionCategories ?? tip.transactionCategories,
					tags: patch.tags ?? tip.tags,
					tipType: patch.tipType !== undefined ? patch.tipType : tip.tipType,
					potentialBenefit:
						patch.potentialBenefit !== undefined
							? patch.potentialBenefit
							: tip.potentialBenefit,
					estimatedSavingsPercent:
						patch.estimatedSavingsPercent !== undefined
							? patch.estimatedSavingsPercent
							: decimalToNumber(tip.estimatedSavingsPercent),
					estimatedSavingsAmount:
						patch.estimatedSavingsAmount !== undefined
							? patch.estimatedSavingsAmount
							: decimalToNumber(tip.estimatedSavingsAmount),
					countryCodes: patch.countryCodes ?? tip.countryCodes,
					requirements: patch.requirements ?? tip.requirements,
					externalUrl:
						patch.externalUrl !== undefined
							? patch.externalUrl
							: tip.externalUrl,
					personallyTested:
						patch.personallyTested !== undefined
							? patch.personallyTested
							: tip.personallyTested,
					expiresAt:
						patch.expiresAt !== undefined
							? patch.expiresAt
								? new Date(patch.expiresAt)
								: null
							: tip.expiresAt,
				}
			: null;

		const shouldRerun =
			contentChanging &&
			(tip.status === "APPROVED" ||
				tip.status === "CHANGES_REQUIRED" ||
				tip.status === "REJECTED" ||
				tip.status === "PENDING_ADMIN_REVIEW" ||
				tip.status === "LLM_REVIEW");

		let updated = await attachAuthor(
			context.db,
			await context.db.communityTip.update({
				where: { id: tip.id },
				data: {
					title: nextTitle,
					body: nextBody,
					attribution: parsed.attribution ?? tip.attribution,
					...(nextMetadata ?? {}),
					...(shouldRerun
						? {
								status: "LLM_REVIEW",
								moderationReason: null,
								llmReview: PrismaClient.DbNull,
								llmReviewStartedAt: null,
								llmReviewCompletedAt: null,
								reviewedAt: null,
								reviewedById: null,
								publishedAt: null,
							}
						: {}),
					...(contentChanging
						? {
								submissionFingerprint: buildSubmissionFingerprint(
									context.userId,
									nextTitle,
									nextBody,
								),
							}
						: {}),
				},
			}),
		);

		if (shouldRerun) {
			updated = await runHeuristicReview(context.db, updated);
		}

		return schemaEnvelope("communityTip.updated", {
			tip: toOwnerDetail(updated, false, context.userId),
			note:
				updated.status === "APPROVED"
					? "Tip updated."
					: "Tip updated. It still needs to pass review before it can appear publicly. You can change attribution anytime.",
		});
	},
};
