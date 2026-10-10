import type {
	PolicyFieldSource,
	RetirementEssentiality,
	RetirementLever,
	RetirementPolicies,
	RetirementSpendingStage,
	RetirementSpendingTreatment,
	RetirementStandingRuleBody,
	RetirementTaxTreatment,
} from "@moat/contracts";

export type RetirementPlanRecord = {
	id: string;
	userId: string;
	primaryBirthYear: number | null;
	targetRetirementAge: number;
	longevityAge: number;
	socialSecurityClaimAge: number;
	socialSecurityMonthlyAtFra: number | null;
	hasSpouse: boolean;
	spouseBirthYear: number | null;
	spouseRetirementAge: number | null;
	spouseLongevityAge: number | null;
	spouseSocialSecurityClaimAge: number | null;
	spouseSocialSecurityMonthlyAtFra: number | null;
	annualEmploymentIncome: number | null;
	annualSpouseEmploymentIncome: number | null;
	confidenceTarget: number;
	monteCarloTrials: number;
	spendingStages: RetirementSpendingStage[];
	spendingOverrides: Record<string, number>;
	timelinePreferences: Record<string, unknown>;
	withdrawalOrder: RetirementTaxTreatment[];
	/** Always complete; unset columns read back as their inert defaults. */
	policies: RetirementPolicies;
};

export type UpdateRetirementPlanRecordInput = Partial<
	Omit<RetirementPlanRecord, "id" | "userId" | "policies">
> & {
	/** Only the named policies are written; the rest keep their stored value. */
	policies?: Partial<RetirementPolicies>;
};

export type RetirementStandingRuleRecord = {
	id: string;
	label: string;
	enabled: boolean;
	sortOrder: number;
	source: PolicyFieldSource;
	rule: RetirementStandingRuleBody;
};

export type UpsertRetirementStandingRuleRecordInput = {
	/** Omitted for a create. */
	id?: string;
	label: string;
	enabled?: boolean;
	sortOrder?: number;
	source?: PolicyFieldSource;
	rule: RetirementStandingRuleBody;
};

export type RetirementScenarioLeverRecord = {
	id: string;
	enabled: boolean;
	sortOrder: number;
	lever: RetirementLever;
};

export type RetirementScenarioRecord = {
	id: string;
	userId: string;
	planId: string;
	name: string;
	description: string | null;
	color: string | null;
	source: "USER" | "SUGGESTED" | "AI" | "GOAL_SEEK";
	isPinned: boolean;
	sortOrder: number;
	createdAt: string;
	updatedAt: string;
	levers: RetirementScenarioLeverRecord[];
};

export type CreateRetirementScenarioRecordInput = {
	name: string;
	description?: string | null;
	color?: string | null;
	source?: "USER" | "SUGGESTED" | "AI" | "GOAL_SEEK";
	levers: Array<{
		enabled?: boolean;
		sortOrder?: number;
		lever: RetirementLever;
	}>;
};

export type UpdateRetirementScenarioRecordInput = {
	name?: string;
	description?: string | null;
	color?: string | null;
	isPinned?: boolean;
	sortOrder?: number;
	/** When present, replaces the entire ordered lever list. */
	levers?: Array<{
		enabled?: boolean;
		sortOrder?: number;
		lever: RetirementLever;
	}>;
};

export type RetirementSpendingCategoryPlanRecord = {
	categoryId: string;
	treatment: RetirementSpendingTreatment;
	essentiality: RetirementEssentiality;
	retirementMonthlyAmount: number | null;
	isUserEdited: boolean;
};

export type UpsertRetirementSpendingCategoryPlanInput = {
	categoryId: string;
	treatment: RetirementSpendingTreatment;
	essentiality: RetirementEssentiality;
	retirementMonthlyAmount?: number | null;
	isUserEdited?: boolean;
};

/**
 * One investable account, already bucketed by tax treatment. Synced Plaid
 * accounts and manual `Investment` rows both normalize into this shape so the
 * engine never has to know which source a balance came from.
 */
export type RetirementAccountSource = {
	id: string;
	name: string;
	origin: "plaid" | "manual";
	/** Raw account kind, kept for suggestion copy and employer-match detection. */
	kind: string;
	taxTreatment: RetirementTaxTreatment;
	balance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	isCash: boolean;
	isDebt: boolean;
	/** True when the user set this account's forecast rate (not a schema default). */
	forecastInputsUserEdited?: boolean;
};

