// Baseline plan layer: standing rules and singleton policies.
//
// A lever answers "what if I changed something." A standing rule or policy
// answers "this is how my financial life normally works." Rules are persisted
// rows keyed by `kind`, mirroring `RetirementScenarioLever`; policies are
// singleton JSON blobs on `RetirementPlan`, mirroring `spendingStages`.
//
// Every field defaults to the inert value, so an un-migrated plan and a plan
// with untouched policies project identically to one with no policies at all.

import { z } from "zod";
import {
	RetirementEssentialitySchema,
	RetirementIncomeTaxTreatmentSchema,
	retirementAgeSchema,
	retirementLabelSchema,
	retirementRateSchema,
	retirementShareSchema,
} from "./retirement-enums";

// ---------------------------------------------------------------------------
// Provenance
// ---------------------------------------------------------------------------

export const PolicyFieldSourceSchema = z.enum([
	"detected",
	"assumed",
	"profile",
	"userEdited",
]);
export type PolicyFieldSource = z.infer<typeof PolicyFieldSourceSchema>;

export const PolicyFieldConfidenceSchema = z.enum(["high", "medium", "low"]);
export type PolicyFieldConfidence = z.infer<typeof PolicyFieldConfidenceSchema>;

/**
 * Wraps a policy value with where it came from. `userEdited` is never
 * overwritten by a later detection pass; `detected` and `assumed` re-derive on
 * every baseline build, which is what keeps the baseline a live twin.
 */
export function policyField<Value extends z.ZodTypeAny>(value: Value) {
	return z.object({
		value,
		source: PolicyFieldSourceSchema,
		confidence: PolicyFieldConfidenceSchema,
		/** One short sentence for the UI chip. Never contains PII. */
		rationale: z.string().max(200),
	});
}

export const NumberPolicyFieldSchema = policyField(
	z.number().min(0).max(100_000_000),
);
export type NumberPolicyField = z.infer<typeof NumberPolicyFieldSchema>;

export const RatePolicyFieldSchema = policyField(retirementRateSchema);
export type RatePolicyField = z.infer<typeof RatePolicyFieldSchema>;

export const StateCodePolicyFieldSchema = policyField(
	z.string().length(2).toUpperCase(),
);
export type StateCodePolicyField = z.infer<typeof StateCodePolicyFieldSchema>;

// ---------------------------------------------------------------------------
// Standing rules
// ---------------------------------------------------------------------------

/**
 * The literal encoding of "amount/strategy + start age + optional end age".
 * Every rule with a lifecycle embeds this.
 */
export const EffectiveWindowSchema = z.object({
	fromAge: retirementAgeSchema,
	/** Null runs to the end of the planning horizon. */
	toAge: retirementAgeSchema.nullable(),
	inflates: z.boolean(),
	/** Applies only every N years, e.g. replacing a car. */
	everyNYears: z.number().int().min(1).max(50).nullable().optional(),
});
export type EffectiveWindow = z.infer<typeof EffectiveWindowSchema>;

export const RetirementStandingRuleKindSchema = z.enum([
	"PENSION",
	"ANNUITY",
	"RECURRING_INCOME",
	"RECURRING_EXPENSE",
]);
export type RetirementStandingRuleKind = z.infer<
	typeof RetirementStandingRuleKindSchema
>;

export const RETIREMENT_STANDING_RULE_KINDS =
	RetirementStandingRuleKindSchema.options;

const whomSchema = z.enum(["primary", "spouse"]);

export const PensionRuleParamsSchema = z.object({
	monthlyBenefit: z.number().min(0).max(1_000_000),
	startAge: retirementAgeSchema,
	/** Annual cost-of-living increase applied to the benefit, not general CPI. */
	colaRate: retirementRateSchema,
	/** Share of the benefit a survivor keeps after the covered person dies. */
	survivorPercent: retirementShareSchema,
	whom: whomSchema,
	taxTreatment: RetirementIncomeTaxTreatmentSchema,
});
export type PensionRuleParams = z.infer<typeof PensionRuleParamsSchema>;

export const AnnuityRuleParamsSchema = z.object({
	monthlyPayout: z.number().min(0).max(1_000_000),
	startAge: retirementAgeSchema,
	/** Lump sum paid out of liquid assets in the start year. */
	premium: z.number().min(0).max(100_000_000),
	hasCola: z.boolean(),
});
export type AnnuityRuleParams = z.infer<typeof AnnuityRuleParamsSchema>;

