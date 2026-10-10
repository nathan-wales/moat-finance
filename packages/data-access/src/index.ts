// packages/data-access — repository interfaces and domain types.
// No Prisma. No runtime dependencies. Pure TypeScript.

export type {
	CategoryOverrideFields,
	ResolvedCategoryPresentation,
} from "./category-overrides";
export {
	applyCategoryOverride,
	defaultCategoryCapabilities,
	isEmptyCategoryOverride,
	POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL,
	POSTGRES_HIDDEN_CATEGORY_EXCLUSION_SQL,
	POSTGRES_RESOLVED_CATEGORY_NAME_SQL,
	SQLITE_CATEGORY_OVERRIDE_JOIN_SQL,
	SQLITE_HIDDEN_CATEGORY_EXCLUSION_SQL,
	SQLITE_RESOLVED_CATEGORY_NAME_SQL,
	sqliteCategoryNamesFilter,
	TRANSFER_CATEGORY_NAME,
	UNCATEGORIZED_CATEGORY_NAME,
} from "./category-overrides";
export type { AccountRepository } from "./repositories/AccountRepository";
export type {
	AiReportRecord,
	AiReportRepository,
	AiReportShareRecord,
	CreateAiReportRecordInput,
	CreateAiReportShareRecordInput,
	CreateAiReportVersionRecordInput,
	PublicReportShareRecord,
	UpdateAiReportRecordInput,
} from "./repositories/AiReportRepository";
export type {
	BudgetRepository,
	CategoryMonthAmount,
	CategoryMonthSpendRow,
	CategorySpendRow,
} from "./repositories/BudgetRepository";
export type { CategoryRepository } from "./repositories/CategoryRepository";
export type { DashboardRepository } from "./repositories/DashboardRepository";
export type { FinancialProfileDataRepository } from "./repositories/FinancialProfileDataRepository";
export type { FinancialProfileRepository } from "./repositories/FinancialProfileRepository";
export type { ForecastRepository } from "./repositories/ForecastRepository";
export type {
	CreateImportMappingTemplateInput,
	ImportMappingTemplateMapping,
	ImportMappingTemplateRecord,
	ImportMappingTemplateRepository,
	UpdateImportMappingTemplateInput,
} from "./repositories/ImportMappingTemplateRepository";
export type { InvestmentRepository } from "./repositories/InvestmentRepository";
export type {
	CreateMemoryInput,
	ListMemoriesInput,
	MemoryItem,
	MemoryRepository,
	UpdateMemoryInput,
} from "./repositories/MemoryRepository";
export type {
	PlaidAccountRepository,
	PlaidAccountSummary,
	UpdatePlaidForecastInputs,
} from "./repositories/PlaidAccountRepository";
export type {
	PlaidItemRepository,
	PlaidItemSummary,
} from "./repositories/PlaidItemRepository";
export type { RealEstateRepository } from "./repositories/RealEstateRepository";
export type {
	RetailMatchingApplyResult,
	RetailOrderImportInput,
	RetailOrderItemImportInput,
	RetailRepository,
	RetailSaveResult,
} from "./repositories/RetailRepository";
export type {
	CreateRetirementScenarioRecordInput,
	RetirementAccountSource,
	RetirementInsuranceSource,
	RetirementPlanningContext,
	RetirementPlanRecord,
	RetirementPropertySource,
	RetirementRepository,
	RetirementScenarioLeverRecord,
	RetirementScenarioRecord,
	RetirementSpendingCategoryPlanRecord,
	RetirementStandingRuleRecord,
	UpdateRetirementPlanRecordInput,
	UpdateRetirementScenarioRecordInput,
	UpsertRetirementSpendingCategoryPlanInput,
	UpsertRetirementStandingRuleRecordInput,
} from "./repositories/RetirementRepository";
export type { RuleRepository } from "./repositories/RuleRepository";
export type {
	CreateTaxDocumentInput,
	CreateTaxFactInput,
	TaxDocumentRecord,
	TaxFactConflictRecord,
	TaxFactRecord,
	TaxFormExtractionRecord,
	TaxPlanningAccount,
	TaxPlanningCategoryTotal,
	TaxPlanningProperty,
	TaxPlanningSources,
	TaxRepository,
	UpdateTaxDocumentInput,
	UpdateTaxFactInput,
} from "./repositories/TaxRepository";
// Repository interfaces
export type { TransactionRepository } from "./repositories/TransactionRepository";
export type { UserMetadataRepository } from "./repositories/UserMetadataRepository";
export type {
	ManualInvestmentSourceRow,
	OnboardingAgeHints,
	PlaidAccountSourceRow,
	PlanningContextSources,
	RealEstateSourceRow,
} from "./retirement-sources";
export {
	DEFAULT_TARGET_RETIREMENT_AGE,
	FORECAST_RATE_PLAID_TYPES,
	isPlaidCashAccountType,
	onboardingSeedsToApply,
	parseJsonColumn,
	parsePolicyFieldSource,
	parseRateString,
	parseRetirementLever,
	parseRetirementPolicies,
	parseRetirementSpendingOverrides,
	parseRetirementSpendingStages,
	parseRetirementStandingRule,
	parseRetirementTimelinePreferences,
	parseRetirementWithdrawalOrder,
	RETIREMENT_INVESTABLE_PLAID_TYPES,
	resolveOnboardingAgeHints,
	retirementBaselineVersionFrom,
	retirementPlanSeedsFromOnboarding,
	retirementPolicyColumns,
	retirementTaxTreatmentForSubtype,
	serializeRetirementLever,
	serializeRetirementStandingRule,
	shouldApplyOnboardingSeeds,
	toRetirementAccountSourceFromInvestment,
	toRetirementAccountSourceFromPlaid,
	toRetirementInsuranceSources,
	toRetirementPlanningContext,
	toRetirementPropertySource,
} from "./retirement-sources";
export {
	isSplitParentTransaction,
	POSTGRES_SPLIT_PARENT_EXCLUSION_SQL,
	SQLITE_SPLIT_PARENT_EXCLUSION_SQL,
	splitParentExclusionWhere,
} from "./split-parents";
// Types
export type {
	AccountSummary,
	ActiveRule,
	ApplyInvestmentAccrualInput,
	ApplyInvestmentAccrualsInput,
	CategoryBudgetEntry,
	CategoryMonthlySpend,
	CategorySpend,
	CategorySummary,
	CreateCategoryInput,
	CreateForecastScenarioInput,
	CreateInvestmentInput,
	CreateRealEstateInvestmentInput,
	CreateRuleInput,
	CreateTransactionInput,
	DashboardTransaction,
	FinancialProfile,
	ForecastScenario,
	Investment,
	InvestmentType,
	ManualInvestmentBalanceAccrualRecord,
	MonthlyTotals,
	PaginatedTransactions,
	RealEstateForecastScenario,
	RealEstateInvestment,
	RealEstatePropertyType,
	RealEstateUsageType,
	RuleAction,
	RuleActionType,
	RuleCondition,
	RuleConditionGroup,
	RuleField,
	RuleMatch,
	RuleOperator,
	TransactionListQuery,
	TransactionLocation,
	TransactionSummary,
	TransactionSummaryInput,
	TransactionType,
	UpdateCategoryInput,
	UpdateFinancialProfileInput,
	UpdateForecastScenarioInput,
	UpdateInvestmentInput,
	UpdateRealEstateInvestmentInput,
	UpdateRuleInput,
	UpdateTransactionInput,
	UpsertAccountInput,
} from "./types";
