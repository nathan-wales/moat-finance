/**
 * Runtime-agnostic API client interface.
 *
 * Web injects an HttpApiClient that wraps @moat/client-ts.
 * Desktop injects an IpcApiClient that calls window.moatDesktop IPC channels.
 *
 * Feature hooks call useApiClient() — never @moat/client-ts directly.
 */

import type {
	CommunityTipAdminDetail,
	CommunityTipFeedResponse,
	CommunityTipFeedSort,
	CommunityTipOwnerDetail,
	CommunityTipPublicDetail,
	CommunityTipPublicSummary,
	CommunityTipStatus,
	CommunityTipTransactionRecommendation,
	CreateCommunityTipInput,
	ListCommunityTipsInput,
	UpdateCommunityTipInput,
} from "@moat/community-tips";
import type { CategoryParent } from "./category-parent";
import type { AccountSummary } from "./domain/transactions";
import type { FinancialProfileData } from "./financial-profile-data";
import type {
	ListMileageTripsInput,
	MileageTrip,
	MileageTripList,
	UpdateMileageTripInput,
	UpsertMileageTripInput,
} from "./mileage";
import type { OnboardingAccountSources } from "./onboarding";
import type {
	CommunityPromptDetail,
	CommunityPromptSummary,
	CreateUserPromptInput,
	GeneratePromptDraftInput,
	GeneratePromptDraftResult,
	ModerationQueueItem,
	PromptCategory,
	PromptLaunchCountSummary,
	PromptLibrarySource,
	PromptModerationEventSummary,
	PromptPinSummary,
	PromptReviewStatus,
	RecordPromptLaunchInput,
	RecordPromptLaunchResult,
	TogglePromptPinInput,
	TogglePromptPinResult,
	UpdateUserPromptInput,
	UserPromptDetail,
	UserPromptSummary,
} from "./prompt";
import type {
	CompareRetirementScenariosInput,
	CreateRetirementScenarioInput,
	DuplicateRetirementScenarioInput,
	GetRetirementOpportunitiesInput,
	ProjectRetirementScenarioInput,
	RetirementComparison,
	RetirementGoalSeekResponse,
	RetirementMonteCarloResult,
	RetirementOpportunitiesResponse,
	RetirementPlanOverview,
	RetirementPlanSettings,
	RetirementProjectionResponse,
	RetirementScenario,
	RetirementSpendingPlan,
	RetirementStressTestsResponse,
	RunRetirementMonteCarloInput,
	RunRetirementStressTestsInput,
	SolveRetirementGoalInput,
	UpdateRetirementPlanInput,
	UpdateRetirementScenarioInput,
	UpdateRetirementSpendingPlanInput,
} from "./retirement";
import type {
	DeleteRetirementStandingRuleInput,
	RetirementStandingRule,
	UpsertRetirementStandingRuleInput,
} from "./retirement-policies";
import type {
	TaxAgentContext,
	TaxConfirmFactInput,
	TaxCreateManualFactInput,
	TaxDocument,
	TaxDocumentDetail,
	TaxFact,
	TaxFactConflict,
	TaxGetDocumentInput,
	TaxListFactsInput,
	TaxOverview,
	TaxReadiness,
	TaxRenameDocumentInput,
	TaxResolveConflictInput,
	TaxSearchInput,
	TaxUpdateFactInput,
	TaxUploadDocumentInput,
	TaxYearInput,
	TaxYearProfile,
	TaxYearsResponse,
} from "./taxes";

export type {
	AccountSummary,
	CommunityTipAdminDetail,
	CommunityTipFeedResponse,
	CommunityTipFeedSort,
	CommunityTipOwnerDetail,
	CommunityTipPublicDetail,
	CommunityTipPublicSummary,
	CommunityTipStatus,
	CommunityTipTransactionRecommendation,
	CreateCommunityTipInput,
	FinancialProfileData,
	ListCommunityTipsInput,
	UpdateCommunityTipInput,
};

// ─── Overview / Dashboard ─────────────────────────────────────────────────────

export type SummaryMetrics = {
	avgExpenses: number;
	avgIncome: number;
	avgNetGain: number;
	monthCount: number;
};

export type MonthlyAggregate = {
	month: string;
	income: number;
	expenses: number;
	netGain: number;
};

export type MonthlyAggregatesResponse = {
	avgNetGain: number;
	months: MonthlyAggregate[];
};

export type BalanceSnapshotPoint = {
	month: string;
	total: number;
};

export type BalanceSnapshotHistoryResponse = {
	historical: BalanceSnapshotPoint[];
	forecast: BalanceSnapshotPoint[];
};

export type AssetHistorySource = "PLAID" | "INVESTMENT" | "REAL_ESTATE";

export type AssetValueHistoryResponse = {
	current: number;
	points: BalanceSnapshotPoint[];
};

export type AccountBalanceHistoryPoint = {
	date: string;
	balance: number;
};

export type AccountBalanceHistoryResponse = {
	currentBalance: number;
	points: AccountBalanceHistoryPoint[];
};

export type AccountHolding = {
	securityId: string;
	name: string | null;
	tickerSymbol: string | null;
	securityType: string | null;
	quantity: number;
	price: number | null;
	value: number;
	costBasis: number | null;
	currency: string;
};

export type AccountHoldingsResponse = {
	holdings: AccountHolding[];
	totalValue: number;
	lastSyncedAt: string | null;
};

// ─── Portfolio / Investments ──────────────────────────────────────────────────

export type PortfolioAllocationItem = {
	id: string;
	name: string;
	subtitle?: string;
	lastSynced?: string;
	value: number;
};

export type PortfolioAllocationSectionKey =
	| "stocks"
	| "rothIra"
	| "401k"
	| "cash"
	| "hsa"
	| "realEstate";

export type PortfolioAllocationSection = {
	key: PortfolioAllocationSectionKey;
	label: string;
	value: number;
	items: PortfolioAllocationItem[];
};

export type PortfolioAllocationResponse = {
	sections: PortfolioAllocationSection[];
};

