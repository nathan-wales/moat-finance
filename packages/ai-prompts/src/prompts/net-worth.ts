import type { AiPrompt } from "../types";

export const netWorthPrompts: AiPrompt[] = [
	{
		id: "net-worth-breakdown",
		title: "Break Down My Net Worth",
		prompt:
			"Use the Moat MCP tools to retrieve my full account summary and profile. Then: (1) Organize all assets (cash, investments, property) and liabilities (debt, loans) into a clean net-worth snapshot. (2) Calculate my debt-to-asset ratio and liquid-asset ratio and interpret what they indicate about financial health. (3) Identify the single biggest lever I could pull to improve my net worth over the next 12 months. (4) Compare my asset composition to standard financial health benchmarks and flag any meaningful imbalances worth addressing.",
		tags: ["net-worth"],
		surfaces: ["net-worth.summary", "prompt-library"],
	},
];
