import type { AiPrompt } from "../types";

export const debtPrompts: AiPrompt[] = [
	{
		id: "debt-payoff-strategy",
		title: "What's the Best Way to Pay Off My Debt?",
		prompt:
			"Use the Moat MCP tools to get my accounts overview and budget status. Identify all debt accounts — credit cards, loans, lines of credit. Then: (1) List each debt with estimated balance, type, and any interest-rate context you can infer. (2) Model both the avalanche method (highest interest first) and the snowball method (smallest balance first) — compare projected payoff timelines and total interest paid for each. (3) Based on my current monthly cash flow surplus, recommend which method fits my situation better and how long full payoff would take. (4) Give me a concrete monthly payment allocation to start this month.",
		tags: ["debt"],
		surfaces: ["debt.accounts", "prompt-library"],
	},
];