// ─── Cash Flow ────────────────────────────────────────────────────────────────

export type CashFlowNodeKind =
	| "income_stream"
	| "income"
	| "expense"
	| "savings";

export type CashFlowNode = {
	name: string;
	kind: CashFlowNodeKind;
	amount: number;
};

export type CashFlowLink = {
	source: number;
	target: number;
	value: number;
};

export type CashFlowResponse = {
	month: string;
	startDate: string;
	endDate: string;
	totalIncome: number;
	totalExpenses: number;
	netSavings: number;
	nodes: CashFlowNode[];
	links: CashFlowLink[];
};

// ─── Transactions ─────────────────────────────────────────────────────────────

export type TransactionType = "INCOME" | "EXPENSE";

export type TransactionHashtag = {
	hashtag: {
		id?: string | null;
		name: string;
		normalizedName: string;
	};
};

export type TransactionLocation = {
	address: string | null;
	city: string | null;
	region: string | null;
	postal_code: string | null;
	country: string | null;
	lat: number | null;
	lon: number | null;
	store_number: string | null;
};

export type Transaction = {
	id: string;
	date: string;
	description: string | null;
	originalDescription?: string | null;
	notes?: string | null;
	amount: number;
	type: TransactionType;
	category: string;
	categoryRef?: {
		id?: string | null;
		name: string;
		icon?: string | null;
		color?: string | null;
		isHidden?: boolean;
		isDefault?: boolean;
	} | null;
	account: string | null;
	accountId?: string | null;
	hashtags?: TransactionHashtag[];
	appliedRuleId?: string | null;
	splitGroupId?: string | null;
	splitParentId?: string | null;
	hidden?: boolean;
	pending?: boolean;
	source?: string | null;
	location?: TransactionLocation | null;
	amazonRetailEnrichedAt?: string | null;
};

export type TransactionListInput = {
	cursor?: number;
	limit?: number;
	search?: string;
	category?: string;
	categories?: string[];
	hashtag?: string;
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	startDate?: string;
	endDate?: string;
	type?: TransactionType;
	sortField?: "date" | "amount" | "account";
	sortDir?: "asc" | "desc";
	retailLinkedRetailer?: "amazon";
};

export type TransactionListResponse = {
	items: Transaction[];
	nextCursor?: number | null;
};

export type RecentIncomeTransaction = Transaction & {
	name: string;
	accountName?: string;
};

export type TransactionCountInput = {
	search?: string;
	category?: string;
	categories?: string[];
	hashtag?: string;
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	startDate?: string;
	endDate?: string;
	type?: TransactionType;
	retailLinkedRetailer?: "amazon";
};

export type TransactionSummaryInput = {
	search?: string;
	category?: string;
	categories?: string[];
	hashtag?: string;
	accountId?: string;
	accountIds?: string[];
	minAmount?: number;
	maxAmount?: number;
	startDate?: string;
	endDate?: string;
	type?: TransactionType;
	retailLinkedRetailer?: "amazon";
};

export type TransactionSummaryResponse = {
	totalIncome: number;
	totalExpenses: number;
	netGain: number;
	transactionCount: number;
	incomeCount: number;
	expenseCount: number;
	largestTransaction: number | null;
	largestTransactionId: string | null;
	largestExpense: number | null;
	largestExpenseId: string | null;
	averageTransaction: number | null;
	firstTransactionDate: string | null;
	firstTransactionId: string | null;
	lastTransactionDate: string | null;
	lastTransactionId: string | null;
};

export type UpdateTransactionInput = {
	id: string;
	description?: string;
	amount?: number;
	type?: TransactionType;
	category?: string;
	hashtags?: string[];
	notes?: string | null;
};

export type UpdateTransactionFieldsInput = {
	id: string;
	description?: string;
	amount?: number;
	type?: TransactionType;
	notes?: string | null;
};

export type UpdateTransactionCategoryInput = {
	id: string;
	categoryName: string;
};

export type SetTransactionHashtagsInput = {
	transactionId: string;
	hashtags: string[];
};

export type SplitLegInput = {
	id?: string;
	description: string;
	amount: number;
	categoryName: string;
	hashtags: string[];
	notes?: string | null;
	hidden?: boolean;
	date?: string;
};

export type SplitTransactionInput = {
	id: string;
	type: TransactionType;
	legs: SplitLegInput[];
};

export type SplitGroup = {
	original: Transaction;
	legs: Transaction[];
};

export type RetailTransactionDetection = {
	candidates?: unknown[];
	extensionStatus?: string;
	hasActionableSync: boolean;
	retailer: "amazon" | "walmart" | "target" | "multiple" | string;
	unlinkedDetectedCount: number;
};

// ─── Budget ───────────────────────────────────────────────────────────────────

export type BudgetStatus =
	| "on-track"
	| "close-to-budget"
	| "overspending"
	| "no-spend"
	| "unknown";

export type CategoryBudgetAlerts = {
	enabled: boolean;
	thresholds: number[];
};

export type CategoryBudgetRow = {
	categoryId: string;
	categoryName: string;
	spentThisMonth: number;
	monthlyGoal?: number | null;
	expectedSpendToDate: number;
	status: BudgetStatus;
	parentCategory: CategoryParent | null;
	alerts: CategoryBudgetAlerts | null;
};

export type BudgetReportingPeriod = {
	dayOfMonth: number;
	daysInMonth: number;
	startDate: string;
	endDate: string;
	isDemoSnapshot: boolean;
};

export type BudgetPageData = {
	categories: CategoryBudgetRow[];
	totalBudget: number;
	actualSpent: number;
	remaining: number;
	expectedByNow: number;
	progressPercent: number;
	dayOfMonth: number;
	daysInMonth: number;
	status: BudgetStatus;
	statusMessage: string;
	reportingPeriod: BudgetReportingPeriod;
};

export type UpdateCategoryBudgetInput = {
	category: string;
	amount: number | null;
};

export type MonthlySpend = {
	month: string;
	amount: number;
};

