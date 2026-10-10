// Shared domain types used across repository interfaces.
// No Prisma imports. No runtime dependencies.

import type { CategoryParent } from "@moat/contracts";

export type TransactionType = "INCOME" | "EXPENSE";

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

export type DashboardTransaction = {
	id: string;
	date: Date;
	description: string | null;
	originalDescription?: string | null;
	notes?: string | null;
	amount: number;
	type: TransactionType;
	category: string;
	categoryIcon?: string | null;
	categoryColor?: string | null;
	account: string | null;
	hashtags?: string[];
	appliedRuleId?: string | null;
	location?: TransactionLocation | null;
	hidden?: boolean;
	pending?: boolean;
	source?: string | null;
	splitGroupId?: string | null;
	splitParentId?: string | null;
	amazonRetailEnrichedAt?: Date | string | null;
};

export type AccountSummary = {
	id: string;
	name: string;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	currency: string;
	mask: string | null;
	/** Corresponds to PlaidAccount.accountHidden — excludes from net worth */
	isHidden: boolean;
	isActive: boolean;
};

export type MonthlyTotals = {
	/** YYYY-MM */
	month: string;
	income: number;
	expenses: number;
	net: number;
};

export type CategorySpend = {
	category: string;
	total: number;
	parentCategory: CategoryParent | null;
};

export type CategoryMonthlySpend = {
	/** YYYY-MM */
	month: string;
	categoryId: string | null;
	categoryName: string;
	amount: number;
};

// ─── Rule types ───────────────────────────────────────────────────────────────

export type RuleField =
	| "MERCHANT"
	| "DESCRIPTION"
	| "AMOUNT"
	| "CATEGORY"
	| "DATE"
	| "ACCOUNT"
	| "NOTES";

export type RuleOperator =
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

export type RuleActionType =
	| "SET_CATEGORY"
	| "SET_DESCRIPTION"
	| "SET_TYPE"
	| "ADD_HASHTAG";

export type RuleMatch = "ALL" | "ANY";

export type RuleCondition = {
	id: string;
	field: RuleField;
	operator: RuleOperator;
	valueText: string | null;
	valueNumber: number | null;
	valueDate: Date | null;
	secondValueNumber: number | null;
	secondValueDate: Date | null;
	sortOrder: number;
	groupId?: string;
};

export type RuleConditionGroup = {
	id: string;
	match: RuleMatch;
	sortOrder: number;
	conditions: RuleCondition[];
};

export type RuleAction = {
	id: string;
	type: RuleActionType;
	valueText: string | null;
	hashtagId: string | null;
	/** Resolved hashtag name for ADD_HASHTAG actions */
	hashtagName: string | null;
	sortOrder: number;
};

export type ActiveRule = {
	id: string;
	name: string;
	isActive: boolean;
	priority: number;
	match: RuleMatch;
	conditions: RuleCondition[];
	conditionGroups: RuleConditionGroup[];
	actions: RuleAction[];
};

// ─── Budget types ─────────────────────────────────────────────────────────────

export type CategoryBudgetEntry = {
	categoryId: string;
	categoryName: string;
	monthlyGoal: number | null;
	parentCategory: CategoryParent | null;
	alertsEnabled: boolean | null;
	alertThresholds: number[] | null;
};

// ─── Forecast types ───────────────────────────────────────────────────────────

export type ForecastScenario = {
	id: string;
	name: string;
	type: string;
	investmentReturn: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
	isActive: boolean;
};

export type CreateForecastScenarioInput = {
	name: string;
	type: "CONSERVATIVE" | "STANDARD" | "AGGRESSIVE" | "CUSTOM";
	investmentReturn: number;
	inflationRate: number;
	salaryGrowth: number;
	contributionChange: number;
	expenseGrowth: number;
};

export type UpdateForecastScenarioInput = Partial<
	Omit<CreateForecastScenarioInput, "type">
> & {
	isActive?: boolean;
};

// ─── Write / mutation types ───────────────────────────────────────────────────

export type CreateTransactionInput = {
	id?: string;
	date: Date;
	postedDate?: Date;
	amount: number;
	type: TransactionType;
	description?: string;
	originalDescription?: string | null;
	merchantName?: string;
	categoryId?: string | null;
	accountId?: string | null;
	source?: string;
	dedupeFingerprint?: string;
};

export type UpdateTransactionInput = {
	description?: string;
	amount?: number;
	type?: TransactionType;
	categoryId?: string | null;
	categoryName?: string | null;
	hashtags?: string[];
	appliedRuleId?: string | null;
	notes?: string | null;
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
	startDate?: Date;
	endDate?: Date;
	type?: TransactionType;
	retailLinkedRetailer?: "amazon";
};

