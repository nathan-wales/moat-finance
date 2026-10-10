import type { AiPrompt } from "../types";

export const cashFlowPrompts: AiPrompt[] = [
	{
		id: "monthly-cash-flow-analysis",
		title: "Analyze My Monthly Cash Flow",
		prompt:
			"Use the Moat MCP tools to get my spending breakdown and forecast for the current month. Then: (1) Summarize total income vs. total expenses and whether I'm net positive or negative. (2) Flag the top three spending categories that deviated most from my recent average and explain why that matters. (3) Project whether I'll end the month with a surplus or deficit based on the current trajectory. (4) Suggest one concrete, high-leverage adjustment I could make right now to improve this month's outcome.",
		tags: ["cash-flow"],
		surfaces: ["cash-flow.chart", "prompt-library"],
	},
];