export type CategoryBudgetDetail = {
	categoryId: string;
	categoryName: string;
	spentThisMonth: number;
	monthlyGoal?: number | null;
	lastMonthSpend: number;
	sixMonthAverage: number;
	suggestedBudget: number;
	monthlyTrend: MonthlySpend[];
};

export type SpendingInput = {
	months?: number;
	startDate?: string;
	endDate?: string;
	expenseCategories?: string[];
};

export type CategoryBreakdown = {
	category: string;
	total: number;
	percentage: number;
	monthlyAvg: number;
	percentOfTop: number;
	parentCategory: CategoryParent | null;
};

export type SpendingBreakdownResponse = CategoryBreakdown[];

export type SpendingTrendMonth = {
	month: string;
	[key: string]: unknown;
};

export type SpendingTrendsResponse = {
	months: SpendingTrendMonth[];
	categories: string[];
};

export type SpendingAnomaly = {
	category: string;
	currentAmount: number;
	averageAmount: number;
	ratio: number;
};

export type SpendingAnomaliesResponse = SpendingAnomaly[];

export type RecurringExpense = {
	description: string;
	monthlyAmount: number;
	occurrences: number;
};

export type RecurringExpensesResponse = RecurringExpense[];

export type InsightsPeriod =
	| "this-week"
	| "last-week"
	| "this-month"
	| "last-month"
	| "1m"
	| "2m"
	| "3m"
	| "6m"
	| "12m"
	| "custom";
export type InsightsTab = "net-income" | "income" | "spending";

export type InsightsCategoryActivity = {
	income: string[];
	expense: string[];
};

export type InsightsInput = {
	period: InsightsPeriod;
	startDate?: string;
	endDate?: string;
	incomeCategories?: string[];
	expenseCategories?: string[];
};

export type IncomeInsightsData = {
	totalIncome: number;
	primarySource: { name: string; amount: number } | null;
	recurringIncome: number;
	oneTimeIncome: number;
	incomeTrend: Array<{ date: string; amount: number }>;
	incomeSources: Array<{ source: string; amount: number }>;
	recentIncomeTransactions: RecentIncomeTransaction[];
};

export type NetIncomeInsightsData = {
	totalIncome: number;
	totalSpending: number;
	netIncome: number;
	savingsRate: number | null;
	incomeVsSpending: Array<{ date: string; income: number; spending: number }>;
	netIncomeTrend: Array<{ date: string; netIncome: number }>;
	savingsRateTrend: Array<{ date: string; savingsRate: number | null }>;
	spendingBreakdown: Array<{
		category: string;
		amount: number;
		parentCategory: CategoryParent | null;
	}>;
};

// ─── What If ─────────────────────────────────────────────────────────────────

export type WhatIfMonthlyItemType = "income" | "expense" | "savings" | "debt";

export type WhatIfMonthlyLineItem = {
	id: string;
	name: string;
	type: WhatIfMonthlyItemType;
	monthlyAmount: number;
	category?: string;
	isBaseline: boolean;
};

export type WhatIfBaselineResponse = {
	baselineItems: WhatIfMonthlyLineItem[];
	baselineIncome: number;
	baselineExpenses: number;
	baselineSavings: number;
	baselineDebt: number;
};

export type WhatIfBaselineMonths = 1 | 2 | 3 | 6 | 12;

export type GetWhatIfBaselineInput = {
	months?: WhatIfBaselineMonths;
};

// ─── Rules ────────────────────────────────────────────────────────────────────

export type RuleConditionField =
	| "MERCHANT"
	| "DESCRIPTION"
	| "AMOUNT"
	| "CATEGORY"
	| "DATE"
	| "ACCOUNT"
	| "NOTES";

export type RuleConditionOperator =
	| "CONTAINS"
	| "NOT_CONTAINS"
	| "STARTS_WITH"
	| "ENDS_WITH"
	| "EQUALS"
	| "NOT_EQUALS"
	| "GREATER_THAN"
	| "GREATER_THAN_OR_EQUAL"
	| "LESS_THAN"
	| "LESS_THAN_OR_EQUAL"
	| "IS_EMPTY"
	| "IS_NOT_EMPTY"
	| "BEFORE"
	| "AFTER"
	| "ON"
	| "BETWEEN";

export type RuleCondition = {
	id?: string;
	field: RuleConditionField | string;
	operator: RuleConditionOperator | string;
	valueText?: string | null;
	valueNumber?: number | null;
	valueDate?: string | Date | null;
	secondValueNumber?: number | null;
	secondValueDate?: string | Date | null;
	sortOrder?: number;
	groupId?: string;
};

export type RuleMatch = "ALL" | "ANY";

export type RuleConditionGroup = {
	id?: string;
	match: RuleMatch;
	sortOrder?: number;
	conditions: RuleCondition[];
};

export type RuleActionType =
	| "SET_CATEGORY"
	| "SET_DESCRIPTION"
	| "SET_TYPE"
	| "ADD_HASHTAG";

export type RuleAction = {
	id?: string;
	type: RuleActionType | string;
	valueText?: string | null;
	hashtagId?: string | null;
	hashtagName?: string | null;
	hashtag?: { id: string; name: string } | null;
	sortOrder?: number;
};

export type TransactionRule = {
	id: string;
	name: string;
	match?: RuleMatch;
	conditions: RuleCondition[];
	conditionGroups?: RuleConditionGroup[];
	actions: RuleAction[];
	isActive: boolean;
	priority: number;
	createdAt: string;
	updatedAt: string;
};

export type CreateRuleInput = {
	name: string;
	match?: RuleMatch;
	conditions: RuleCondition[];
	conditionGroups?: RuleConditionGroup[];
	actions: RuleAction[];
};

export type UpdateRuleInput = Partial<CreateRuleInput> & {
	isActive?: boolean;
	priority?: number;
};

export type RulePreviewTransaction = {
	id: string;
	date: string;
	description?: string | null;
	amount: number;
	type: string;
	category: string;
	account?: string | null;
	hashtags: string[];
};