export const RecurringIncomeRuleParamsSchema = z.object({
	annualAmount: z.number().min(0).max(100_000_000),
	window: EffectiveWindowSchema,
	taxTreatment: RetirementIncomeTaxTreatmentSchema,
});
export type RecurringIncomeRuleParams = z.infer<
	typeof RecurringIncomeRuleParamsSchema
>;

export const RecurringExpenseRuleParamsSchema = z.object({
	annualAmount: z.number().min(0).max(100_000_000),
	window: EffectiveWindowSchema,
	essentiality: RetirementEssentialitySchema,
});
export type RecurringExpenseRuleParams = z.infer<
	typeof RecurringExpenseRuleParamsSchema
>;

/** The `{ kind, params }` pair, exactly as persisted in two columns. */
export const RetirementStandingRuleBodySchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("PENSION"),
		params: PensionRuleParamsSchema,
	}),
	z.object({
		kind: z.literal("ANNUITY"),
		params: AnnuityRuleParamsSchema,
	}),
	z.object({
		kind: z.literal("RECURRING_INCOME"),
		params: RecurringIncomeRuleParamsSchema,
	}),
	z.object({
		kind: z.literal("RECURRING_EXPENSE"),
		params: RecurringExpenseRuleParamsSchema,
	}),
]);
export type RetirementStandingRuleBody = z.infer<
	typeof RetirementStandingRuleBodySchema
>;

export const RetirementStandingRuleSchema = z.object({
	id: z.string().min(1),
	label: retirementLabelSchema,
	enabled: z.boolean(),
	sortOrder: z.number().int().min(0),
	/** How this rule's numbers were arrived at, for the provenance chip. */
	source: PolicyFieldSourceSchema,
	rule: RetirementStandingRuleBodySchema,
});
export type RetirementStandingRule = z.infer<
	typeof RetirementStandingRuleSchema
>;

export const UpsertRetirementStandingRuleInputSchema = z.object({
	/** Omitted for a create, present for an update. */
	id: z.string().min(1).optional(),
	label: retirementLabelSchema,
	enabled: z.boolean().optional(),
	sortOrder: z.number().int().min(0).optional(),
	source: PolicyFieldSourceSchema.optional(),
	rule: RetirementStandingRuleBodySchema,
});
export type UpsertRetirementStandingRuleInput = z.infer<
	typeof UpsertRetirementStandingRuleInputSchema
>;

export const DeleteRetirementStandingRuleInputSchema = z.object({
	id: z.string().min(1),
});
export type DeleteRetirementStandingRuleInput = z.infer<
	typeof DeleteRetirementStandingRuleInputSchema
>;

/** A recurring expense we detected but the user has not adopted as a rule. */
export const RetirementStandingRuleSuggestionSchema = z.object({
	key: z.string().min(1),
	label: retirementLabelSchema,
	rationale: z.string().max(200),
	rule: RetirementStandingRuleBodySchema,
});
export type RetirementStandingRuleSuggestion = z.infer<
	typeof RetirementStandingRuleSuggestionSchema
>;

// ---------------------------------------------------------------------------
// Contribution policy
// ---------------------------------------------------------------------------

/** "100% of the first 3%, then 50% of the next 2%" is two tiers, in order. */
export const MatchTierSchema = z.object({
	matchRate: z.number().min(0).max(5),
	upToPercent: retirementShareSchema,
});
export type MatchTier = z.infer<typeof MatchTierSchema>;

export const EmployerPlanContributionModeSchema = z.enum([
	"none",
	"fixedAnnual",
	"percentOfSalary",
	"maxAllowed",
]);
export type EmployerPlanContributionMode = z.infer<
	typeof EmployerPlanContributionModeSchema
>;

export const AccountContributionModeSchema = z.enum([
	"none",
	"fixedAnnual",
	"maxAllowed",
]);
export type AccountContributionMode = z.infer<
	typeof AccountContributionModeSchema
>;

export const EmployerPlanPolicySchema = z.object({
	mode: EmployerPlanContributionModeSchema,
	/** Dollars for `fixedAnnual`, a 0..1 share of salary for `percentOfSalary`. */
	amount: z.number().min(0).max(10_000_000).nullable(),
	/** Portion routed to Roth; the remainder is Traditional. */
	rothShare: retirementShareSchema,
	match: z.array(MatchTierSchema).max(4),
	profitSharingPercentOfSalary: retirementShareSchema,
});
export type EmployerPlanPolicy = z.infer<typeof EmployerPlanPolicySchema>;

