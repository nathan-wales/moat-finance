import { TAXES_PRODUCT_ENABLED } from "@moat/contracts";
import type { z } from "zod";
import { mcpToolOutputSchemas } from "./output-schemas";
import {
	applyRuleHistoricalInputSchema,
	applyRulesPreviewInputSchema,
	budgetStatusInputSchema,
	cashFlowInputSchema,
	commitTransactionImportInputSchema,
	compareRetirementScenariosInputSchema,
	createImportMappingTemplateInputSchema,
	createReportInputSchema,
	createRetirementScenarioInputSchema,
	createRuleInputSchema,
	deleteCategoryBudgetInputSchema,
	deleteImportMappingTemplateInputSchema,
	deleteRetirementScenarioInputSchema,
	deleteRuleInputSchema,
	deleteTransactionInputSchema,
	emptyImportMappingTemplateInputSchema,
	emptyInputSchema,
	explainForecastInputSchema,
	financialOverviewInputSchema,
	forecastInputSchema,
	getMemoriesInputSchema,
	investmentHoldingsInputSchema,
	liabilitiesInputSchema,
	listAssetsInputSchema,
	listNotificationRulesInputSchema,
	listRealEstateInputSchema,
	listRulesInputSchema,
	listTransactionsInputSchema,
	mcpCreateCommunityTipInputSchema,
	mcpCreateNotificationRuleInputSchema,
	mcpDeleteNotificationRuleInputSchema,
	mcpGetCommunityTipInputSchema,
	mcpListCommunityTipsInputSchema,
	mcpListMyCommunityTipsInputSchema,
	mcpPauseNotificationRuleInputSchema,
	mcpUpdateCommunityTipInputSchema,
	mcpUpdateNotificationRuleInputSchema,
	netWorthInputSchema,
	previewTransactionImportInputSchema,
	projectRetirementScenarioInputSchema,
	recurringBillsInputSchema,
	reportIdInputSchema,
	revokeShareInputSchema,
	runRetirementStressTestInputSchema,
	saveMemoryInputSchema,
	searchTransactionsInputSchema,
	setTransactionHashtagsInputSchema,
	shareReportInputSchema,
	solveRetirementGoalInputSchema,
	spendingBreakdownInputSchema,
	submitFeedbackInputSchema,
	taxGetDocumentInputSchema,
	taxIdInputSchema,
	taxListFactsInputSchema,
	taxSearchInputSchema,
	taxYearInputSchema,
	toggleRuleInputSchema,
	updateImportMappingTemplateInputSchema,
	updateReportInputSchema,
	updateRetirementScenarioInputSchema,
	updateRuleInputSchema,
	updateTransactionCategoryInputSchema,
	updateTransactionInputSchema,
	updateTransactionTypeInputSchema,
	upsertCategoryBudgetInputSchema,
} from "./schemas";
import type { McpScope } from "./scopes";

export const mcpToolNames = [
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
	"moat.listRetirementScenarios",
	"moat.projectRetirementScenario",
	"moat.compareRetirementScenarios",
	"moat.runRetirementStressTest",
	"moat.solveRetirementGoal",
	"moat.createRetirementScenario",
	"moat.updateRetirementScenario",
	"moat.deleteRetirementScenario",
	"moat.getTaxYearSummary",
	"moat.getTaxReadiness",
	"moat.listTaxDocuments",
	"moat.getTaxDocument",
	"moat.listTaxFacts",
	"moat.getTaxFact",
	"moat.getTaxIncomeSummary",
	"moat.getTaxWithholdingSummary",
	"moat.getTaxInvestmentSummary",
	"moat.getTaxRealEstateSummary",
	"moat.getTaxDeductionSummary",
	"moat.getTaxRetirementSummary",
	"moat.getTaxBusinessSummary",
	"moat.getTaxEstimatedPayments",
	"moat.getTaxPriorYearCarryforwards",
	"moat.getTaxMissingInformation",
	"moat.getTaxItemsNeedingReview",
	"moat.searchTaxData",
	"moat.listTransactionRules",
	"moat.createTransactionRule",
	"moat.updateTransactionRule",
	"moat.deleteTransactionRule",
	"moat.setTransactionRuleEnabled",
	"moat.previewRuleMatches",
	"moat.applyRuleToPastTransactions",
	"moat.updateTransactionCategory",
	"moat.updateTransaction",
	"moat.updateTransactionType",
	"moat.setTransactionHashtags",
	"moat.hideTransaction",
	"moat.previewTransactionImport",
	"moat.commitTransactionImport",
	"moat.listImportTemplates",
	"moat.createImportTemplate",
	"moat.updateImportTemplate",
	"moat.deleteImportTemplate",
	"moat.setCategoryBudget",
	"moat.deleteCategoryBudget",
	"moat.getSavedFinancialContext",
	"moat.saveFinancialContext",
	"moat.listReports",
	"moat.createReport",
	"moat.updateReport",
	"moat.deleteReport",
	"moat.shareReport",
	"moat.unshareReport",
	"moat.submitFeedback",
	"moat.listCommunityTips",
	"moat.getCommunityTip",
	"moat.listMyCommunityTips",
	"moat.createCommunityTip",
	"moat.updateCommunityTip",
	"moat.listNotificationRules",
	"moat.createNotificationRule",
	"moat.updateNotificationRule",
	"moat.setNotificationRulePaused",
	"moat.deleteNotificationRule",
] as const;

