import type { AiPrompt } from "../types";

export const investingPrompts: AiPrompt[] = [
	{
		id: "hsa-eligibility",
		title: "Should I Open an HSA?",
		prompt:
			"Use the Moat MCP tools to retrieve my account summary, spending breakdown, and budget status. Then: (1) Summarize my current health-related and insurance expenses to infer whether I might be on a High-Deductible Health Plan. (2) Based on my monthly cash flow, estimate how much I could realistically contribute to an HSA this year. (3) Explain the triple tax advantage in concrete dollar terms for my situation. (4) Give me a clear yes/no recommendation and a 3-step action plan if I should open one.",
		tags: ["tax", "investing", "hsa"],
		surfaces: ["investments.hsa", "prompt-library"],
	},
	{
		id: "retirement-on-track",
		title: "Am I On Track for Retirement?",
		prompt:
			"Use the Moat MCP tools to get my account overview, spending breakdown, and forecast. Then: (1) Estimate my current monthly savings rate as a percentage of net income. (2) Assess whether I'm on track for a comfortable retirement using standard benchmarks (25x annual expenses, 4% withdrawal rule). (3) Identify whether I'm leaving employer match or tax-advantaged contribution headroom unused. (4) Give me a clear verdict — on track, behind, or ahead — with three specific, prioritized steps to strengthen my position.",
		tags: ["investing", "goals"],
		surfaces: ["goals.empty", "prompt-library"],
	},
	{
		id: "investment-rebalance",
		title: "Should I Rebalance My Portfolio?",
		prompt:
			"Use the Moat MCP tools to get my full account and investment overview. Then: (1) Map out my investment accounts and infer the asset class mix from available data. (2) Compare my current allocation to a target appropriate for my financial profile — consider age implied by account history and apparent risk tolerance. (3) Identify which asset classes are meaningfully over- or under-weight (>5% drift). (4) Give me a concrete rebalancing action plan: what to trim, what to add, and how to execute with minimal tax impact.",
		tags: ["investing"],
		surfaces: ["prompt-library"],
	},
];