export const IraPolicySchema = z.object({
	mode: AccountContributionModeSchema,
	amount: z.number().min(0).max(1_000_000).nullable(),
	kind: z.enum(["traditional", "roth"]),
	/**
	 * Skips the income phase-out check. Balances are right; the pro-rata rule on
	 * existing pre-tax IRA money is not modeled, and the UI says so.
	 */
	backdoor: z.boolean(),
});
export type IraPolicy = z.infer<typeof IraPolicySchema>;

export const HsaPolicySchema = z.object({
	mode: AccountContributionModeSchema,
	employeeAmount: z.number().min(0).max(1_000_000).nullable(),
	employerAmount: z.number().min(0).max(1_000_000),
	coverage: z.enum(["self", "family"]),
	invested: z.boolean(),
	/** Counts the balance toward retirement healthcare rather than general assets. */
	treatAsRetirementHealthcareAsset: z.boolean(),
});
export type HsaPolicy = z.infer<typeof HsaPolicySchema>;

export const PersonContributionPolicySchema = z.object({
	/**
	 * Gross pay before payroll tax and deferrals. Observed income is trailing
	 * net deposits, so this has to be grossed up or asked for; the engine keeps
	 * the take-home identity by taxing only the delta a new deferral creates.
	 */
	grossAnnualCompensation: NumberPolicyFieldSchema.nullable(),
	employerPlan: EmployerPlanPolicySchema,
	ira: IraPolicySchema,
	hsa: HsaPolicySchema,
	taxableMonthly: z.number().min(0).max(1_000_000),
});
export type PersonContributionPolicy = z.infer<
	typeof PersonContributionPolicySchema
>;

export const ContributionPolicySchema = z.object({
	primary: PersonContributionPolicySchema,
	spouse: PersonContributionPolicySchema.nullable(),
	autoApplyCatchUp: z.boolean(),
	/** Null means each person contributes while that person is still working. */
	contributionsStopAge: retirementAgeSchema.nullable(),
});
export type ContributionPolicy = z.infer<typeof ContributionPolicySchema>;

// ---------------------------------------------------------------------------
// Spending policy
// ---------------------------------------------------------------------------

export const SpendingPhaseSchema = z.object({
	label: z.string().max(60),
	fromAge: retirementAgeSchema,
	toAge: retirementAgeSchema.nullable(),
	/** Share of the at-retirement monthly figure this phase spends. */
	percentOfBase: z.number().min(0).max(3),
});
export type SpendingPhase = z.infer<typeof SpendingPhaseSchema>;

export const SpendingPhaseModelSchema = z.enum(["flat", "smile", "custom"]);
export type SpendingPhaseModel = z.infer<typeof SpendingPhaseModelSchema>;

export const SpendingPolicySchema = z.object({
	/** Share of today's lifestyle the household expects to spend at retirement. */
	retirementSpendPercentOfCurrent: RatePolicyFieldSchema.nullable(),
	/** User-edited monthly lifestyle headline; null keeps Insights trailing spend. */
	currentLifestyleMonthly: NumberPolicyFieldSchema.nullable().default(null),
	phaseModel: SpendingPhaseModelSchema,
	phases: z.array(SpendingPhaseSchema).max(6).nullable(),
});
export type SpendingPolicy = z.infer<typeof SpendingPolicySchema>;

// ---------------------------------------------------------------------------
// Healthcare policy
// ---------------------------------------------------------------------------

export const HealthcarePolicySchema = z.object({
	preMedicareMonthlyPremium: NumberPolicyFieldSchema.nullable(),
	medicareStartAge: retirementAgeSchema,
	/** Part B + Part D + supplemental, per covered adult. Null is not modeled. */
	medicareMonthlyCost: NumberPolicyFieldSchema.nullable(),
	/** Points healthcare inflation runs above CPI. Null keeps the engine default. */
	healthcareInflationPremium: RatePolicyFieldSchema.nullable(),
	includeHsaAsHealthcareAsset: z.boolean(),
});
export type HealthcarePolicy = z.infer<typeof HealthcarePolicySchema>;

// ---------------------------------------------------------------------------
// Tax policy
// ---------------------------------------------------------------------------

export const RothConversionModeSchema = z.enum([
	"none",
	"fixedAmount",
	"fillToBracket",
]);
export type RothConversionMode = z.infer<typeof RothConversionModeSchema>;