export type McpToolName = (typeof mcpToolNames)[number];

export type McpToolSafetyClass =
	| "read_only_app_data"
	| "mutates_app_data"
	| "mutates_user_financial_data";

export type McpToolContract = {
	name: McpToolName;
	title: string;
	description: string;
	inputSchema: z.ZodTypeAny;
	outputSchema: z.ZodTypeAny;
	requiredScopes: readonly McpScope[];
	safetyClass: McpToolSafetyClass;
	requiresConfirmation: boolean;
	widgetReady: boolean;
};

const mcpToolContractDefs = {
	"moat.listProfiles": {
		name: "moat.listProfiles",
		title: "List profiles",
		description:
			"Use this when the user has more than one financial profile, or before reading business finances separately from personal finances. Returns the profiles this account can access: id, kind (PERSONAL, FAMILY, or BUSINESS), display name, and whether a business profile is read-only because the plan no longer includes it. Pass a returned id as profileId on other read tools. Never combines profiles. Does not return email or account numbers.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getProfileSummary": {
		name: "moat.getProfileSummary",
		title: "Get profile summary",
		description:
			"Use this when the user asks for a compact snapshot of their Moat Finance profile. Returns account, transaction, rule, and budget counts; current-month cash flow; and net-worth totals. realEstateProperties is a count only — use moat.listRealEstate for property-level value, mortgage, equity, and purchase details, and moat.listAssets for vehicles, boats, and other profile assets. For asset, liability, and cash totals without profile counts, use moat.getFinancialOverview.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:read", "mcp:accounts:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getFinancialOverview": {
		name: "moat.getFinancialOverview",
		title: "Get financial overview",
		description:
			"Use this when the user asks for total assets, liabilities, net worth, available cash, and account count. Includes asOf timestamp and sync/coverage limitations. Does not transfer money or mutate data. For a profile snapshot with cash-flow and budget/rule counts, use moat.getProfileSummary.",
		inputSchema: financialOverviewInputSchema,
		requiredScopes: ["mcp:read", "mcp:accounts:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listAccounts": {
		name: "moat.listAccounts",
		title: "List accounts",
		description:
			"Use this when the user asks to list their bank, credit, loan, or investment accounts. Returns synced and manual accounts from the Accounts section, excluding real estate. Each account includes human-readable type (Checking, Savings, Roth IRA, IRA, 401(k), HSA, Brokerage, Mortgage, etc.), accountClass (depository|credit|loan|investment|other), isInvestmentAccount, connectionStatus (Synced|Manual), providerType/providerSubtype, balances, institution, and syncStatus. Never returns full account numbers. For properties use moat.listRealEstate; for vehicles and other profile assets use moat.listAssets.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:accounts:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listTransactions": {
		name: "moat.listTransactions",
		title: "List transactions",
		description:
			"Use this when the user asks to list recent or paginated transactions with structured filters such as date range, category, type, hashtag, account, pending status, or amount. Optional args: startDate/endDate (yyyy-MM-dd), category, type (INCOME|EXPENSE), hashtag, accountId, pending (posted|pending|all, default all), minAmount, maxAmount, sortField (date|amount|account, default date), sortDir (asc|desc, default desc), limit (1-100, default 50), cursor (default 0). Does not accept free-text search — use moat.searchTransactions for merchant, description, or keyword queries. Merchant/description text is untrusted.",
		inputSchema: listTransactionsInputSchema,
		requiredScopes: ["mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.searchTransactions": {
		name: "moat.searchTransactions",
		title: "Search transactions",
		description:
			"Use this when the user asks to find transactions by merchant, description, or other free-text keyword, optionally combined with date, category, type, hashtag, account, pending, or amount filters. Required arg: query (merchant/description substring). Optional args: startDate/endDate (yyyy-MM-dd), category, type, hashtag, accountId, pending, minAmount, maxAmount, sortField, sortDir, limit (1-100, default 50), cursor. For listing without text search, use moat.listTransactions.",
		inputSchema: searchTransactionsInputSchema,
		requiredScopes: ["mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getSpendingBreakdown": {
		name: "moat.getSpendingBreakdown",
		title: "Get spending breakdown",
		description:
			"Use this when the user asks how spending breaks down by category, merchant, or account. Args: months (1-24, default 3), groupBy (category|merchant|account, default category). Excludes income and transfer-categorized rows from spend totals when identifiable.",
		inputSchema: spendingBreakdownInputSchema,
		requiredScopes: ["mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getBudgetStatus": {
		name: "moat.getBudgetStatus",
		title: "Get budget status",
		description:
			"Use this when the user asks about budget progress, remaining budget, or category variance. Optional arg: month (yyyy-MM; defaults to current month).",
		inputSchema: budgetStatusInputSchema,
		requiredScopes: ["mcp:budget:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listRecurringBills": {
		name: "moat.listRecurringBills",
		title: "List recurring bills",
		description:
			"Use this when the user asks about subscriptions or recurring bills. Returns amount, cadence, next expected date, and status. Args: daysAhead (1-90, default 30), limit (1-100, default 50).",
		inputSchema: recurringBillsInputSchema,
		requiredScopes: ["mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getLiabilities": {
		name: "moat.getLiabilities",
		title: "Get liabilities",
		description:
			"Use this when the user asks about credit, loan, or mortgage balances. Returns liability balances with utilization where available. APR, minimum payment, and due dates are included only when stored; otherwise marked unavailable. No input args.",
		inputSchema: liabilitiesInputSchema,
		requiredScopes: ["mcp:accounts:read", "mcp:assets:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getNetWorth": {
		name: "moat.getNetWorth",
		title: "Get net worth",
		description:
			"Use this when the user asks for net worth and which assets or accounts are included. Returns assets, liabilities, net worth, coverage limitations, and optional detail arrays (includedAccounts, manualInvestments, realEstate, otherAssets). Arg: includeAccountDetails (boolean, default true). For full real-estate fields (purchase date, years owned, rates) use moat.listRealEstate; for vehicle/boat/other asset inventory use moat.listAssets. Not a guaranteed bank statement total.",
		inputSchema: netWorthInputSchema,
		requiredScopes: ["mcp:accounts:read", "mcp:assets:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listRealEstate": {
		name: "moat.listRealEstate",
		title: "List real estate",
		description:
			"Use this when the user asks for property-level real-estate details such as estimated value, loan/mortgage balance, equity, purchase price/date, years owned, interest rate, or monthly payment. No input args. moat.getProfileSummary only returns a property count.",
		inputSchema: listRealEstateInputSchema,
		requiredScopes: ["mcp:assets:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listAssets": {
		name: "moat.listAssets",
		title: "List assets",
		description:
			"Use this when the user asks to list non-real-estate profile assets (Vehicle, Boat, Business, Personal property, Collectible, Cash-like asset, Other), including estimated value and optional linked loan balance/equity. Optional args: includeNetWorthOnly (boolean, default false), types (array of asset type enums). Real estate is excluded — use moat.listRealEstate.",
		inputSchema: listAssetsInputSchema,
		requiredScopes: ["mcp:assets:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getCashFlow": {
		name: "moat.getCashFlow",
		title: "Get cash flow",
		description:
			"Use this when the user asks about inflows, outflows, transfers, or net cash flow for a period. Args: startDate and endDate (yyyy-MM-dd) for an explicit period, or omit both and use months (1-24, default 1) for a lookback window. Distinguishes posted vs pending where available and labels incomplete coverage.",
		inputSchema: cashFlowInputSchema,
		requiredScopes: ["mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getInvestmentHoldings": {
		name: "moat.getInvestmentHoldings",
		title: "Get investment holdings",
		description:
			"Use this when the user asks about investment account balances, holdings, or allocation. Security-level quantities and cost basis are included only when available; otherwise account-level allocation is returned with limitations.",
		inputSchema: investmentHoldingsInputSchema,
		requiredScopes: ["mcp:accounts:read", "mcp:assets:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getForecast": {
		name: "moat.getForecast",
		title: "Get cash-flow forecast",
		description:
			"Use this when the user asks for a future cash-flow or net-worth forecast. Returns a labeled estimate based on posted history and scenario assumptions. Args: scenarioId (optional saved scenario), years (1-50, default 10). Not a guaranteed outcome. Includes assumptions and data coverage.",
		inputSchema: forecastInputSchema,
		requiredScopes: ["mcp:forecast:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.explainForecast": {
		name: "moat.explainForecast",
		title: "Explain forecast",
		description:
			"Use this when the user asks why a forecast looks the way it does, including drivers, assumptions, risks, or data coverage. Args: scenarioId (optional), years (1-50, default 10), focus (cashflow|net_worth|spending|risk|summary, default summary). Labels outputs as estimates.",
		inputSchema: explainForecastInputSchema,
		requiredScopes: ["mcp:forecast:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getRetirementPlan": {
		name: "moat.getRetirementPlan",
		title: "Get retirement plan",
		description:
			"Use this when the user asks about their retirement plan, target or earliest retirement age, confidence, safe monthly spending, assets at retirement, or legacy. Returns Moat's stored baseline retirement overview. Optional args: none.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listRetirementScenarios": {
		name: "moat.listRetirementScenarios",
		title: "List retirement scenarios",
		description:
			"Use this when the user asks to list saved retirement scenarios. Returns names, lever summaries, and deep links for the authenticated user's scenarios.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.projectRetirementScenario": {
		name: "moat.projectRetirementScenario",
		title: "Project retirement scenario",
		description:
			"Use this when the user asks to project an ad-hoc or saved retirement scenario. Args: scenarioId (optional saved id), levers (optional typed lever list), includeBaseline (boolean, default false). A scenario is baseline plus ordered levers, not a copy of the plan.",
		inputSchema: projectRetirementScenarioInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.compareRetirementScenarios": {
		name: "moat.compareRetirementScenarios",
		title: "Compare retirement scenarios",
		description:
			"Use this when the user asks to compare saved retirement scenarios. Args: scenarioIds (1-3 ids), includeBaseline (optional boolean), trials (optional Monte Carlo trial count). Compares each scenario against the live baseline.",
		inputSchema: compareRetirementScenariosInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.runRetirementStressTest": {
		name: "moat.runRetirementStressTest",
		title: "Run retirement stress tests",
		description:
			"Use this when the user asks to run retirement stress tests against the baseline or a lever stack. Args: scenarioId (optional), levers (optional), trials (optional). Returns each test's confidence and the largest vulnerability.",
		inputSchema: runRetirementStressTestInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.solveRetirementGoal": {
		name: "moat.solveRetirementGoal",
		title: "Solve retirement goal",
		description:
			"Use this when the user asks to solve a retirement goal such as retire_by_age, monthly_spending, legacy_amount, confidence_target, or never_run_out. Args: objective (required discriminated union), levers (optional), scenarioId (optional). Returns ranked options with levers to apply.",
		inputSchema: solveRetirementGoalInputSchema,
		requiredScopes: ["mcp:retirement:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.createRetirementScenario": {
		name: "moat.createRetirementScenario",
		title: "Create retirement scenario",
		description:
			"Use this when the user asks to save a named retirement scenario. Args: name (required), description (optional), color (optional), source (optional), levers (required). Persists baseline plus typed levers and returns the projection plus a deep link.",
		inputSchema: createRetirementScenarioInputSchema,
		requiredScopes: ["mcp:retirement:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.updateRetirementScenario": {
		name: "moat.updateRetirementScenario",
		title: "Update retirement scenario",
		description:
			"Use this when the user asks to update a saved retirement scenario's name, description, pin state, or levers. Args: id (required), name/description/color/isPinned/sortOrder/levers (optional).",
		inputSchema: updateRetirementScenarioInputSchema,
		requiredScopes: ["mcp:retirement:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.deleteRetirementScenario": {
		name: "moat.deleteRetirementScenario",
		title: "Delete retirement scenario",
		description:
			"Permanently delete a saved retirement scenario. Args: id (required), confirmed (must be true).",
		inputSchema: deleteRetirementScenarioInputSchema,
		requiredScopes: ["mcp:retirement:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.getTaxYearSummary": {
		name: "moat.getTaxYearSummary",
		title: "Get tax year summary",
		description:
			"Return a compact tax-year summary: readiness score, documents present vs expected, confirmed vs potential income and deductions, withholding, estimate (or insufficient), and attention counts. Always include taxYear. Do not collapse confirmed and potential amounts. Not a filing result.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxReadiness": {
		name: "moat.getTaxReadiness",
		title: "Get tax readiness",
		description:
			"Return deterministic tax readiness for a tax year: score, formula, relevant categories, missing items, unresolved items, and review items. Always include taxYear. This is not IRS-ready and not a refund guarantee.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listTaxDocuments": {
		name: "moat.listTaxDocuments",
		title: "List tax documents",
		description:
			"List tax document metadata for a tax year (form type, issuer, processing state, fact count). Does not return original files or parsed text. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getTaxDocument": {
		name: "moat.getTaxDocument",
		title: "Get tax document",
		description:
			"Get one tax document by id with extracted fact summaries. Default is metadata only. Set includeParsedText true only when you need extracted text. Set includeOriginal true only when the user explicitly asked for the original file; even then this tool returns availability, not raw bytes.",
		inputSchema: taxGetDocumentInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.listTaxFacts": {
		name: "moat.listTaxFacts",
		title: "List tax facts",
		description:
			"List structured tax facts for a tax year, each with provenance (source type, form, box, document id) and status (confirmed, extracted, candidate, rejected). Always include taxYear. Optional filters: category, status, documentId. Never collapse candidate amounts into confirmed.",
		inputSchema: taxListFactsInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getTaxFact": {
		name: "moat.getTaxFact",
		title: "Get tax fact",
		description:
			"Get one tax fact by id with value, status, and provenance (document/form/box or transaction/account ids). Use this to answer 'where did this number come from?'",
		inputSchema: taxIdInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getTaxIncomeSummary": {
		name: "moat.getTaxIncomeSummary",
		title: "Get tax income summary",
		description:
			"Return confirmed vs potential income facts for a tax year with per-item provenance. Always include taxYear. Do not treat potential/candidate income as confirmed wages.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxWithholdingSummary": {
		name: "moat.getTaxWithholdingSummary",
		title: "Get tax withholding summary",
		description:
			"Return confirmed vs potential withholding facts for a tax year with provenance. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxInvestmentSummary": {
		name: "moat.getTaxInvestmentSummary",
		title: "Get tax investment summary",
		description:
			"Return confirmed vs potential investment tax facts (dividends, interest, 1099-B lots) for a tax year. Missing basis stays a review item — do not invent cost basis. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxRealEstateSummary": {
		name: "moat.getTaxRealEstateSummary",
		title: "Get tax real estate summary",
		description:
			"Return confirmed vs potential real-estate tax facts (1098 mortgage interest, property tax) for a tax year. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxDeductionSummary": {
		name: "moat.getTaxDeductionSummary",
		title: "Get tax deduction summary",
		description:
			"Return confirmed vs potential deductions for a tax year. Potential amounts are ledger inferences (for example donations) until the user confirms them. Always include taxYear. Never collapse confirmed and potential.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxRetirementSummary": {
		name: "moat.getTaxRetirementSummary",
		title: "Get tax retirement summary",
		description:
			"Return confirmed vs potential retirement tax facts (5498 contributions, distributions) for a tax year. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxBusinessSummary": {
		name: "moat.getTaxBusinessSummary",
		title: "Get tax business summary",
		description:
			"Return confirmed vs potential business tax facts (1099-NEC/MISC/K, Schedule C seeds) for a tax year. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxEstimatedPayments": {
		name: "moat.getTaxEstimatedPayments",
		title: "Get tax estimated payments",
		description:
			"Return confirmed vs potential estimated tax payments for a tax year. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getTaxPriorYearCarryforwards": {
		name: "moat.getTaxPriorYearCarryforwards",
		title: "Get prior-year tax carryforwards",
		description:
			"Return prior-year facts that may inform the selected tax year (carryforwards, prior AGI, filing status seeds). These are not current-year wages. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.getTaxMissingInformation": {
		name: "moat.getTaxMissingInformation",
		title: "Get missing tax information",
		description:
			"Return missing expected tax documents and facts for a tax year, with inspectable reasons. Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getTaxItemsNeedingReview": {
		name: "moat.getTaxItemsNeedingReview",
		title: "Get tax items needing review",
		description:
			"Return unresolved conflicts and review-needed tax items for a tax year (for example HSA mismatches or missing 1099-B basis). Always include taxYear.",
		inputSchema: taxYearInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.searchTaxData": {
		name: "moat.searchTaxData",
		title: "Search tax data",
		description:
			"Search tax facts for a tax year by type, form, box, or value text. Args: taxYear (required), query. Returns matching facts with provenance, capped at 50 results. Do not use this to dump an entire tax year.",
		inputSchema: taxSearchInputSchema,
		requiredScopes: ["mcp:tax:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.listTransactionRules": {
		name: "moat.listTransactionRules",
		title: "List transaction rules",
		description:
			"Use this when the user asks to list transaction categorization rules. Arg: includeInactive (boolean, default true) to include disabled rules. For financial alert or monitoring rules, use moat.listNotificationRules.",
		inputSchema: listRulesInputSchema,
		requiredScopes: ["mcp:rules:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.createTransactionRule": {
		name: "moat.createTransactionRule",
		title: "Create transaction rule",
		description:
			"Use this when the user asks to create a transaction categorization rule. This does not change existing transactions. To apply the rule to past transactions, create it, call moat.previewRuleMatches({ ruleId }) for totalCount, then call moat.applyRuleToPastTransactions.",
		inputSchema: createRuleInputSchema,
		requiredScopes: ["mcp:rules:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.updateTransactionRule": {
		name: "moat.updateTransactionRule",
		title: "Update transaction rule",
		description:
			"Use this when the user asks to replace the name, conditions, and actions of an existing transaction categorization rule. This affects future matching only. To apply the updated rule to past transactions, call moat.previewRuleMatches({ ruleId }), then moat.applyRuleToPastTransactions.",
		inputSchema: updateRuleInputSchema,
		requiredScopes: ["mcp:rules:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.deleteTransactionRule": {
		name: "moat.deleteTransactionRule",
		title: "Delete transaction rule",
		description:
			"Permanently delete a transaction categorization rule. Requires confirmed: true. Past transactions keep their current categories.",
		inputSchema: deleteRuleInputSchema,
		requiredScopes: ["mcp:rules:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.setTransactionRuleEnabled": {
		name: "moat.setTransactionRuleEnabled",
		title: "Set transaction rule enabled",
		description:
			"Use this when the user asks to enable or disable a transaction categorization rule without deleting it. Args: ruleId, isActive. Disabled rules stop matching future transactions.",
		inputSchema: toggleRuleInputSchema,
		requiredScopes: ["mcp:rules:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.previewRuleMatches": {
		name: "moat.previewRuleMatches",
		title: "Preview rule matches",
		description:
			"Use this when the user asks how many transactions would match a categorization rule, without applying changes. Provide either ruleId (existing rule) or conditions (proposed condition array); at least one is required. Returns a match count and a small sample.",
		inputSchema: applyRulesPreviewInputSchema,
		requiredScopes: ["mcp:rules:read", "mcp:transactions:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.applyRuleToPastTransactions": {
		name: "moat.applyRuleToPastTransactions",
		title: "Apply rule to past transactions",
		description:
			"Use this when the user asks to apply an existing active categorization rule to matching past transactions. Call moat.previewRuleMatches first, then pass confirmedPreviewCount and confirmed: true. Refuses to apply when the live match count differs from the confirmation.",
		inputSchema: applyRuleHistoricalInputSchema,
		requiredScopes: ["mcp:rules:write", "mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.updateTransactionCategory": {
		name: "moat.updateTransactionCategory",
		title: "Update transaction category",
		description:
			"Use this when the user asks to change a single transaction's category. Creates a user category if the name does not already exist.",
		inputSchema: updateTransactionCategoryInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.updateTransaction": {
		name: "moat.updateTransaction",
		title: "Update transaction",
		description:
			"Use this when the user asks to update a transaction's description, amount, or type. Required: transactionId. Provide at least one of description, amount, or type. Plaid-sourced transactions cannot change amount via this tool.",
		inputSchema: updateTransactionInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.updateTransactionType": {
		name: "moat.updateTransactionType",
		title: "Update transaction type",
		description:
			"Use this when the user asks to set a transaction type to INCOME or EXPENSE.",
		inputSchema: updateTransactionTypeInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.setTransactionHashtags": {
		name: "moat.setTransactionHashtags",
		title: "Set transaction hashtags",
		description:
			"Use this when the user asks to replace the hashtag set on a transaction. Pass an empty array to clear all hashtags.",
		inputSchema: setTransactionHashtagsInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.hideTransaction": {
		name: "moat.hideTransaction",
		title: "Hide transaction",
		description:
			"Use this when the user asks to hide a transaction from lists. Soft-hides the transaction; it is not permanently deleted from bank history. Requires confirmed: true.",
		inputSchema: deleteTransactionInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.previewTransactionImport": {
		name: "moat.previewTransactionImport",
		title: "Preview transaction import",
		description:
			"Preview a local transaction import without writing. Read CSV headers first, then pass mapping or templateId with csvText, filePath (absolute .csv, desktop only), rawRows, or JSON rows. Returns newCount, duplicateCount, invalidCount, sample, categoryColumnMapped, and uncategorizedWarning when no Category column is mapped and newCount is greater than 0. Desktop local MCP only.",
		inputSchema: previewTransactionImportInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.commitTransactionImport": {
		name: "moat.commitTransactionImport",
		title: "Commit transaction import",
		description:
			"Commit a local transaction import. Call moat.previewTransactionImport first with the same source (mapping or templateId plus csvText or filePath), then pass confirmed: true and confirmedNewCount matching the live preview newCount. Categorize rows in the CSV or map a Category column before commit. Desktop local MCP only.",
		inputSchema: commitTransactionImportInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.listImportTemplates": {
		name: "moat.listImportTemplates",
		title: "List import mapping templates",
		description:
			"List saved CSV column mapping templates for transaction import. Desktop local MCP only.",
		inputSchema: emptyImportMappingTemplateInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.createImportTemplate": {
		name: "moat.createImportTemplate",
		title: "Create import mapping template",
		description:
			"Save a CSV column mapping template (date, description, amount, optional type, category, and memo headers, optional accountId, isDefault). Desktop local MCP only.",
		inputSchema: createImportMappingTemplateInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.updateImportTemplate": {
		name: "moat.updateImportTemplate",
		title: "Update import mapping template",
		description:
			"Update a saved CSV column mapping template by id. Desktop local MCP only.",
		inputSchema: updateImportMappingTemplateInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.deleteImportTemplate": {
		name: "moat.deleteImportTemplate",
		title: "Delete import mapping template",
		description:
			"Delete a saved CSV column mapping template by id. Desktop local MCP only.",
		inputSchema: deleteImportMappingTemplateInputSchema,
		requiredScopes: ["mcp:transactions:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.setCategoryBudget": {
		name: "moat.setCategoryBudget",
		title: "Set category budget",
		description:
			"Use this when the user asks to create or update a monthly budget goal for a category. Args: monthlyGoal (>= 0) plus either categoryId or categoryName.",
		inputSchema: upsertCategoryBudgetInputSchema,
		requiredScopes: ["mcp:budget:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.deleteCategoryBudget": {
		name: "moat.deleteCategoryBudget",
		title: "Delete category budget",
		description:
			"Use this when the user asks to remove the monthly budget goal for a category. Args: confirmed must be true, plus either categoryId or categoryName.",
		inputSchema: deleteCategoryBudgetInputSchema,
		requiredScopes: ["mcp:budget:write"],
		safetyClass: "mutates_user_financial_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.getSavedFinancialContext": {
		name: "moat.getSavedFinancialContext",
		title: "Get saved financial context",
		description:
			"Use this when the user asks to retrieve financial goals, preferences, household context, or other durable financial context previously saved in their Moat Finance account. Optional args: category (memory category enum), search (substring on title/content). Do not use for general financial questions that do not require saved Moat data.",
		inputSchema: getMemoriesInputSchema,
		requiredScopes: ["mcp:memories:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.saveFinancialContext": {
		name: "moat.saveFinancialContext",
		title: "Save financial context",
		description:
			"Use this when the user explicitly asks to save a financial goal, preference, household context, business context, or other durable financial information to their Moat Finance account. Do not use for temporary facts, ordinary transactions, or information the user has not asked to save. Args: title, content, optional category.",
		inputSchema: saveMemoryInputSchema,
		requiredScopes: ["mcp:memories:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.listReports": {
		name: "moat.listReports",
		title: "List reports",
		description:
			"Use this when the user asks to list their Moat Finance reports. Returns report metadata (id, title, description, hasDocument, activeShare) without the full document content.",
		inputSchema: emptyInputSchema,
		requiredScopes: ["mcp:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.createReport": {
		name: "moat.createReport",
		title: "Create financial report",
		description:
			"Use this when the user asks to create a Moat Finance report from a structured JSON document. The document must use schemaVersion '1.0' with title, optional description, and blocks[]. Supported block types: markdown, section, statGrid, table, barChart, lineChart, pieChart, callout, divider, badgeRow, keyValueList. Do not include raw HTML, CSS, JavaScript, or arbitrary code. Invalid documents return a validation error.",
		inputSchema: createReportInputSchema,
		requiredScopes: ["mcp:reports:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.updateReport": {
		name: "moat.updateReport",
		title: "Update financial report",
		description:
			"Use this when the user asks to update an existing Moat Finance report. Pass reportId and any fields to change. Providing a new document replaces the report content and archives the previous version. Omit fields that should stay unchanged.",
		inputSchema: updateReportInputSchema,
		requiredScopes: ["mcp:reports:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.deleteReport": {
		name: "moat.deleteReport",
		title: "Delete financial report",
		description:
			"Use this when the user asks to remove a Moat Finance report. Soft-deletes the report so it is no longer accessible and revokes any public share link.",
		inputSchema: reportIdInputSchema,
		requiredScopes: ["mcp:reports:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.shareReport": {
		name: "moat.shareReport",
		title: "Share report",
		description:
			"Use this when the user asks to create a public share link for a Moat Finance report. Creates an immutable snapshot at a unique URL. Anyone with the URL can view the report. Returns the share URL.",
		inputSchema: shareReportInputSchema,
		requiredScopes: ["mcp:reports:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.unshareReport": {
		name: "moat.unshareReport",
		title: "Revoke report share",
		description:
			"Use this when the user asks to revoke a public report share link. The share URL immediately stops working. The private report is not deleted.",
		inputSchema: revokeShareInputSchema,
		requiredScopes: ["mcp:reports:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.submitFeedback": {
		name: "moat.submitFeedback",
		title: "Submit feedback",
		description:
			"Use this when the user asks to submit feedback about Moat Finance. Args: type (BUG, FEATURE_REQUEST, GENERAL, MCP_TOOL_ISSUE, or INCORRECT_RESULT; default GENERAL), message (10-2000 chars), optional relatedToolName, severity, userApproved, metadata. FEATURE_REQUEST, BUG, GENERAL, and INCORRECT_RESULT require userApproved: true. MCP_TOOL_ISSUE reports a failing MCP tool and should include relatedToolName; userApproved is not required for that type. Do not include balances, account numbers, emails, tokens, or raw transaction descriptions.",
		inputSchema: submitFeedbackInputSchema,
		requiredScopes: ["mcp:feedback:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.listCommunityTips": {
		name: "moat.listCommunityTips",
		title: "List community tips",
		description:
			"Use this when the user asks to browse approved public Community Tips. Optional args: query, sort (recommended|newest|most_liked), category, tipType, personallyTested, cursor, limit. Does not reveal anonymous author identities.",
		inputSchema: mcpListCommunityTipsInputSchema,
		requiredScopes: ["mcp:community-tips:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.getCommunityTip": {
		name: "moat.getCommunityTip",
		title: "Get community tip",
		description:
			"Use this when the user asks to view a Community Tip by id. Returns public approved tips, or the caller's own tip (including pending review). Does not reveal anonymous author identity for public tips.",
		inputSchema: mcpGetCommunityTipInputSchema,
		requiredScopes: ["mcp:community-tips:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.listMyCommunityTips": {
		name: "moat.listMyCommunityTips",
		title: "List my community tips",
		description:
			"Use this when the user asks to list Community Tips they submitted, including tips still in review.",
		inputSchema: mcpListMyCommunityTipsInputSchema,
		requiredScopes: ["mcp:community-tips:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.createCommunityTip": {
		name: "moat.createCommunityTip",
		title: "Create community tip",
		description:
			"Use this when the user explicitly asks to submit a financial tip to the Moat community. Creates a tip for moderation before it can become publicly visible. Supports public or anonymous attribution via attribution (PUBLIC or ANONYMOUS).",
		inputSchema: mcpCreateCommunityTipInputSchema,
		requiredScopes: ["mcp:community-tips:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: true,
	},
	"moat.updateCommunityTip": {
		name: "moat.updateCommunityTip",
		title: "Update community tip",
		description:
			"Use this when the user asks to update one of their Community Tips (title, body, attribution, or metadata). Content changes may re-trigger review.",
		inputSchema: mcpUpdateCommunityTipInputSchema,
		requiredScopes: ["mcp:community-tips:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.listNotificationRules": {
		name: "moat.listNotificationRules",
		title: "List notification rules",
		description:
			"Use this when the user asks to list their financial monitoring rules (alerts and summaries). For transaction categorization rules, use moat.listTransactionRules.",
		inputSchema: listNotificationRulesInputSchema,
		requiredScopes: ["mcp:notifications:read"],
		safetyClass: "read_only_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.createNotificationRule": {
		name: "moat.createNotificationRule",
		title: "Create notification rule",
		description:
			"Use this when the user asks to create a financial monitoring alert or summary. Uses a typed watchQuery (source, filter, window, measure, predicate, report, schedule, channels). Does not support custom SQL or code. Evaluations run about once per day, with transaction lookback limited to about 45 days. confirmed: true is required for email/push, immediate schedule, or balances/accounts_sync sources.",
		inputSchema: mcpCreateNotificationRuleInputSchema,
		requiredScopes: ["mcp:notifications:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.updateNotificationRule": {
		name: "moat.updateNotificationRule",
		title: "Update notification rule",
		description:
			"Use this when the user asks to update a financial monitoring rule. Uses the same typed watchQuery fields and limits as create. confirmed: true when adding email/push, switching to immediate, or using balances/accounts_sync sources.",
		inputSchema: mcpUpdateNotificationRuleInputSchema,
		requiredScopes: ["mcp:notifications:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
	"moat.setNotificationRulePaused": {
		name: "moat.setNotificationRulePaused",
		title: "Set notification rule paused",
		description:
			"Use this when the user asks to pause or resume a notification rule without deleting it. Args: id, paused (true to pause, false to resume).",
		inputSchema: mcpPauseNotificationRuleInputSchema,
		requiredScopes: ["mcp:notifications:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: false,
		widgetReady: false,
	},
	"moat.deleteNotificationRule": {
		name: "moat.deleteNotificationRule",
		title: "Delete notification rule",
		description:
			"Permanently delete a notification rule. Requires confirmed: true.",
		inputSchema: mcpDeleteNotificationRuleInputSchema,
		requiredScopes: ["mcp:notifications:write"],
		safetyClass: "mutates_app_data",
		requiresConfirmation: true,
		widgetReady: false,
	},
} as const satisfies Record<McpToolName, Omit<McpToolContract, "outputSchema">>;

export const mcpToolContracts = Object.fromEntries(
	mcpToolNames.map((name) => [
		name,
		{
			...mcpToolContractDefs[name],
			outputSchema: mcpToolOutputSchemas[name],
		},
	]),
) as unknown as Record<McpToolName, McpToolContract>;

export function getMcpToolContract(name: string): McpToolContract | undefined {
	if (!(mcpToolNames as readonly string[]).includes(name)) return undefined;
	return mcpToolContracts[name as McpToolName];
}

export function getMcpToolContracts(): McpToolContract[] {
	return mcpToolNames.map((name) => mcpToolContracts[name]);
}

const taxMcpToolNameSet = new Set<string>(
	mcpToolNames.filter((name) =>
		mcpToolContracts[name].requiredScopes.some((scope) =>
			scope.startsWith("mcp:tax:"),
		),
	),
);

export function isTaxMcpToolName(name: string): boolean {
	return taxMcpToolNameSet.has(name);
}

export function isShippedMcpToolName(name: string): boolean {
	return TAXES_PRODUCT_ENABLED || !isTaxMcpToolName(name);
}

export const desktopOnlyMcpToolNames = [
	"moat.previewTransactionImport",
	"moat.commitTransactionImport",
	"moat.listImportTemplates",
	"moat.createImportTemplate",
	"moat.updateImportTemplate",
	"moat.deleteImportTemplate",
] as const satisfies readonly McpToolName[];

export type DesktopOnlyMcpToolName = (typeof desktopOnlyMcpToolNames)[number];
export type CloudMcpToolName = Exclude<McpToolName, DesktopOnlyMcpToolName>;

const desktopOnlyMcpToolNameSet = new Set<string>(desktopOnlyMcpToolNames);

export function isDesktopOnlyMcpTool(name: string): boolean {
	return desktopOnlyMcpToolNameSet.has(name);
}

export const cloudMcpToolNames = mcpToolNames.filter(
	(name): name is CloudMcpToolName => !isDesktopOnlyMcpTool(name),
);
