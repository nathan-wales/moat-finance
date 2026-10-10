// Internal engine types. The wire shapes live in @moat/contracts; these are the
// pure-math inputs `applyLevers` produces and `projectRetirement` consumes.

import type {
	AccountContributionMode,
	CashPolicy,
	EmployerPlanContributionMode,
	MatchTier,
	RetirementEssentiality,
	RetirementIncomeTaxTreatment,
	RetirementLiquidTypeMix,
	RetirementSpendingStage,
	RetirementTaxTreatment,
} from "@moat/contracts";
import type { RetirementFilingStatus } from "./constants";

export type RetirementBalances = {
	/** Checking / savings. Grown at `cashYield`, not the portfolio return. */
	cash?: number;
	taxable: number;
	taxDeferred: number;
	taxFree: number;
};

export type RetirementContributions = {
	/** Annual amounts, in today's dollars. */
	taxable: number;
	taxDeferred: number;
	taxFree: number;
};

/** Per-tax-bucket expected annual returns (decimal). */
export type RetirementBucketReturns = {
	taxable: number;
	taxDeferred: number;
	taxFree: number;
};

export type ProjectedLiability = {
	id: string;
	name: string;
	balance: number;
	annualInterestRate: number;
	monthlyPayment: number;
	remainingTermMonths: number;
	/** Extra principal applied every month, mirroring `ProjectedProperty`. */
	extraMonthlyPayment?: number;
};

/**
 * Ownership costs split out from the single collapsed `monthlyExpenses`, so
 * property tax and insurance survive mortgage payoff and can inflate on their
 * own paths. When every component is zero the engine falls back to
 * `monthlyExpenses`, which keeps older fixtures projecting identically.
 */
export type PropertyOperatingCosts = {
	propertyTax: number;
	insurance: number;
	hoa: number;
	maintenance: number;
	management: number;
	utilities: number;
	other: number;
	/**
	 * Annual maintenance as a share of current value, used instead of the fixed
	 * `maintenance` amount when set.
	 */
	maintenancePercentOfValue: number | null;
};

export type ProjectedProperty = {
	id: string;
	name: string;
	isPrimaryResidence: boolean;
	value: number;
	loanBalance: number;
	annualInterestRate: number;
	remainingTermMonths: number;
	monthlyPayment: number;
	monthlyRent: number;
	monthlyExpenses: number;
	/** Itemized ownership costs; overrides `monthlyExpenses` when non-zero. */
	operatingCosts?: PropertyOperatingCosts;
	vacancyRate: number;
	appreciationRate: number;
	expenseGrowthRate: number;
	/** Rent growth when it differs from `expenseGrowthRate`. */
	rentGrowthRate?: number;
	/** Extra principal applied every month. */
	extraMonthlyPayment: number;
	/** Age at which the property is sold, if a housing lever says so. */
	sellAtAge: number | null;
	/** Age at which the property is acquired, for levers that add property. */
	acquiredAtAge: number | null;
	/** Down payment paid from liquid assets on acquisition. */
	downPayment: number;
	/** Purchase price (or current value when unknown); used for sale-gain tax. */
	costBasis: number;
};

export type OneTimeEvent = {
	label: string;
	atAge: number;
	amount: number;
	direction: "inflow" | "outflow";
	taxTreatment: RetirementIncomeTaxTreatment;
};

export type RecurringFlow = {
	label: string;
	annualAmount: number;
	fromAge: number;
	toAge: number;
	/** Only applies every N years, e.g. buying a car. */
	everyNYears?: number;
	taxTreatment?: RetirementIncomeTaxTreatment;
	essentiality?: RetirementEssentiality;
	/** Grows with inflation when true (the default for expenses). */
	inflates?: boolean;
	/**
	 * Grows at its own rate instead of general inflation. A pension COLA of 2%
	 * is not the same commitment as CPI, and conflating them overstates the
	 * benefit in every high-inflation year.
	 */
	colaRate?: number;
	/** Whose life the flow depends on. Defaults to the household. */
	dependsOn?: "primary" | "spouse";
	/**
	 * Counts toward a state's pension / retirement-income exclusion. A pension
	 * qualifies; consulting income taxed the same way federally does not.
	 */
	isRetirementIncome?: boolean;
	/**
	 * Multiplier applied once `dependsOn` has died — a pension survivor
	 * percentage. Absent means the flow simply continues.
	 */
	survivorShare?: number;
};

/** A stretch with reduced employment income, from a job loss or career break. */
export type IncomeGap = {
	label: string;
	whom: "primary" | "spouse";
	fromAge: number;
	/** Exclusive: a gap of `{ fromAge: 50, toAge: 51 }` covers age 50 only. */
	toAge: number;
	severance: number;
	/** Share of that year's earnings lost; 0.5 for a six-month layoff. */
	shareOfYear: number;
};

