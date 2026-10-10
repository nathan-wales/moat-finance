import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	heuristicCommunityTipReview,
	publicAuthorFromAttribution,
	rankCommunityTipMatches,
} from "@moat/community-tips";

describe("community tip privacy serializers", () => {
	it("hides anonymous author identity publicly", () => {
		const author = publicAuthorFromAttribution({
			attribution: "ANONYMOUS",
			name: "Tyler Smith",
			username: "tyler",
			image: "https://example.com/a.png",
		});
		assert.equal(author?.displayName, "Anonymous member");
		assert.equal(author?.imageUrl, null);
	});

	it("exposes public author first name", () => {
		const author = publicAuthorFromAttribution({
			attribution: "PUBLIC",
			name: "Tyler Smith",
			username: "tyler",
			image: null,
		});
		assert.equal(author?.displayName, "Tyler");
	});
});

describe("community tip moderation transitions", () => {
	it("passes clean tips to admin review", () => {
		const result = heuristicCommunityTipReview({
			title: "Get 5% back on Amazon purchases",
			body: "Use an Amazon rewards card only for Amazon purchases and keep it on autopay every month.",
			merchantNames: ["Amazon"],
		});
		assert.equal(result.decision, "PASS_TO_ADMIN");
	});

	it("requires changes for referral language", () => {
		const result = heuristicCommunityTipReview({
			title: "Use my referral code today",
			body: "Sign up with my referral code and join my team for guaranteed cash.",
		});
		assert.notEqual(result.decision, "PASS_TO_ADMIN");
	});
});

describe("community tip recommendation ranking", () => {
	it("does not let likes overpower relevance", () => {
		const results = rankCommunityTipMatches(
			[
				{
					tipId: "unrelated",
					title: "Refinance",
					body: "Refinance mortgage",
					normalizedKeywords: ["mortgage"],
					normalizedMerchantNames: ["quicken loans"],
					transactionCategories: ["housing"],
					countryCodes: [],
					likeCount: 50_000,
					estimatedSavingsPercent: 10,
					expiresAt: null,
					status: "APPROVED",
				},
				{
					tipId: "amazon",
					title: "Amazon card",
					body: "Amazon rewards",
					normalizedKeywords: ["amazon"],
					normalizedMerchantNames: ["amazon"],
					transactionCategories: ["shopping"],
					countryCodes: [],
					likeCount: 2,
					estimatedSavingsPercent: 5,
					expiresAt: null,
					status: "APPROVED",
				},
			],
			{
				merchantName: "Amazon",
				description: "Amazon order",
				category: "shopping",
			},
			{ limit: 3 },
		);
		assert.equal(results[0]?.tipId, "amazon");
		assert.ok(!results.some((result) => result.tipId === "unrelated"));
	});
});