export type PreviewRuleConditionsInput = {
	match?: RuleMatch;
	conditions: RuleCondition[];
	conditionGroups?: RuleConditionGroup[];
	appliedRuleId?: string;
	limit?: number;
};

export type PreviewRuleConditionsResult = {
	preview: RulePreviewTransaction[];
	totalCount: number;
};

export type ApplyRuleHistoricalInput = {
	id: string;
};

export type ApplyRuleHistoricalUpdate = {
	id: string;
	description?: string | null;
	type?: string;
	category?: string;
	categoryRef?: { name: string } | null;
	addedHashtagNames?: string[];
};

export type ApplyRuleHistoricalResult = {
	affected: number;
	deletedIds: string[];
	updates: ApplyRuleHistoricalUpdate[];
};

export type LinkRuleToTransactionInput = {
	ruleId: string;
	transactionId: string;
};

// ─── AI Reports ───────────────────────────────────────────────────────────────

export type ReportVisibility = "PRIVATE" | "SHARE_LINK" | "PUBLIC";
export type AiReportCreatedBy = "AGENT" | "USER" | "SYSTEM";

/** V2 Moat Finance Canvas report — uses structured JSON document. */
export type AiReport = {
	id: string;
	title: string;
	description?: string | null;
	/** V2 structured document (Moat Finance Canvas JSON). Null for legacy HTML reports. */
	document?: unknown | null;
	/** V1 legacy fields — present on old HTML-based reports only. */
	sanitizedHtml: string;
	sanitizedCss: string;
	visibility: ReportVisibility;
	createdBy: AiReportCreatedBy;
	/** Legacy share slug on the report itself (V1 only). */
	shareSlug?: string | null;
	/** V2 active share record, if one exists. */
	activeShare?: AiReportShareSummary | null;
	createdAt: string;
	updatedAt: string;
};

export type AiReportSummary = Omit<
	AiReport,
	"sanitizedHtml" | "sanitizedCss" | "document"
> & {
	hasDocument: boolean;
};

/** A V2 share snapshot (AiReportShare record). */
export type AiReportShareSummary = {
	id: string;
	shareSlug: string;
	isEnabled: boolean;
	createdAt: string;
	updatedAt: string;
};

/** Public-facing share snapshot (rendered by the public /r/[slug] page). */
export type PublicReportShare = {
	title: string;
	description?: string | null;
	document?: unknown | null;
	/** V1 legacy */
	sanitizedHtml: string;
	sanitizedCss: string;
};

/** V2: create with a Moat Finance Canvas document. */
export type CreateAiReportInput =
	| {
			title: string;
			description?: string | null;
			document: unknown;
			visibility?: "private";
	  }
	| {
			/** V1 legacy */
			title: string;
			description?: string | null;
			html: string;
			css: string;
			visibility?: "private" | "share_link";
	  };

/** V2: update with a Moat Finance Canvas document or legacy html/css. */
export type UpdateAiReportInput = {
	reportId: string;
	title?: string;
	description?: string | null;
	/** V2: new document */
	document?: unknown;
	/** V1 legacy */
	html?: string;
	css?: string;
	visibility?: "private" | "share_link" | "public";
};

export type CreateSnapshotResult = {
	shareId: string;
	shareSlug: string;
};

// ─── Settings / Profile ───────────────────────────────────────────────────────

export type FinancialProfile = {
	monthlyIncome?: number;
	monthlyExpenses?: number;
	savingsGoal?: number;
	currency?: string;
};

export type UpdateFinancialProfileInput = Partial<FinancialProfile>;

// ─── Categories ──────────────────────────────────────────────────────────────

export type Category = {
	id: string;
	name: string;
	icon: string | null;
	color: string;
	isHidden: boolean;
	isDefault: boolean;
	sortOrder: number;
	isRemoved?: boolean;
	canDelete?: boolean;
	canHide?: boolean;
	parentCategory: CategoryParent | null;
};

export type CreateCategoryInput = {
	name: string;
	icon?: string | null;
	color?: string;
	parentCategory?: CategoryParent | null;
};

export type UpdateCategoryInput = {
	id: string;
	name: string;
	icon?: string | null;
	color?: string;
	parentCategory?: CategoryParent | null;
};

export type ToggleCategoryHiddenInput = {
	id: string;
	isHidden: boolean;
};

// ─── Scenarios ───────────────────────────────────────────────────────────────

export type ScenarioType =
	| "CONSERVATIVE"
	| "STANDARD"
	| "AGGRESSIVE"
	| "CUSTOM";

export type ForecastScenario = {
	id: string;
	name: string;
	type: ScenarioType | string;
	investmentReturn: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
	isActive: boolean;
};

export type CreateScenarioInput = {
	name: string;
	type: ScenarioType;
	investmentReturn: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
};

export type UpdateScenarioInput = {
	id: string;
	name?: string;
	investmentReturn?: number;
	inflationRate?: number;
	salaryGrowth?: number;
	contributionChange?: number;
	expenseGrowth?: number;
	isActive?: boolean;
};

export type ConnectionSyncResult = {
	success: boolean;
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	accountCount: number;
	balancesRefreshed: boolean;
	holdingsSynced: boolean;
};

export type StaleCachedPlaidSyncResult = {
	syncedItemCount: number;
};

// ─── Real Estate ──────────────────────────────────────────────────────────────

export type RealEstatePropertyType =
	| "SINGLE_FAMILY"
	| "MULTI_FAMILY"
	| "CONDO"
	| "COMMERCIAL"
	| "LAND"
	| "OTHER";

export type RealEstateUsageType =
	| "PRIMARY_RESIDENCE"
	| "RENTAL"
	| "VACATION_HOME"
	| "MIXED_USE";

export type RealEstateForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

