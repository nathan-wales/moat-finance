import {
	type CommunityTipLlmReviewResult,
	communityTipLlmReviewResultSchema,
	heuristicCommunityTipReview,
} from "@moat/community-tips";
import OpenAI from "openai";
import { logger } from "~/lib/logger";

export type CommunityTipReviewInput = {
	title: string;
	body: string;
	externalUrl?: string | null;
	keywords?: string[];
	merchantNames?: string[];
	tags?: string[];
	categories?: string[];
	tipType?: string | null;
	potentialBenefit?: string | null;
};

const SYSTEM_PROMPT = `You are a Community Tips moderator for Moat Finance.
Review user-submitted money-saving or money-earning tips.
Never approve publication yourself. Decide only among PASS_TO_ADMIN, CHANGES_REQUIRED, or REJECT.
Flag solicitation, self-promotion, referral codes, affiliate spam, recruiting, MLM, guaranteed earnings/savings, scams, credit-repair misinformation, unsafe or illegal activity, deceptive credit card strategies, PII, sensitive financial information, suspicious links, and low-quality submissions.
Also suggest concise normalized keywords, merchants, categories, tags, tip type, and potential benefit.
Return JSON only matching the schema.`;

export async function reviewCommunityTipWithLlm(
	input: CommunityTipReviewInput,
): Promise<CommunityTipLlmReviewResult> {
	const fallback = heuristicCommunityTipReview(input);
	const apiKey = process.env.OPENAI_API_KEY?.trim();
	if (!apiKey) {
		return fallback;
	}

	try {
		const client = new OpenAI({ apiKey });
		const model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
		const response = await client.responses.create({
			model,
			temperature: 0,
			input: [
				{ role: "system", content: SYSTEM_PROMPT },
				{
					role: "user",
					content: JSON.stringify({
						title: input.title,
						body: input.body,
						externalUrl: input.externalUrl ?? null,
						keywords: input.keywords ?? [],
						merchantNames: input.merchantNames ?? [],
						tags: input.tags ?? [],
						categories: input.categories ?? [],
						tipType: input.tipType ?? null,
						potentialBenefit: input.potentialBenefit ?? null,
					}),
				},
			],
			text: {
				format: {
					type: "json_object",
				},
			},
		});

		const text = response.output_text;
		if (!text) {
			logger.warn("Community tip LLM returned empty output; using heuristic", {
				feature: "community_tips",
				operation: "llm_review",
			});
			return fallback;
		}

		const parsed = communityTipLlmReviewResultSchema.parse(JSON.parse(text));
		return parsed;
	} catch (error) {
		logger.warn("Community tip LLM provider failed; using heuristic", {
			feature: "community_tips",
			operation: "llm_review",
			error: error instanceof Error ? error.message : "unknown",
		});
		return fallback;
	}
}