export type TransactionSummary = {
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

export type TransactionListQuery = {
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
	startDate?: Date;
	endDate?: Date;
	type?: TransactionType;
	sortField?: "date" | "amount" | "account";
	sortDir?: "asc" | "desc";
	retailLinkedRetailer?: "amazon";
};

export type PaginatedTransactions = {
	items: DashboardTransaction[];
	nextCursor: number | null;
	total: number;
};

export type CreateRuleInput = {
	name: string;
	match?: RuleMatch;
	conditions: Omit<RuleCondition, "id" | "groupId">[];
	conditionGroups?: Array<{
		match?: RuleMatch;
		conditions: Omit<RuleCondition, "id" | "groupId">[];
	}>;
	actions: Omit<RuleAction, "id">[];
};

export type UpdateRuleInput = {
	name?: string;
	match?: RuleMatch;
	conditions?: Omit<RuleCondition, "id" | "groupId">[];
	conditionGroups?: Array<{
		match?: RuleMatch;
		conditions: Omit<RuleCondition, "id" | "groupId">[];
	}>;
	actions?: Omit<RuleAction, "id">[];
	isActive?: boolean;
	priority?: number;
};

export type UpsertAccountInput = {
	id?: string;
	name: string;
	type: string;
	subtype?: string;
	institutionName?: string;
	currentBalance?: number;
	currency?: string;
};

export type CategorySummary = {
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

export type FinancialProfile = {
	monthlyIncome: number | null;
	monthlyExpenses: number | null;
	savingsGoal: number | null;
	currency: string;
};

export type UpdateFinancialProfileInput = Partial<FinancialProfile>;

// ─── Investment types ─────────────────────────────────────────────────────────

export type InvestmentType =
	| "STOCKS"
	| "ROTH_IRA"
	| "FOUR01K"
	| "HSA"
	| "REAL_ESTATE"
	| "OTHER";

export type Investment = {
	id: string;
	userId: string;
	type: InvestmentType;
	name: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance: boolean;
	lastBalanceAccruedAt?: Date | null;
	nextBalanceAccrualDueAt?: Date | null;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateInvestmentInput = {
	id?: string;
	type: InvestmentType;
	name: string;
	startingBalance?: number;
	monthlyContribution?: number;
	annualReturnRate?: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
	nextBalanceAccrualDueAt?: Date | null;
};

export type UpdateInvestmentInput = Partial<CreateInvestmentInput> & {
	lastBalanceAccruedAt?: Date | null;
	nextBalanceAccrualDueAt?: Date | null;
};

export type ManualInvestmentBalanceAccrualRecord = {
	id: string;
	userId: string;
	investmentId: string;
	previousBalance: number;
	newBalance: number;
	contributionApplied: number;
	returnApplied: number;
	netIncrement: number;
	periodStart: Date;
	periodEnd: Date;
	accruedAt: Date;
};

export type ApplyInvestmentAccrualInput = {
	userId: string;
	investmentId: string;
	newBalance: number;
	lastBalanceAccruedAt: Date;
	nextBalanceAccrualDueAt: Date;
	audit: {
		previousBalance: number;
		newBalance: number;
		contributionApplied: number;
		returnApplied: number;
		netIncrement: number;
		periodStart: Date;
		periodEnd: Date;
		accruedAt: Date;
	};
};

export type ApplyInvestmentAccrualsInput = {
	userId: string;
	investmentId: string;
	steps: Array<{
		newBalance: number;
		lastBalanceAccruedAt: Date;
		nextBalanceAccrualDueAt: Date;
		audit: ApplyInvestmentAccrualInput["audit"];
	}>;
};

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

export type RealEstateInvestment = {
	id: string;
	userId: string;
	name: string;
	propertyType: RealEstatePropertyType;
	usageType: RealEstateUsageType;
	purchasePrice: number | null;
	purchaseDate: Date | null;
	downPayment: number | null;
	closingCosts: number | null;
	rehabCosts: number | null;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	interestRate: number | null;
	loanTermYears: number | null;
	remainingTermMonths: number | null;
	monthlyMortgagePayment: number | null;
	monthlyRent: number | null;
	otherMonthlyIncome: number | null;
	vacancyRate: number | null;
	totalMonthlyExpenses: number | null;
	monthlyPropertyTax: number | null;
	monthlyInsurance: number | null;
	monthlyHOA: number | null;
	monthlyUtilities: number | null;
	monthlyMaintenance: number | null;
	monthlyManagement: number | null;
	monthlyOtherExpenses: number | null;
	appreciationRate: number | null;
	expenseGrowthRate: number | null;
	forecastScenario: RealEstateForecastScenario;
	linkedPlaidAccountId: string | null;
	createdAt: Date;
	updatedAt: Date;
};

export type CreateRealEstateInvestmentInput = {
	name: string;
	propertyType: RealEstatePropertyType;
	usageType: RealEstateUsageType;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	purchasePrice?: number | null;
	purchaseDate?: Date | null;
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
	forecastScenario?: RealEstateForecastScenario;
	linkedPlaidAccountId?: string | null;
};

export type UpdateRealEstateInvestmentInput = Partial<{
	[K in keyof CreateRealEstateInvestmentInput]:
		| CreateRealEstateInvestmentInput[K]
		| null;
}>;