export interface RealEstateInput {
	name: string;
	propertyType: RealEstatePropertyType;
	usageType: RealEstateUsageType;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	purchasePrice?: number;
	purchaseDate?: string;
	downPayment?: number;
	closingCosts?: number;
	rehabCosts?: number;
	interestRate?: number;
	loanTermYears?: number;
	remainingTermMonths?: number;
	monthlyMortgagePayment?: number;
	monthlyRent?: number;
	otherMonthlyIncome?: number;
	vacancyRate?: number;
	totalMonthlyExpenses?: number;
	monthlyPropertyTax?: number;
	monthlyInsurance?: number;
	monthlyHOA?: number;
	monthlyUtilities?: number;
	monthlyMaintenance?: number;
	monthlyManagement?: number;
	monthlyOtherExpenses?: number;
	appreciationRate?: number;
	expenseGrowthRate?: number;
	forecastScenario?: RealEstateForecastScenario;
	linkedPlaidAccountId?: string | null;
}

export type ManualInvestmentType =
	| "STOCKS"
	| "REAL_ESTATE"
	| "ROTH_IRA"
	| "FOUR01K"
	| "HSA"
	| "OTHER";

export interface ManualInvestmentRecord {
	id: string;
	userId: string;
	type: ManualInvestmentType;
	name: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
	lastBalanceAccruedAt?: string | null;
	nextBalanceAccrualDueAt?: string | null;
	createdAt: string;
	updatedAt: string;
}

export interface CreateManualInvestmentInput {
	id?: string;
	type: ManualInvestmentType;
	name: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
}

export interface UpdateManualInvestmentInput {
	id: string;
	name?: string;
	startingBalance?: number;
	monthlyContribution?: number;
	annualReturnRate?: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
	type?: ManualInvestmentType;
}

export interface RealEstateInvestment {
	id: string;
	name: string;
	propertyType: RealEstatePropertyType;
	usageType: RealEstateUsageType;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	forecastScenario: RealEstateForecastScenario;
	purchasePrice?: number | null;
	purchaseDate?: string | null;
	downPayment?: number | null;
	closingCosts?: number | null;
	rehabCosts?: number | null;
	interestRate?: number | null;
	loanTermYears?: number | null;
	remainingTermMonths?: number | null;
	monthlyMortgagePayment?: number | null;
	monthlyRent?: number | null;
	otherMonthlyIncome?: number | null;
	vacancyRate?: number | null;
	totalMonthlyExpenses?: number | null;
	monthlyPropertyTax?: number | null;
	monthlyInsurance?: number | null;
	monthlyHOA?: number | null;
	monthlyUtilities?: number | null;
	monthlyMaintenance?: number | null;
	monthlyManagement?: number | null;
	monthlyOtherExpenses?: number | null;
	appreciationRate?: number | null;
	expenseGrowthRate?: number | null;
	linkedPlaidAccountId?: string | null;
	createdAt?: string;
	updatedAt?: string;
}

export type UpdateRealEstateInput = {
	id: string;
} & Partial<{
	[K in keyof RealEstateInput]: RealEstateInput[K] | null;
}>;

// ─── Client Interface ─────────────────────────────────────────────────────────

export interface MoatApiClient {
	// Overview
	getSummaryMetrics(): Promise<SummaryMetrics>;
	getMonthlyAggregates(input: {
		months: number;
	}): Promise<MonthlyAggregatesResponse>;
	getBalanceSnapshotHistory(input: {
		months?: number;
		forecastMonths?: number;
	}): Promise<BalanceSnapshotHistoryResponse>;
	getAssetValueHistory(input: {
		source: AssetHistorySource;
		sourceId: string;
		months?: number;
	}): Promise<AssetValueHistoryResponse>;
	getAccountBalanceHistory(input: {
		accountId: string;
	}): Promise<AccountBalanceHistoryResponse>;
	getAccountHoldings(input: {
		accountId: string;
	}): Promise<AccountHoldingsResponse>;
	getPortfolioAllocation(): Promise<PortfolioAllocationResponse>;
	getPreviousMonthCashFlow(input?: {
		month?: string;
	}): Promise<CashFlowResponse>;

	// Transactions
	listTransactions(
		input: TransactionListInput,
	): Promise<TransactionListResponse>;
	previewTransactionImport(
		input: import("./transaction-import").PreviewTransactionImportInput,
	): Promise<import("./transaction-import").TransactionImportPreviewResponse>;
	commitTransactionImport(
		input: import("./transaction-import").CommitTransactionImportInput,
	): Promise<import("./transaction-import").TransactionImportCommitResponse>;
	listImportTemplates(): Promise<
		import("./import-mapping-template").ImportMappingTemplateDto[]
	>;
	createImportTemplate(
		input: import("./import-mapping-template").CreateImportMappingTemplateInput,
	): Promise<import("./import-mapping-template").ImportMappingTemplateDto>;
	updateImportTemplate(
		input: import("./import-mapping-template").UpdateImportMappingTemplateInput,
	): Promise<import("./import-mapping-template").ImportMappingTemplateDto>;
	deleteImportTemplate(id: string): Promise<void>;
	countTransactions(input: TransactionCountInput): Promise<number>;
	getTransactionById(id: string): Promise<Transaction>;
	getTransactionSummary(
		input: TransactionSummaryInput,
	): Promise<TransactionSummaryResponse>;
	updateTransaction(input: UpdateTransactionInput): Promise<void>;
	updateTransactionFields?(
		input: UpdateTransactionFieldsInput,
	): Promise<Transaction | undefined>;
	updateTransactionCategory?(
		input: UpdateTransactionCategoryInput,
	): Promise<{ categoryName: string }>;
	setTransactionHashtags?(input: SetTransactionHashtagsInput): Promise<void>;
	splitTransaction?(input: SplitTransactionInput): Promise<void>;
	updateSplitTransaction?(input: SplitTransactionInput): Promise<void>;
	unsplitTransaction?(input: { id: string }): Promise<void>;
	getSplitGroup?(input: { id: string }): Promise<SplitGroup>;
	hideTransaction?(id: string): Promise<void>;
	unhideTransaction?(id: string): Promise<void>;
	deleteTransaction(id: string): Promise<void>;
	bulkDeleteTransactions(ids: string[]): Promise<void>;
	bulkHideTransactions?(ids: string[]): Promise<void>;
	bulkUpdateTransactionCategory?(input: {
		ids: string[];
		categoryName: string;
	}): Promise<void>;
	bulkAddTransactionHashtag?(input: {
		ids: string[];
		hashtag: string;
	}): Promise<void>;
	listHashtags(): Promise<string[]>;
	listTransactionCategories(): Promise<string[]>;