export type IncomeAdjustment = {
	whom: "primary" | "spouse";
	fromAge: number;
	/** Null runs to the end of the horizon. */
	toAge: number | null;
	annualDelta: number;
	percentDelta: number;
	/** Replaces earnings outright for the window, for part-time work. */
	setTo: number | null;
};

export type MarketShock = {
	atAge: number;
	dropPercent: number;
	recoveryYears: number;
};

export type SequenceRisk = {
	years: number;
	annualReturn: number;
};

export type RothConversionPlan = {
	fromAge: number;
	toAge: number;
	annualAmount: number | null;
	fillToBracket: number | null;
};

export type AnnuityPlan = {
	atAge: number;
	monthlyPayout: number;
	premium: number;
	hasCola: boolean;
};

export type LongTermCareEvent = {
	atAge: number;
	years: number;
	monthlyCost: number;
	whom: "primary" | "spouse" | "both";
};

export type LtcCoverage = {
	/** Policy id when the coverage came from a real policy, else null. */
	id: string | null;
	monthlyBenefit: number;
	benefitYears: number;
	eliminationDays: number;
	hasInflationProtection: boolean;
	expiresAtAge: number | null;
};

export type LifeCoverage = {
	id: string | null;
	deathBenefit: number;
	annualPremium: number;
	/** Age at which term coverage lapses; null for permanent. */
	expiresAtAge: number | null;
	/** Whose death triggers the payout. Defaults to the primary when unknown. */
	insured: "primary" | "spouse";
};

/**
 * A premium the household pays today. Kept per policy rather than as one total
 * so `policy_expires` can stop the premium alongside the coverage.
 */
export type InsurancePremium = {
	id: string;
	label: string;
	annualPremium: number;
	expiresAtAge: number | null;
};

export type DisabilityEvent = {
	atAge: number;
	durationYears: number;
	monthlyBenefit: number;
};

export type SocialSecurityInputs = {
	monthlyAtFra: number;
	claimAge: number;
	/** Applied as a percentage reduction to every benefit dollar. */
	haircut: number;
	/** Whether the FRA amount was estimated rather than user-entered. */
	isEstimated: boolean;
};

/**
 * One person's contribution policy, flattened for the pure core. Provenance is
 * stripped in the shell — the engine has no business knowing whether a number
 * was detected or assumed.
 */
export type EnginePersonContributionPolicy = {
	/** Gross pay before payroll tax and deferrals. 0 when unknown. */
	grossAnnualCompensation: number;
	/**
	 * Effective withholding rate implied by observed net deposits, so a $1
	 * pre-tax deferral costs `1 - wageTaxRate` of take-home rather than $1.
	 * With no deferral, take-home is untouched.
	 */
	wageTaxRate: number;
	employerPlan: {
		mode: EmployerPlanContributionMode;
		amount: number | null;
		rothShare: number;
		match: MatchTier[];
		profitSharingPercentOfSalary: number;
	};
	ira: {
		mode: AccountContributionMode;
		amount: number | null;
		kind: "traditional" | "roth";
	};
	hsa: {
		mode: AccountContributionMode;
		employeeAmount: number | null;
		employerAmount: number;
		coverage: "self" | "family";
	};
	taxableMonthly: number;
};

export type EngineContributionPolicy = {
	primary: EnginePersonContributionPolicy;
	spouse: EnginePersonContributionPolicy | null;
	autoApplyCatchUp: boolean;
	/** Null means each person contributes while that person is still working. */
	contributionsStopAge: number | null;
};

/**
 * Per-state treatment of retirement income. A single flat rate on all taxable
 * income overstates state tax for a Social-Security-heavy retiree in the many
 * states that exempt it.
 */
export type StateRetirementTaxProfile = {
	taxesSocialSecurity: boolean;
	/** Annual dollars of pension / retirement-account income excluded. */
	retirementIncomeExclusion: number;
};