/** Real-estate inputs the housing levers and equity projection consume. */
export type RetirementPropertySource = {
	id: string;
	name: string;
	usageType: string;
	isPrimaryResidence: boolean;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	interestRate: number | null;
	loanTermYears: number | null;
	purchaseDate: Date | string | null;
	remainingTermMonths: number | null;
	monthlyMortgagePayment: number | null;
	monthlyRent: number | null;
	otherMonthlyIncome: number | null;
	vacancyRate: number | null;
	totalMonthlyExpenses: number | null;
	appreciationRate: number | null;
	expenseGrowthRate: number | null;
	purchasePrice: number | null;
	linkedPlaidAccountId: string | null;
};

/** Insurance coverage reduced to the fields the projection actually uses. */
export type RetirementInsuranceSource = {
	id: string;
	type: string;
	status: string;
	effectiveEndDate: string | null;
	annualPremium: number;
	deathBenefit: number | null;
	monthlyBenefit: number | null;
	benefitYears: number | null;
	eliminationDays: number | null;
	hasInflationProtection: boolean;
	/** Policies stored on-device never reach the cloud engine. */
	isLocalOnly: boolean;
	/** Whose death pays the benefit; unknown policies default to primary. */
	insured: "primary" | "spouse";
};

export type RetirementPlanningContext = {
	filingStatus: string;
	stateTaxRate: number;
	federalBracketHint: number;
	inflationRate: number;
	incomeGrowthRate: number;
	investmentReturnRate: number;
	realEstateAppreciationRate: number;
	cashYield: number;
	forecastStyle: string;
	retirementAgeHint: number | null;
	currentAgeHint: number | null;
	insurancePolicies: RetirementInsuranceSource[];
	/** Policies excluded because they are stored locally on the desktop. */
	excludedLocalPolicyCount: number;
};

export interface RetirementRepository {
	/** Returns the user's plan, creating a defaulted row when none exists. */
	getOrCreatePlan(input: {
		userId: string;
		defaults?: Partial<Omit<RetirementPlanRecord, "id" | "userId">>;
	}): Promise<RetirementPlanRecord>;

	updatePlan(input: {
		userId: string;
		data: UpdateRetirementPlanRecordInput;
	}): Promise<RetirementPlanRecord>;

	listScenarios(input: { userId: string }): Promise<RetirementScenarioRecord[]>;

	getScenario(input: {
		userId: string;
		id: string;
	}): Promise<RetirementScenarioRecord | null>;

	createScenario(
		input: { userId: string } & CreateRetirementScenarioRecordInput,
	): Promise<RetirementScenarioRecord>;

	updateScenario(input: {
		userId: string;
		id: string;
		data: UpdateRetirementScenarioRecordInput;
	}): Promise<RetirementScenarioRecord>;

	deleteScenario(input: { userId: string; id: string }): Promise<void>;

	listStandingRules(input: {
		userId: string;
	}): Promise<RetirementStandingRuleRecord[]>;

	upsertStandingRule(
		input: { userId: string } & UpsertRetirementStandingRuleRecordInput,
	): Promise<RetirementStandingRuleRecord>;

	deleteStandingRule(input: { userId: string; id: string }): Promise<void>;

	listSpendingCategoryPlans(input: {
		userId: string;
	}): Promise<RetirementSpendingCategoryPlanRecord[]>;

	upsertSpendingCategoryPlans(input: {
		userId: string;
		rows: UpsertRetirementSpendingCategoryPlanInput[];
	}): Promise<void>;

	/** Investable balances and contribution rates, bucketed by tax treatment. */
	listAccountSources(input: {
		userId: string;
	}): Promise<RetirementAccountSource[]>;

	listPropertySources(input: {
		userId: string;
	}): Promise<RetirementPropertySource[]>;

	getPlanningContext(input: {
		userId: string;
	}): Promise<RetirementPlanningContext>;

	/** Latest timestamp across the inputs the baseline is derived from. */
	getBaselineVersion(input: { userId: string }): Promise<string>;
}