export const RothConversionPolicySchema = z.object({
	mode: RothConversionModeSchema,
	annualAmount: z.number().min(0).max(10_000_000).nullable(),
	/** Federal marginal rate to fill up to, e.g. 0.22. */
	targetBracket: retirementRateSchema.nullable(),
	/** Null lets the detected conversion window supply the age bounds. */
	fromAge: retirementAgeSchema.nullable(),
	toAge: retirementAgeSchema.nullable(),
});
export type RothConversionPolicy = z.infer<typeof RothConversionPolicySchema>;

export const TaxPolicySchema = z.object({
	currentStateCode: StateCodePolicyFieldSchema.nullable(),
	retirementStateCode: StateCodePolicyFieldSchema.nullable(),
	stateChangeAtAge: retirementAgeSchema.nullable(),
	/**
	 * Applies per-state Social Security and retirement-income exclusions instead
	 * of one flat rate on all taxable income.
	 */
	applyStateRetirementIncomeRules: z.boolean(),
	rothConversion: RothConversionPolicySchema,
});
export type TaxPolicy = z.infer<typeof TaxPolicySchema>;

// ---------------------------------------------------------------------------
// Cash policy
// ---------------------------------------------------------------------------

export const CashDestinationSchema = z.enum(["cash", "taxable"]);
export type CashDestination = z.infer<typeof CashDestinationSchema>;

export const CashPolicySchema = z.object({
	targetReserve: z.object({
		mode: z.enum(["months", "fixed"]),
		months: z.number().min(0).max(120),
		amount: z.number().min(0).max(100_000_000),
	}),
	/** Where cash above the reserve goes. `cash` is today's locked behavior. */
	excessDestination: CashDestinationSchema,
	rmdExcessDestination: CashDestinationSchema,
});
export type CashPolicy = z.infer<typeof CashPolicySchema>;

// ---------------------------------------------------------------------------
// Allocation policy
// ---------------------------------------------------------------------------

export const AllocationPolicySchema = z.object({
	targetEquityPercent: RatePolicyFieldSchema.nullable(),
	glidePath: z.object({
		enabled: z.boolean(),
		equityAtRetirement: retirementShareSchema,
		equityAtLongevity: retirementShareSchema,
	}),
	expectedEquityReturn: retirementRateSchema,
	expectedBondReturn: retirementRateSchema,
});
export type AllocationPolicy = z.infer<typeof AllocationPolicySchema>;

// ---------------------------------------------------------------------------
// The policy bundle stored on the plan
// ---------------------------------------------------------------------------

export const RetirementPoliciesSchema = z.object({
	contribution: ContributionPolicySchema,
	spending: SpendingPolicySchema,
	healthcare: HealthcarePolicySchema,
	tax: TaxPolicySchema,
	cash: CashPolicySchema,
	allocation: AllocationPolicySchema,
});
export type RetirementPolicies = z.infer<typeof RetirementPoliciesSchema>;

export const UpdateRetirementPoliciesInputSchema = z.object({
	contribution: ContributionPolicySchema.optional(),
	spending: SpendingPolicySchema.optional(),
	healthcare: HealthcarePolicySchema.optional(),
	tax: TaxPolicySchema.optional(),
	cash: CashPolicySchema.optional(),
	allocation: AllocationPolicySchema.optional(),
});
export type UpdateRetirementPoliciesInput = z.infer<
	typeof UpdateRetirementPoliciesInputSchema
>;

// ---------------------------------------------------------------------------
// Inert defaults
// ---------------------------------------------------------------------------

const EMPTY_PERSON_CONTRIBUTION_POLICY: PersonContributionPolicy = {
	grossAnnualCompensation: null,
	employerPlan: {
		mode: "none",
		amount: null,
		rothShare: 0,
		match: [],
		profitSharingPercentOfSalary: 0,
	},
	ira: { mode: "none", amount: null, kind: "traditional", backdoor: false },
	hsa: {
		mode: "none",
		employeeAmount: null,
		employerAmount: 0,
		coverage: "self",
		invested: true,
		treatAsRetirementHealthcareAsset: true,
	},
	taxableMonthly: 0,
};

export function emptyPersonContributionPolicy(): PersonContributionPolicy {
	return structuredClone(EMPTY_PERSON_CONTRIBUTION_POLICY);
}

/**
 * The zero policy. Populating nothing must project exactly as the engine did
 * before policies existed — every phase's golden fixtures depend on it.
 */