export type RetirementPlanInputs = {
	currentYear: number;
	currentAge: number;
	primaryBirthYear: number | null;
	spouseCurrentAge: number | null;
	retirementAge: number;
	spouseRetirementAge: number | null;
	longevityAge: number;

	balances: RetirementBalances;
	contributions: RetirementContributions;
	/**
	 * Per-year contribution policy. When set it replaces the frozen
	 * `contributions` scalars: employer money becomes a pure balance addition
	 * that never touches cash flow, and pre-tax deferrals reduce take-home by
	 * their after-tax cost instead of a full dollar.
	 */
	contributionPolicy?: EngineContributionPolicy;
	/**
	 * Starting mix of named account types within each tax bucket. Used to
	 * split projected liquid assets on the overview chart. Optional so older
	 * test fixtures still project; the default treats taxable as stocks,
	 * deferred as 401(k), and tax-free as Roth.
	 */
	liquidTypeMix?: RetirementLiquidTypeMix;
	contributionsStopAge: number;

	annualEmploymentIncome: number;
	annualSpouseEmploymentIncome: number;
	/** Age at which primary employment income ends; defaults to retirementAge. */
	employmentEndsAtAge: number;
	spouseEmploymentEndsAtAge: number | null;

	returnRate: number;
	/**
	 * Balance-weighted expected returns by tax bucket. When omitted, every
	 * investable bucket compounds at `returnRate`.
	 */
	bucketReturns?: RetirementBucketReturns;
	inflationRate: number;
	incomeGrowthRate: number;
	/** Grows 401(k) / Roth / taxable contribution targets. Defaults to salary. */
	contributionGrowthRate?: number;
	/** Grows living expenses. Defaults to inflation. */
	expenseGrowthRate?: number;
	cashYield: number;
	volatility: number;
	/**
	 * Starting non-mortgage debt. Used when `liabilities` is empty so older
	 * callers still subtract a flat balance against net worth.
	 */
	otherDebt?: number;
	/** Installment and revolving debts amortized on their own schedules. */
	liabilities?: ProjectedLiability[];

	/** Annual living expenses today, excluding housing and other-debt service. */
	preRetirementAnnualSpending: number;
	/**
	 * Observed trailing net cash flow (Insights net income). Hydrated for
	 * debug comparison; no longer the savings-capacity ceiling.
	 * `projectRetirement` does not read this field.
	 */
	preRetirementAnnualNetIncome: number;
	/** Current healthcare spend carved out of trailing Insights spending. */
	preRetirementAnnualHealthcare: number;
	/** Monthly retirement lifestyle estimate, in today's dollars. */
	retirementMonthlySpending: number;
	essentialShare: number;
	spendingStages: RetirementSpendingStage[];
	annualHealthcareSpending: number;
	healthcareCostMultiplier: number;
	/** Extra monthly premium while retired and younger than Medicare age. */
	preMedicareMonthlyPremium: number;
	/** Narrows the pre-Medicare premium to an explicit age window. */
	preMedicareWindow: { fromAge: number; toAge: number } | null;
	/** Age Medicare coverage begins. Defaults to `MEDICARE_AGE`. */
	medicareStartAge?: number;
	/**
	 * Part B + Part D + supplemental, per covered adult, per month. 0 leaves
	 * post-65 healthcare at the general figure, which is what the engine did
	 * before this existed.
	 */
	medicareMonthlyCost?: number;
	/**
	 * Points healthcare inflation runs above CPI. Defaults to
	 * `HEALTHCARE_INFLATION_PREMIUM`.
	 */
	healthcareInflationPremium?: number;

	properties: ProjectedProperty[];
	monthlyRentAfterHomeSale: number;
	rentFromAge: number | null;

	socialSecurity: SocialSecurityInputs;
	spouseSocialSecurity: SocialSecurityInputs | null;

	filingStatus: RetirementFilingStatus;
	stateTaxRate: number;
	stateTaxChange: { atAge: number; rate: number } | null;
	/** Applies SS / retirement-income exclusions on top of the flat rate. */
	stateRetirementTaxProfile?: StateRetirementTaxProfile | null;
	/** Profile that takes over at `stateTaxChange.atAge`. */
	stateTaxChangeProfile?: StateRetirementTaxProfile | null;
	withdrawalOrder: RetirementTaxTreatment[];
	rmdStartAge: number;
	/**
	 * Cash reserve target and where excess cash goes. Absent keeps the locked
	 * residual-to-cash behavior.
	 */
	cashPolicy?: CashPolicy;

	oneTimeEvents: OneTimeEvent[];
	recurringIncome: RecurringFlow[];
	recurringExpenses: RecurringFlow[];
	incomeGaps: IncomeGap[];
	incomeAdjustments: IncomeAdjustment[];
	marketShocks: MarketShock[];
	sequenceRisk: SequenceRisk | null;
	rothConversion: RothConversionPlan | null;
	annuities: AnnuityPlan[];
	longTermCareEvents: LongTermCareEvent[];
	ltcCoverage: LtcCoverage | null;
	lifeCoverage: LifeCoverage[];
	disabilityEvents: DisabilityEvent[];
	spouseDeathAtAge: number | null;
	insurancePremiums: InsurancePremium[];

	taxYear: number;
	/** Overrides the deterministic return with a per-year sequence (Monte Carlo). */
	returnSequence?: number[];
	/**
	 * Glide-path expected return by year index, precompiled from the allocation
	 * policy. `returnSequence` shocks around this mean rather than replacing it.
	 */
	returnSchedule?: number[];
};