	// Budget
	getBudgetPageData(input?: { month?: string }): Promise<BudgetPageData>;
	updateCategoryBudget(input: UpdateCategoryBudgetInput): Promise<void>;
	getBudgetCategoryDetail(input: {
		categoryId: string;
		month?: string;
	}): Promise<CategoryBudgetDetail>;
	upsertCategoryBudget(input: {
		categoryId: string;
		monthlyGoal: number;
		alertsEnabled?: boolean;
		alertThresholds?: number[];
	}): Promise<void>;
	getSpendingCategoryBreakdown(
		input: SpendingInput,
	): Promise<SpendingBreakdownResponse>;
	getSpendingCategoryTrends(
		input: SpendingInput,
	): Promise<SpendingTrendsResponse>;
	getSpendingAnomalies(input?: {
		expenseCategories?: string[];
	}): Promise<SpendingAnomaliesResponse>;
	getRecurringExpenses(input?: {
		expenseCategories?: string[];
	}): Promise<RecurringExpensesResponse>;
	getIncomeInsights(input: InsightsInput): Promise<IncomeInsightsData>;
	getNetIncomeInsights(input: InsightsInput): Promise<NetIncomeInsightsData>;
	getInsightsCategoryActivity(
		input: InsightsInput,
	): Promise<InsightsCategoryActivity>;
	getWhatIfBaseline(
		input?: GetWhatIfBaselineInput,
	): Promise<WhatIfBaselineResponse>;

	// Categories
	listCategories(): Promise<Category[]>;
	createCategory(input: CreateCategoryInput): Promise<Category>;
	updateCategory(input: UpdateCategoryInput): Promise<Category>;
	deleteCategory(id: string): Promise<void>;
	toggleCategoryHidden(input: ToggleCategoryHiddenInput): Promise<void>;

	// Scenarios
	listScenarios(): Promise<ForecastScenario[]>;
	seedDefaultScenarios(): Promise<{ seeded: boolean }>;
	createScenario(input: CreateScenarioInput): Promise<ForecastScenario>;
	updateScenario(input: UpdateScenarioInput): Promise<ForecastScenario>;
	deleteScenario(id: string): Promise<void>;
	setActiveScenario(id: string | null): Promise<void>;

	// Retirement
	getRetirementPlanOverview(): Promise<RetirementPlanOverview>;
	projectRetirementScenario(
		input: ProjectRetirementScenarioInput,
	): Promise<RetirementProjectionResponse>;
	runRetirementMonteCarlo(
		input: RunRetirementMonteCarloInput,
	): Promise<RetirementMonteCarloResult>;
	compareRetirementScenarios(
		input: CompareRetirementScenariosInput,
	): Promise<RetirementComparison>;
	runRetirementStressTests(
		input: RunRetirementStressTestsInput,
	): Promise<RetirementStressTestsResponse>;
	solveRetirementGoal(
		input: SolveRetirementGoalInput,
	): Promise<RetirementGoalSeekResponse>;
	getRetirementOpportunities(
		input?: GetRetirementOpportunitiesInput,
	): Promise<RetirementOpportunitiesResponse>;
	getRetirementSpendingPlan(): Promise<RetirementSpendingPlan>;
	updateRetirementSpendingPlan(
		input: UpdateRetirementSpendingPlanInput,
	): Promise<RetirementSpendingPlan>;
	getRetirementPlan(): Promise<RetirementPlanSettings>;
	updateRetirementPlan(
		input: UpdateRetirementPlanInput,
	): Promise<RetirementPlanSettings>;
	listRetirementScenarios(): Promise<RetirementScenario[]>;
	createRetirementScenario(
		input: CreateRetirementScenarioInput,
	): Promise<RetirementScenario>;
	updateRetirementScenario(
		input: UpdateRetirementScenarioInput,
	): Promise<RetirementScenario>;
	duplicateRetirementScenario(
		input: DuplicateRetirementScenarioInput,
	): Promise<RetirementScenario>;
	deleteRetirementScenario(input: { id: string }): Promise<void>;
	listRetirementStandingRules(): Promise<RetirementStandingRule[]>;
	upsertRetirementStandingRule(
		input: UpsertRetirementStandingRuleInput,
	): Promise<RetirementStandingRule>;
	deleteRetirementStandingRule(
		input: DeleteRetirementStandingRuleInput,
	): Promise<void>;

	// Taxes
	listTaxYears(): Promise<TaxYearsResponse>;
	getTaxOverview(input: TaxYearInput): Promise<TaxOverview>;
	getTaxReadiness(input: TaxYearInput): Promise<TaxReadiness>;
	getTaxYearProfile(input: TaxYearInput): Promise<TaxYearProfile>;
	getTaxAgentContext(input: TaxYearInput): Promise<TaxAgentContext>;
	listTaxDocuments(input: TaxYearInput): Promise<TaxDocument[]>;
	getTaxDocument(input: TaxGetDocumentInput): Promise<TaxDocumentDetail>;
	uploadTaxDocument(input: TaxUploadDocumentInput): Promise<TaxDocument>;
	reprocessTaxDocument(input: { id: string }): Promise<TaxDocument>;
	renameTaxDocument(input: TaxRenameDocumentInput): Promise<TaxDocument>;
	deleteTaxDocument(input: { id: string }): Promise<void>;
	listTaxFacts(input: TaxListFactsInput): Promise<TaxFact[]>;
	getTaxFact(input: { id: string }): Promise<TaxFact>;
	createManualTaxFact(input: TaxCreateManualFactInput): Promise<TaxFact>;
	updateTaxFact(input: TaxUpdateFactInput): Promise<TaxFact>;
	confirmTaxFact(input: TaxConfirmFactInput): Promise<TaxFact>;
	listTaxConflicts(input: TaxYearInput): Promise<TaxFactConflict[]>;
	resolveTaxConflict(input: TaxResolveConflictInput): Promise<TaxFactConflict>;
	searchTaxData(input: TaxSearchInput): Promise<TaxFact[]>;

