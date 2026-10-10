import {
	COMMUNITY_TIP_MATCH_CATEGORY_WEIGHT,
	COMMUNITY_TIP_MATCH_DEFAULT_RESULTS,
	COMMUNITY_TIP_MATCH_KEYWORD_WEIGHT,
	COMMUNITY_TIP_MATCH_LIKE_WEIGHT,
	COMMUNITY_TIP_MATCH_MAX_RESULTS,
	COMMUNITY_TIP_MATCH_MERCHANT_WEIGHT,
	COMMUNITY_TIP_MATCH_MIN_THRESHOLD,
} from "../constants";
import { normalizeKeyword } from "../keywords/normalize";
import type {
	CommunityTipMatchCandidate,
	CommunityTipMatchInput,
	CommunityTipMatchResult,
} from "../types";

function haystackFromInput(input: CommunityTipMatchInput): {
	merchant: string;
	description: string;
	category: string;
	combined: string;
} {
	const merchant = normalizeKeyword(input.merchantName ?? "");
	const description = normalizeKeyword(
		[input.description, input.originalDescription].filter(Boolean).join(" "),
	);
	const category = normalizeKeyword(input.category ?? "");
	return {
		merchant,
		description,
		category,
		combined: [merchant, description, category].filter(Boolean).join(" "),
	};
}

function scoreMerchantMatch(
	candidate: CommunityTipMatchCandidate,
	merchant: string,
): number {
	if (!merchant) return 0;
	let best = 0;
	for (const tipMerchant of candidate.normalizedMerchantNames) {
		if (!tipMerchant) continue;
		if (merchant === tipMerchant) {
			best = Math.max(best, 1);
			continue;
		}
		if (merchant.includes(tipMerchant) || tipMerchant.includes(merchant)) {
			best = Math.max(best, 0.85);
			continue;
		}
		const merchantTokens = new Set(merchant.split(" "));
		const tipTokens = tipMerchant.split(" ");
		const overlap = tipTokens.filter((token) => merchantTokens.has(token));
		if (overlap.length > 0) {
			best = Math.max(best, 0.55 * (overlap.length / tipTokens.length));
		}
	}
	return best;
}

function scoreKeywordMatch(
	candidate: CommunityTipMatchCandidate,
	haystack: { merchant: string; description: string; combined: string },
): { score: number; matchedKeywords: string[] } {
	const matchedKeywords: string[] = [];
	let score = 0;
	for (const keyword of candidate.normalizedKeywords) {
		if (!keyword) continue;
		if (haystack.merchant.includes(keyword)) {
			matchedKeywords.push(keyword);
			score = Math.max(score, keyword.includes(" ") ? 0.95 : 0.8);
			continue;
		}
		if (haystack.description.includes(keyword)) {
			matchedKeywords.push(keyword);
			score = Math.max(score, keyword.includes(" ") ? 0.75 : 0.55);
			continue;
		}
		if (haystack.combined.includes(keyword)) {
			matchedKeywords.push(keyword);
			score = Math.max(score, 0.35);
		}
	}
	return { score, matchedKeywords };
}

function scoreCategoryMatch(
	candidate: CommunityTipMatchCandidate,
	category: string,
): number {
	if (!category) return 0;
	const normalizedCategories = candidate.transactionCategories.map((value) =>
		normalizeKeyword(value),
	);
	if (normalizedCategories.includes(category)) return 1;
	if (
		normalizedCategories.some(
			(value) => value.includes(category) || category.includes(value),
		)
	) {
		return 0.7;
	}
	return 0;
}

function scoreLikes(likeCount: number, maxLikes: number): number {
	if (maxLikes <= 0) return 0;
	return Math.min(1, likeCount / maxLikes);
}

function isGeographicallyCompatible(
	candidate: CommunityTipMatchCandidate,
	countryCode?: string,
): boolean {
	if (!candidate.countryCodes.length) return true;
	if (!countryCode) return true;
	return candidate.countryCodes
		.map((code) => code.toUpperCase())
		.includes(countryCode.toUpperCase());
}

export function scoreCommunityTipMatch(
	candidate: CommunityTipMatchCandidate,
	input: CommunityTipMatchInput,
	maxLikes: number,
): CommunityTipMatchResult | null {
	if (candidate.status !== "APPROVED") return null;
	if (candidate.expiresAt && candidate.expiresAt.getTime() <= Date.now()) {
		return null;
	}
	if (!isGeographicallyCompatible(candidate, input.countryCode)) return null;

	const haystack = haystackFromInput(input);
	const merchantMatchScore = scoreMerchantMatch(candidate, haystack.merchant);
	const { score: keywordMatchScore, matchedKeywords } = scoreKeywordMatch(
		candidate,
		haystack,
	);
	const categoryMatchScore = scoreCategoryMatch(candidate, haystack.category);
	const likeScore = scoreLikes(candidate.likeCount, maxLikes);

	const relevance =
		merchantMatchScore * COMMUNITY_TIP_MATCH_MERCHANT_WEIGHT +
		keywordMatchScore * COMMUNITY_TIP_MATCH_KEYWORD_WEIGHT +
		categoryMatchScore * COMMUNITY_TIP_MATCH_CATEGORY_WEIGHT;

	if (relevance < COMMUNITY_TIP_MATCH_MIN_THRESHOLD * 0.9) {
		return null;
	}

	const totalScore = relevance + likeScore * COMMUNITY_TIP_MATCH_LIKE_WEIGHT;

	if (totalScore < COMMUNITY_TIP_MATCH_MIN_THRESHOLD) return null;

	return {
		tipId: candidate.tipId,
		keywordMatchScore,
		merchantMatchScore,
		categoryMatchScore,
		likeScore,
		totalScore,
		matchedKeywords,
	};
}

export function rankCommunityTipMatches(
	candidates: CommunityTipMatchCandidate[],
	input: CommunityTipMatchInput,
	options?: { limit?: number },
): CommunityTipMatchResult[] {
	const maxLikes = candidates.reduce(
		(max, candidate) => Math.max(max, candidate.likeCount),
		0,
	);
	const scored: CommunityTipMatchResult[] = [];
	for (const candidate of candidates) {
		const result = scoreCommunityTipMatch(candidate, input, maxLikes);
		if (result) scored.push(result);
	}
	scored.sort((a, b) => b.totalScore - a.totalScore);
	const limit = Math.min(
		options?.limit ?? COMMUNITY_TIP_MATCH_DEFAULT_RESULTS,
		COMMUNITY_TIP_MATCH_MAX_RESULTS,
	);
	return scored.slice(0, limit);
}

export function estimatePotentialBenefitAmount(input: {
	transactionAmount: number;
	estimatedSavingsPercent: number | null;
}): number | null {
	if (
		input.estimatedSavingsPercent === null ||
		input.estimatedSavingsPercent <= 0
	) {
		return null;
	}
	const amount = Math.abs(input.transactionAmount);
	if (!Number.isFinite(amount) || amount <= 0) return null;
	return Number(((amount * input.estimatedSavingsPercent) / 100).toFixed(2));
}
