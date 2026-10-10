import type { AiPrompt } from "../types";

export const insurancePrompts: AiPrompt[] = [
	{
		id: "insurance-gap-analysis",
		title: "Do I Have the Right Insurance Coverage?",
		prompt:
			"Use the Moat MCP tools to get my spending breakdown and account overview. Then: (1) Identify what insurance premiums I'm currently paying — health, auto, home/renters, life, disability, umbrella — based on transaction patterns. (2) Flag likely coverage gaps given my financial profile: assets at risk, implied dependents, and property I hold. (3) Calculate what percentage of my monthly income goes to insurance premiums and whether that's proportionate. (4) Give me a prioritized list of gaps to address, with estimated cost ranges and the financial risk each gap exposes me to.",
		tags: ["insurance"],
		surfaces: ["prompt-library"],
	},
];