	// Mileage
	listMileageTrips(input: ListMileageTripsInput): Promise<MileageTripList>;
	upsertMileageTrip(input: UpsertMileageTripInput): Promise<MileageTrip>;
	updateMileageTripPurpose(input: UpdateMileageTripInput): Promise<MileageTrip>;

	// Rules
	listRules(): Promise<TransactionRule[]>;
	getRuleById(id: string): Promise<TransactionRule | null>;
	createRule(input: CreateRuleInput): Promise<TransactionRule>;
	updateRule(id: string, input: UpdateRuleInput): Promise<TransactionRule>;
	deleteRule(id: string): Promise<void>;
	toggleRuleActive(id: string): Promise<void>;
	previewRuleConditions(
		input: PreviewRuleConditionsInput,
	): Promise<PreviewRuleConditionsResult>;
	applyRuleHistorical(
		input: ApplyRuleHistoricalInput,
	): Promise<ApplyRuleHistoricalResult>;
	linkRuleToTransaction(input: LinkRuleToTransactionInput): Promise<void>;

	// Accounts
	listAccounts(): Promise<AccountSummary[]>;
	getOnboardingAccountSources(): Promise<OnboardingAccountSources>;

	// Settings
	getFinancialProfile(): Promise<FinancialProfile>;
	updateFinancialProfile(input: UpdateFinancialProfileInput): Promise<void>;

	// Financial Profile Data
	getFinancialProfileData(): Promise<FinancialProfileData>;
	updateFinancialProfileData(
		data: FinancialProfileData,
	): Promise<FinancialProfileData>;

	// Setup guide
	getSetupGuide(): Promise<import("./setup-guide").SetupGuideState>;
	completeSetupGuideStep(input: {
		stepId: import("./setup-guide").SetupGuideStepId;
	}): Promise<import("./setup-guide").SetupGuideState>;
	dismissSetupGuide(): Promise<import("./setup-guide").SetupGuideState>;
	saveOnboardingGoals(input: {
		goals: string[];
	}): Promise<{ success: boolean }>;

	// Manual Investments (canonical Investment rows)
	listInvestments(): Promise<ManualInvestmentRecord[]>;
	createInvestment(
		input: CreateManualInvestmentInput,
	): Promise<ManualInvestmentRecord>;
	updateInvestment(
		input: UpdateManualInvestmentInput,
	): Promise<ManualInvestmentRecord>;
	deleteInvestment(input: { id: string }): Promise<void>;

	// Real Estate
	listRealEstate(): Promise<RealEstateInvestment[]>;
	createRealEstate(input: RealEstateInput): Promise<RealEstateInvestment>;
	updateRealEstate(input: UpdateRealEstateInput): Promise<RealEstateInvestment>;
	deleteRealEstate(input: { id: string }): Promise<void>;

	// Plaid sync
	syncPlaidItem(input: { itemId: string }): Promise<ConnectionSyncResult>;
	syncStaleCachedPlaidItems(): Promise<StaleCachedPlaidSyncResult>;
	disconnectPlaidItem(input: { itemId: string }): Promise<{ success: boolean }>;
	setAccountSyncEnabled(input: {
		accountId: string;
		syncEnabled: boolean;
	}): Promise<{ id: string; syncEnabled: boolean }>;

	// AI Reports
	listReports(): Promise<AiReportSummary[]>;
	getReport(id: string): Promise<AiReport>;
	createReport(input: CreateAiReportInput): Promise<AiReport>;
	updateReport(input: UpdateAiReportInput): Promise<AiReport>;
	deleteReport(id: string): Promise<void>;
	/** V2: creates or refreshes the AiReportShare snapshot. V1: sets shareSlug. */
	shareReport(id: string): Promise<CreateSnapshotResult>;
	/** V2: revokes the AiReportShare. V1: clears shareSlug. */
	unshareReport(id: string): Promise<void>;
	/** V2: re-copies current report into the existing share snapshot. */
	updateSnapshot(reportId: string): Promise<CreateSnapshotResult>;
	/** Public: resolves share by slug — checks AiReportShare first, then legacy AiReport.shareSlug. */
	getReportBySlug(slug: string): Promise<PublicReportShare>;

	// Community Prompt Library
	listPromptCategories(): Promise<PromptCategory[]>;
	listMyPrompts(): Promise<UserPromptSummary[]>;
	getPrompt(id: string): Promise<UserPromptDetail>;
	createPrompt(input: CreateUserPromptInput): Promise<UserPromptDetail>;
	updatePrompt(input: UpdateUserPromptInput): Promise<UserPromptDetail>;
	deletePrompt(id: string): Promise<void>;
	generatePromptDraft(
		input: GeneratePromptDraftInput,
	): Promise<GeneratePromptDraftResult>;
	submitPrompt(id: string): Promise<UserPromptDetail>;
	withdrawPrompt(id: string): Promise<UserPromptDetail>;
	listCommunityPrompts(): Promise<CommunityPromptSummary[]>;
	getCommunityPrompt(id: string): Promise<CommunityPromptDetail>;
	saveCommunityPromptToLibrary(id: string): Promise<UserPromptDetail>;
	hasPromptAiConnection(): Promise<{ connected: boolean }>;
	listPromptPins(source?: PromptLibrarySource): Promise<PromptPinSummary[]>;
	togglePromptPin(input: TogglePromptPinInput): Promise<TogglePromptPinResult>;
	listPromptLaunchCounts(
		source?: PromptLibrarySource,
	): Promise<PromptLaunchCountSummary[]>;
	recordPromptLaunch(
		input: RecordPromptLaunchInput,
	): Promise<RecordPromptLaunchResult>;
	listPromptModeration(
		filter?: PromptReviewStatus | "ALL",
	): Promise<ModerationQueueItem[]>;
	approvePrompt(input: {
		promptId: string;
		revisionId: string;
	}): Promise<UserPromptDetail>;
	requestPromptChanges(input: {
		promptId: string;
		revisionId: string;
		feedback: string;
	}): Promise<UserPromptDetail>;
	rejectPrompt(input: {
		promptId: string;
		revisionId: string;
		reason: string;
	}): Promise<UserPromptDetail>;
	unpublishPrompt(input: {
		promptId: string;
		reason: string;
	}): Promise<UserPromptDetail>;
	getPromptModerationHistory(
		promptId: string,
	): Promise<PromptModerationEventSummary[]>;

