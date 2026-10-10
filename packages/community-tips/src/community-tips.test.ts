import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	collectMatchedKeywords,
	communityTipMatchesSearchQuery,
	compareFeedItems,
	computeFeedScore,
	createCommunityTipInputSchema,
	formatCommunityTipSearchQuery,
	heuristicCommunityTipReview,
	normalizeKeywordList,
	parseCommunityTipSearchTerms,
	rankCommunityTipMatches,
} from "./index";

describe("community tip validation", () => {
	it("accepts a valid public submission", () => {
		const parsed = createCommunityTipInputSchema.parse({
			title: "Get 5% back on Amazon",
			body: "Use an Amazon rewards card only for Amazon purchases and keep it on autopay.",
			attribution: "PUBLIC",
		});
		assert.equal(parsed.attribution, "PUBLIC");
	});

	it("rejects short titles and bodies", () => {
		assert.throws(() =>
			createCommunityTipInputSchema.parse({
				title: "Hi",
				body: "Too short",
				attribution: "ANONYMOUS",
			}),
		);
	});

	it("rejects non-http urls", () => {
		assert.throws(() =>
			createCommunityTipInputSchema.parse({
				title: "Valid tip title here",
				body: "A sufficiently long body for a community tip submission.",
				attribution: "PUBLIC",
				metadata: { externalUrl: "javascript:alert(1)" },
			}),
		);
	});
});

describe("keyword normalization", () => {
	it("lowercases, dedupes, and drops stop words", () => {
		assert.deepEqual(
			normalizeKeywordList(["Amazon", "the", "amazon", "Prime Rewards"]),
			["amazon", "prime rewards"],
		);
	});
});

describe("heuristic review", () => {
	it("passes clean tips to admin", () => {
		const result = heuristicCommunityTipReview({
			title: "Get 5% back on Amazon purchases",
			body: "A community member uses an Amazon rewards card only for Amazon purchases and keeps it on autopay.",
			merchantNames: ["Amazon"],
		});
		assert.equal(result.decision, "PASS_TO_ADMIN");
		assert.ok(result.suggestedKeywords.includes("amazon"));
	});

	it("rejects illegal advice", () => {
		const result = heuristicCommunityTipReview({
			title: "Avoid taxes forever",
			body: "This tip explains how to commit tax fraud and hide income from authorities.",
		});
		assert.equal(result.decision, "REJECT");
	});
});

describe("matching", () => {
	const amazonTip = {
		tipId: "tip-amazon",
		title: "Amazon rewards",
		body: "Use Amazon card",
		normalizedKeywords: ["amazon", "amazon prime", "cash back"],
		normalizedMerchantNames: ["amazon"],
		transactionCategories: ["shopping"],
		countryCodes: ["US"],
		likeCount: 10,
		estimatedSavingsPercent: 5,
		expiresAt: null,
		status: "APPROVED" as const,
	};

	const unrelatedTip = {
		...amazonTip,
		tipId: "tip-unrelated",
		normalizedKeywords: ["mortgage", "refi"],
		normalizedMerchantNames: ["quicken loans"],
		transactionCategories: ["housing"],
		likeCount: 10_000,
	};

	it("matches exact merchant and excludes unrelated high-like tips", () => {
		const results = rankCommunityTipMatches(
			[amazonTip, unrelatedTip],
			{
				merchantName: "Amazon Marketplace",
				description: "Amazon Marketplace purchase",
				category: "shopping",
				countryCode: "US",
			},
			{ limit: 3 },
		);
		assert.equal(results.length, 1);
		assert.equal(results[0]?.tipId, "tip-amazon");
	});

	it("excludes expired tips", () => {
		const results = rankCommunityTipMatches(
			[
				{
					...amazonTip,
					expiresAt: new Date(Date.now() - 60_000),
				},
			],
			{ merchantName: "Amazon" },
		);
		assert.equal(results.length, 0);
	});
});

describe("feed ranking", () => {
	it("balances likes with recency", () => {
		const now = new Date("2026-07-20T00:00:00.000Z");
		const olderPopular = {
			likeCount: 100,
			publishedAt: new Date("2026-01-01T00:00:00.000Z"),
			feedScore: computeFeedScore({
				likeCount: 100,
				maxLikes: 100,
				publishedAt: new Date("2026-01-01T00:00:00.000Z"),
				now,
			}),
		};
		const newer = {
			likeCount: 5,
			publishedAt: new Date("2026-07-19T00:00:00.000Z"),
			feedScore: computeFeedScore({
				likeCount: 5,
				maxLikes: 100,
				publishedAt: new Date("2026-07-19T00:00:00.000Z"),
				now,
			}),
		};
		assert.ok(newer.feedScore > 0);
		assert.ok(compareFeedItems(olderPopular, newer, "most_liked") < 0);
		assert.ok(compareFeedItems(olderPopular, newer, "newest") > 0);
	});
});

describe("community tip search query", () => {
	it("parses comma-separated terms and preserves phrases", () => {
		assert.deepEqual(parseCommunityTipSearchTerms("diy, home improvement"), [
			"diy",
			"home improvement",
		]);
		assert.equal(
			formatCommunityTipSearchQuery(["DIY", "diy", "Rewards"]),
			"diy, rewards",
		);
	});

	it("matches when any search term appears", () => {
		assert.equal(
			communityTipMatchesSearchQuery(
				["Home Depot tip", "diy", "home-improvement"],
				"diy, amazon",
			),
			true,
		);
		assert.equal(
			communityTipMatchesSearchQuery(
				["Home Depot tip", "diy", "home-improvement"],
				"amazon, walmart",
			),
			false,
		);
	});

	it("collects unique matched keywords across tips", () => {
		assert.deepEqual(
			collectMatchedKeywords([
				{ matchedKeywords: ["diy", "home"] },
				{ matchedKeywords: ["home", "tools"] },
			]),
			["diy", "home", "tools"],
		);
	});
});
