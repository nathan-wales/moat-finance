import {
	getMcpToolContract,
	type McpToolName,
	type McpToolSafetyClass,
} from "@moat/mcp-contracts";

export type McpToolDomain =
	| "accounts"
	| "transactions"
	| "budget"
	| "forecast"
	| "retirement"
	| "taxes"
	| "rules"
	| "memories"
	| "reports"
	| "feedback"
	| "community-tips"
	| "notifications"
	| "profile"
	| "unknown";

export type DurationBucket = "<100" | "<500" | "<2000" | ">=2000";

const TOOL_DOMAIN_BY_NAME: Record<McpToolName, McpToolDomain> = {
	"moat.listProfiles": "profile",
	"moat.getProfileSummary": "profile",
	"moat.getFinancialOverview": "profile",
	"moat.listAccounts": "accounts",
	"moat.listTransactions": "transactions",
	"moat.searchTransactions": "transactions",
	"moat.getSpendingBreakdown": "budget",
	"moat.getBudgetStatus": "budget",
	"moat.listRecurringBills": "transactions",
	"moat.getLiabilities": "accounts",
	"moat.getNetWorth": "accounts",
	"moat.listRealEstate": "accounts",
	"moat.listAssets": "accounts",
	"moat.getCashFlow": "transactions",
	"moat.getInvestmentHoldings": "accounts",
	"moat.getForecast": "forecast",
	"moat.explainForecast": "forecast",
	"moat.getRetirementPlan": "retirement",
	"moat.listRetirementScenarios": "retirement",
	"moat.projectRetirementScenario": "retirement",
	"moat.compareRetirementScenarios": "retirement",
	"moat.runRetirementStressTest": "retirement",
	"moat.solveRetirementGoal": "retirement",
	"moat.createRetirementScenario": "retirement",
	"moat.updateRetirementScenario": "retirement",
	"moat.deleteRetirementScenario": "retirement",
	"moat.getTaxYearSummary": "taxes",
	"moat.getTaxReadiness": "taxes",
	"moat.listTaxDocuments": "taxes",
	"moat.getTaxDocument": "taxes",
	"moat.listTaxFacts": "taxes",
	"moat.getTaxFact": "taxes",
	"moat.getTaxIncomeSummary": "taxes",
	"moat.getTaxWithholdingSummary": "taxes",
	"moat.getTaxInvestmentSummary": "taxes",
	"moat.getTaxRealEstateSummary": "taxes",
	"moat.getTaxDeductionSummary": "taxes",
	"moat.getTaxRetirementSummary": "taxes",
	"moat.getTaxBusinessSummary": "taxes",
	"moat.getTaxEstimatedPayments": "taxes",
	"moat.getTaxPriorYearCarryforwards": "taxes",
	"moat.getTaxMissingInformation": "taxes",
	"moat.getTaxItemsNeedingReview": "taxes",
	"moat.searchTaxData": "taxes",
	"moat.listTransactionRules": "rules",
	"moat.createTransactionRule": "rules",
	"moat.updateTransactionRule": "rules",
	"moat.deleteTransactionRule": "rules",
	"moat.setTransactionRuleEnabled": "rules",
	"moat.previewRuleMatches": "rules",
	"moat.applyRuleToPastTransactions": "rules",
	"moat.updateTransactionCategory": "transactions",
	"moat.updateTransaction": "transactions",
	"moat.updateTransactionType": "transactions",
	"moat.setTransactionHashtags": "transactions",
	"moat.hideTransaction": "transactions",
	"moat.previewTransactionImport": "transactions",
	"moat.commitTransactionImport": "transactions",
	"moat.listImportTemplates": "transactions",
	"moat.createImportTemplate": "transactions",
	"moat.updateImportTemplate": "transactions",
	"moat.deleteImportTemplate": "transactions",
	"moat.setCategoryBudget": "budget",
	"moat.deleteCategoryBudget": "budget",
	"moat.getSavedFinancialContext": "memories",
	"moat.saveFinancialContext": "memories",
	"moat.listReports": "reports",
	"moat.createReport": "reports",
	"moat.updateReport": "reports",
	"moat.deleteReport": "reports",
	"moat.shareReport": "reports",
	"moat.unshareReport": "reports",
	"moat.submitFeedback": "feedback",
	"moat.listCommunityTips": "community-tips",
	"moat.getCommunityTip": "community-tips",
	"moat.listMyCommunityTips": "community-tips",
	"moat.createCommunityTip": "community-tips",
	"moat.updateCommunityTip": "community-tips",
	"moat.listNotificationRules": "notifications",
	"moat.createNotificationRule": "notifications",
	"moat.updateNotificationRule": "notifications",
	"moat.setNotificationRulePaused": "notifications",
	"moat.deleteNotificationRule": "notifications",
};

export function getToolDomain(toolName: string): McpToolDomain {
	const contract = getMcpToolContract(toolName);
	if (!contract) return "unknown";
	return TOOL_DOMAIN_BY_NAME[contract.name] ?? "unknown";
}

export function isWriteTool(
	safetyClass: McpToolSafetyClass | undefined,
): boolean {
	return (
		safetyClass === "mutates_app_data" ||
		safetyClass === "mutates_user_financial_data"
	);
}

export function durationBucket(durationMs: number): DurationBucket {
	if (durationMs < 100) return "<100";
	if (durationMs < 500) return "<500";
	if (durationMs < 2000) return "<2000";
	return ">=2000";
}

let currentTransport: "http" | "stdio" = "http";

export function setMcpAnalyticsTransport(transport: "http" | "stdio"): void {
	currentTransport = transport;
}

export function getMcpAnalyticsTransport(): "http" | "stdio" {
	return currentTransport;
}
