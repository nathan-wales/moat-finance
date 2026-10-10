import { cloudMcpToolNames, type McpToolName } from "./tools";

export const mcpClientProfiles = [
	"chatgpt",
	"openai-api",
	"claude",
	"gemini",
	"consumer",
	"cursor",
	"openclaw",
	"claude-desktop",
	"codex",
	"local-dev",
] as const;

export type McpClientProfile = (typeof mcpClientProfiles)[number];

export const publicClientProfiles = [
	"chatgpt",
	"openai-api",
	"claude",
	"gemini",
	"consumer",
	"claude-desktop",
	"codex",
] as const satisfies readonly McpClientProfile[];

export const defaultClientProfile: McpClientProfile = "local-dev";

/**
 * ChatGPT Apps v1: focused read-only personal-finance catalog.
 * Write tools remain registered for other profiles; expand this list for v2.
 */
export const chatgptReadOnlyToolNames = [
	"moat.listProfiles",
	"moat.getProfileSummary",
	"moat.getFinancialOverview",
	"moat.listAccounts",
	"moat.listTransactions",
	"moat.searchTransactions",
	"moat.getSpendingBreakdown",
	"moat.getBudgetStatus",
	"moat.listRecurringBills",
	"moat.getLiabilities",
	"moat.getNetWorth",
	"moat.listRealEstate",
	"moat.listAssets",
	"moat.getCashFlow",
	"moat.getInvestmentHoldings",
	"moat.getForecast",
	"moat.explainForecast",
	"moat.getRetirementPlan",
	"moat.getTaxYearSummary",
	"moat.getTaxReadiness",
	"moat.listRetirementScenarios",
	"moat.projectRetirementScenario",
	"moat.getSavedFinancialContext",
] as const satisfies readonly McpToolName[];

export const profileToolAllowlist: Record<
	McpClientProfile,
	readonly McpToolName[]
> = {
	chatgpt: chatgptReadOnlyToolNames,
	"openai-api": cloudMcpToolNames,
	claude: cloudMcpToolNames,
	gemini: cloudMcpToolNames,
	consumer: cloudMcpToolNames,
	cursor: cloudMcpToolNames,
	openclaw: cloudMcpToolNames,
	"claude-desktop": cloudMcpToolNames,
	codex: cloudMcpToolNames,
	"local-dev": cloudMcpToolNames,
};

export function isMcpClientProfile(
	profile: string,
): profile is McpClientProfile {
	return (mcpClientProfiles as readonly string[]).includes(profile);
}

export function getToolsForClientProfile(
	profile: McpClientProfile,
): readonly McpToolName[] {
	return profileToolAllowlist[profile];
}
