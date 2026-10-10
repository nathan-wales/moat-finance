export type GenerateCommunityTipAiPromptInput = {
	topic: string;
	extraContext?: string;
};

export type GenerateCommunityTipAiPromptResult = {
	prompt: string;
};

export function generateCommunityTipAiPrompt(
	input: GenerateCommunityTipAiPromptInput,
): GenerateCommunityTipAiPromptResult {
	const topic = input.topic.trim();
	const extra = input.extraContext?.trim();

	const lines = [
		"Help me create a Moat Community Tip using the Moat MCP community tip tools.",
		"",
		"Before drafting, run a short initial questionnaire. In that first questionnaire, ask once whether I want to post anonymously. Do not ask about anonymity again later. If I do not answer or leave it unclear, treat the tip as a public post (attribution PUBLIC).",
		"",
		"Then gather enough detail to write a clear, useful money-saving or money-earning tip (title + body).",
		"",
		"When you create the tip with moat.createCommunityTip:",
		"- Always include useful metadata by default: keywords, merchantNames, tags, tipType, potentialBenefit, transactionCategories, and any other relevant fields you can infer.",
		"- Set attribution to ANONYMOUS only if I explicitly chose anonymous; otherwise use PUBLIC (or omit attribution so it defaults to PUBLIC).",
		"- After submission, remind me that the tip must go through a review process before it can appear publicly, and that I can change attribution later (for example to anonymous) via moat.updateCommunityTip or My tips in Moat.",
		"",
		`Topic / tip idea: ${topic}`,
	];

	if (extra) {
		lines.push(`Additional context: ${extra}`);
	}

	lines.push(
		"",
		"You may use moat.listCommunityTips / moat.getCommunityTip / moat.listMyCommunityTips to avoid duplicates or check my existing submissions.",
	);

	return { prompt: lines.join("\n") };
}
