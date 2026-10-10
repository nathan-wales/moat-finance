import type { InsightsTab } from "@moat/contracts";

export function insightsPageLabel(tab: InsightsTab): string {
	if (tab === "net-income") {
		return "net income";
	}
	return tab;
}

export function insightsFeatureRequestMessage(tab: InsightsTab): string {
	return `I'd like better charts on the ${insightsPageLabel(tab)} insights page: `;
}

export function insightsCustomReportPrompt(tab: InsightsTab): string {
	return `Use the Moat Finance MCP tools to generate a custom ${insightsPageLabel(tab)} report for me. Specifically: `;
}