	// Community Tips
	listCommunityTips(
		input?: Partial<ListCommunityTipsInput>,
	): Promise<CommunityTipFeedResponse>;
	listMyCommunityTips(): Promise<CommunityTipOwnerDetail[]>;
	getCommunityTip(
		tipId: string,
	): Promise<CommunityTipPublicDetail | CommunityTipOwnerDetail>;
	createCommunityTip(
		input: CreateCommunityTipInput,
	): Promise<CommunityTipOwnerDetail>;
	updateCommunityTip(
		input: UpdateCommunityTipInput,
	): Promise<CommunityTipOwnerDetail>;
	deleteCommunityTip(tipId: string): Promise<void>;
	likeCommunityTip(tipId: string): Promise<CommunityTipPublicSummary>;
	unlikeCommunityTip(tipId: string): Promise<CommunityTipPublicSummary>;
	listCommunityTipsForTransaction(input: {
		transactionId: string;
		limit?: number;
	}): Promise<CommunityTipTransactionRecommendation[]>;
	getCommunityTipSettings(): Promise<{
		showCommunityTipsOnTransactions: boolean;
	}>;
	setCommunityTipSettings(input: {
		showCommunityTipsOnTransactions: boolean;
	}): Promise<{ showCommunityTipsOnTransactions: boolean }>;
	listCommunityTipModeration(input?: {
		filter?: CommunityTipStatus | "ALL";
		cursor?: string;
		limit?: number;
	}): Promise<{ items: CommunityTipAdminDetail[]; nextCursor: string | null }>;
	getCommunityTipModeration(tipId: string): Promise<CommunityTipAdminDetail>;
	approveCommunityTip(tipId: string): Promise<CommunityTipAdminDetail>;
	rejectCommunityTip(input: {
		tipId: string;
		reason?: string;
	}): Promise<CommunityTipAdminDetail>;
	requestCommunityTipChanges(input: {
		tipId: string;
		reason: string;
	}): Promise<CommunityTipAdminDetail>;
	archiveCommunityTip(tipId: string): Promise<CommunityTipAdminDetail>;
	expireCommunityTip(tipId: string): Promise<CommunityTipAdminDetail>;
	updateCommunityTipMetadata(input: {
		tipId: string;
		metadata: NonNullable<CreateCommunityTipInput["metadata"]>;
	}): Promise<CommunityTipAdminDetail>;

	// Notifications / financial monitoring
	listNotificationRules(): Promise<{
		rules: import("./notifications").NotificationRule[];
	}>;
	getNotificationRule(
		id: string,
	): Promise<{ rule: import("./notifications").NotificationRule | null }>;
	listNotificationTemplates(): Promise<{
		templates: import("./notifications").NotificationTemplate[];
	}>;
	createNotificationRule(
		input: import("./notifications").CreateNotificationRuleInput,
	): Promise<{ rule: import("./notifications").NotificationRule }>;
	updateNotificationRule(
		input: import("./notifications").UpdateNotificationRuleInput,
	): Promise<{ rule: import("./notifications").NotificationRule }>;
	pauseNotificationRule(input: {
		id: string;
		paused: boolean;
	}): Promise<{ rule: import("./notifications").NotificationRule }>;
	deleteNotificationRule(id: string): Promise<void>;
	previewNotificationRule(input: {
		rule: import("./notifications").CreateNotificationRuleInput;
	}): Promise<{
		evaluation: {
			fired: boolean;
			title: string;
			body: string;
			explanation: {
				signalType: string;
				summary: string;
				facts: Array<{ label: string; value: string }>;
			};
		};
		timezone: string;
		emailPreview?: {
			subject: string;
			html: string;
			text: string;
		};
	}>;
	parseNotificationNaturalLanguage(input: {
		prompt: string;
	}): Promise<{ rule: import("./notifications").CreateNotificationRuleInput }>;
	getNotificationPreferences(): Promise<{
		preferences: import("./notifications").NotificationPreference;
	}>;
	updateNotificationPreferences(
		input: Partial<import("./notifications").NotificationPreference> & {
			acknowledgeWeeklySummaryOnboarding?: boolean;
		},
	): Promise<{ preferences: import("./notifications").NotificationPreference }>;
	listNotificationInbox(input?: {
		unreadOnly?: boolean;
		limit?: number;
	}): Promise<{ items: import("./notifications").NotificationInboxItem[] }>;
	markNotificationRead(id: string): Promise<void>;
	resolveNotification(input: {
		id: string;
		status: "RESOLVED" | "SNOOZED" | "MUTED";
		snoozedUntilIso?: string;
		action?: "paid_elsewhere" | "ignore_this_month";
	}): Promise<void>;
	listNotificationSuggestions(): Promise<{
		suggestions: import("./notifications").NotificationSuggestion[];
	}>;
	dismissNotificationSuggestion(id: string): Promise<void>;

	// Admin
	getUserStats(): Promise<AdminUserStats>;
}

export type AdminUserStats = {
	totalUsers: number;
	activeLast7Days: number;
	webUsers: number;
	desktopUsers: number;
};