export const EMPTY_RETIREMENT_POLICIES: RetirementPolicies = {
	contribution: {
		primary: EMPTY_PERSON_CONTRIBUTION_POLICY,
		spouse: null,
		autoApplyCatchUp: true,
		contributionsStopAge: null,
	},
	spending: {
		retirementSpendPercentOfCurrent: null,
		currentLifestyleMonthly: null,
		phaseModel: "flat",
		phases: null,
	},
	healthcare: {
		preMedicareMonthlyPremium: null,
		medicareStartAge: 65,
		medicareMonthlyCost: null,
		healthcareInflationPremium: null,
		includeHsaAsHealthcareAsset: true,
	},
	tax: {
		currentStateCode: null,
		retirementStateCode: null,
		stateChangeAtAge: null,
		applyStateRetirementIncomeRules: false,
		rothConversion: {
			mode: "none",
			annualAmount: null,
			targetBracket: null,
			fromAge: null,
			toAge: null,
		},
	},
	cash: {
		targetReserve: { mode: "months", months: 6, amount: 0 },
		excessDestination: "cash",
		rmdExcessDestination: "cash",
	},
	allocation: {
		targetEquityPercent: null,
		glidePath: {
			enabled: false,
			equityAtRetirement: 0.6,
			equityAtLongevity: 0.4,
		},
		expectedEquityReturn: 0.08,
		expectedBondReturn: 0.04,
	},
};

export function emptyRetirementPolicies(): RetirementPolicies {
	return structuredClone(EMPTY_RETIREMENT_POLICIES);
}

function personIsActive(policies: ContributionPolicy): boolean {
	return (
		policies.primary.employerPlan.mode !== "none" ||
		policies.primary.ira.mode !== "none" ||
		policies.primary.hsa.mode !== "none" ||
		policies.primary.taxableMonthly > 0 ||
		(policies.spouse !== null &&
			(policies.spouse.employerPlan.mode !== "none" ||
				policies.spouse.ira.mode !== "none" ||
				policies.spouse.hsa.mode !== "none" ||
				policies.spouse.taxableMonthly > 0))
	);
}

/**
 * What the Plan Settings drawer shows: a stored policy if the household has
 * one, otherwise the live derived defaults. Derived values are never compiled
 * into the projection until the user saves them.
 */
export function policiesForDrawer(
	stored: RetirementPolicies,
	defaults: RetirementPolicies,
): RetirementPolicies {
	const spendingActive =
		stored.spending.retirementSpendPercentOfCurrent !== null ||
		stored.spending.currentLifestyleMonthly !== null ||
		(stored.spending.phases !== null && stored.spending.phases.length > 0) ||
		stored.spending.phaseModel !== "flat";
	const healthcareActive =
		stored.healthcare.preMedicareMonthlyPremium !== null ||
		stored.healthcare.medicareMonthlyCost !== null ||
		stored.healthcare.healthcareInflationPremium !== null;
	const taxActive =
		stored.tax.currentStateCode !== null ||
		stored.tax.retirementStateCode !== null ||
		stored.tax.stateChangeAtAge !== null ||
		stored.tax.rothConversion.mode !== "none";
	const allocationActive =
		stored.allocation.targetEquityPercent !== null ||
		stored.allocation.glidePath.enabled;

	return {
		contribution: personIsActive(stored.contribution)
			? stored.contribution
			: defaults.contribution,
		spending: spendingActive ? stored.spending : defaults.spending,
		healthcare: healthcareActive ? stored.healthcare : defaults.healthcare,
		tax: taxActive ? stored.tax : defaults.tax,
		cash: stored.cash,
		allocation: allocationActive ? stored.allocation : defaults.allocation,
	};
}

/** Two-letter codes for the state picker. Rates live in the domain engine. */
export const US_STATE_CODES = [
	"AK",
	"AL",
	"AR",
	"AZ",
	"CA",
	"CO",
	"CT",
	"DC",
	"DE",
	"FL",
	"GA",
	"HI",
	"IA",
	"ID",
	"IL",
	"IN",
	"KS",
	"KY",
	"LA",
	"MA",
	"MD",
	"ME",
	"MI",
	"MN",
	"MO",
	"MS",
	"MT",
	"NC",
	"ND",
	"NE",
	"NH",
	"NJ",
	"NM",
	"NV",
	"NY",
	"OH",
	"OK",
	"OR",
	"PA",
	"RI",
	"SC",
	"SD",
	"TN",
	"TX",
	"UT",
	"VA",
	"VT",
	"WA",
	"WI",
	"WV",
	"WY",
] as const;
