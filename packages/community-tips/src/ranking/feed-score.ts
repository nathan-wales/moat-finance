import {
	COMMUNITY_TIP_FEED_LIKE_WEIGHT,
	COMMUNITY_TIP_FEED_RECENCY_HALF_LIFE_DAYS,
	COMMUNITY_TIP_FEED_RECENCY_WEIGHT,
} from "../constants";
import type { CommunityTipFeedSort } from "../types";

export function computeRecencyScore(
	publishedAt: Date,
	now = new Date(),
): number {
	const ageMs = Math.max(0, now.getTime() - publishedAt.getTime());
	const ageDays = ageMs / (24 * 60 * 60 * 1000);
	return 1 / (1 + ageDays / COMMUNITY_TIP_FEED_RECENCY_HALF_LIFE_DAYS);
}

export function normalizeLikeCount(
	likeCount: number,
	maxLikes: number,
): number {
	if (maxLikes <= 0) return 0;
	return Math.min(1, Math.max(0, likeCount / maxLikes));
}

export function computeFeedScore(input: {
	likeCount: number;
	maxLikes: number;
	publishedAt: Date;
	now?: Date;
}): number {
	const likeScore = normalizeLikeCount(input.likeCount, input.maxLikes);
	const recencyScore = computeRecencyScore(input.publishedAt, input.now);
	return (
		COMMUNITY_TIP_FEED_LIKE_WEIGHT * likeScore +
		COMMUNITY_TIP_FEED_RECENCY_WEIGHT * recencyScore
	);
}

export function compareFeedItems(
	a: { likeCount: number; publishedAt: Date; feedScore: number },
	b: { likeCount: number; publishedAt: Date; feedScore: number },
	sort: CommunityTipFeedSort,
): number {
	if (sort === "newest") {
		return b.publishedAt.getTime() - a.publishedAt.getTime();
	}
	if (sort === "most_liked") {
		if (b.likeCount !== a.likeCount) return b.likeCount - a.likeCount;
		return b.publishedAt.getTime() - a.publishedAt.getTime();
	}
	if (b.feedScore !== a.feedScore) return b.feedScore - a.feedScore;
	return b.publishedAt.getTime() - a.publishedAt.getTime();
}
