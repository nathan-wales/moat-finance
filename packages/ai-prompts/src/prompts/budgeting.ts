import type { AiPrompt } from "../types";

export const budgetingPrompts: AiPrompt[] = [
	{
		id: "budget-improvement-top3",
		title: "Where Should I Cut Spending?",
		prompt:
			"Use the Moat MCP tools to retrieve my budget status and spending breakdown. Then: (1) Identify the three categories where I'm most over budget or spending the most relative to my income. (2) For each category, give me a specific, realistic monthly reduction target and at least two actionable tactics to hit it. (3) Calculate how much I'd save annually by hitting all three targets. (4) Rank the opportunities by impact-to-effort ratio so I know where to start.",
		tags: ["budgeting", "cash-flow"],
		surfaces: ["budgeting.overview", "prompt-library"],
	},
	{
		id: "emergency-fund-check",
		title: "Do I Have a Strong Enough Emergency Fund?",
		prompt:
			"Use the Moat MCP tools to get my budget status, spending breakdown, and account overview. Then: (1) Calculate my average monthly essential expenses — housing, food, utilities, insurance, minimum debt payments. (2) Identify which accounts hold liquid savings accessible in an emergency. (3) Compute how many months of essential expenses my current liquid savings cover. (4) Give me a clear verdict (under-funded, adequate, or over-funded), a specific savings target if I'm below 3–6 months, and a timeline to get there based on my current surplus.",
		tags: ["goals", "budgeting"],
		surfaces: ["prompt-library"],
	},
];
