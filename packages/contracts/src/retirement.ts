// Retirement contracts — the single definition of the retirement lever union,
// the projection ledger, and every request/response shape used by the API, the
// desktop IPC bridge, the shared UI, the MCP tools, and the iOS decoder.
//
// A retirement scenario is never a copy of the user's plan. It is
// `baseline + an ordered list of typed levers`, so the only thing persisted is
// the lever list.

import { z } from "zod";
import {
	RetirementCadenceSchema,
	RetirementEssentialitySchema,
	RetirementIncomeTaxTreatmentSchema,
	RetirementLeverCategorySchema,
	RetirementScenarioSourceSchema,
	RetirementSpendingStageSchema,
	RetirementSpendingTreatmentSchema,
	RetirementTaxTreatmentSchema,
	retirementAgeSchema,
	retirementLabelSchema,
	retirementPositiveAmountSchema,
	retirementRateSchema,
	retirementSignedAmountSchema,
} from "./retirement-enums";
import {
	AllocationPolicySchema,
	CashPolicySchema,
	ContributionPolicySchema,
	HealthcarePolicySchema,
	RetirementPoliciesSchema,
	RetirementStandingRuleSchema,
	RetirementStandingRuleSuggestionSchema,
	SpendingPolicySchema,
	TaxPolicySchema,
} from "./retirement-policies";

export type {
	RetirementCadence,
	RetirementEssentiality,
	RetirementIncomeTaxTreatment,
	RetirementLeverCategory,
	RetirementScenarioSource,
	RetirementSpendingStage,
	RetirementSpendingTreatment,
	RetirementTaxTreatment,
} from "./retirement-enums";
export {
	RetirementCadenceSchema,
	RetirementEssentialitySchema,
	RetirementIncomeTaxTreatmentSchema,
	RetirementLeverCategorySchema,
	RetirementScenarioSourceSchema,
	RetirementSpendingStageSchema,
	RetirementSpendingTreatmentSchema,
	RetirementTaxTreatmentSchema,
};

// ---------------------------------------------------------------------------
// Lever union
// ---------------------------------------------------------------------------

const ageSchema = retirementAgeSchema;
const yearsSchema = z.number().int().min(1).max(30);
const labelSchema = retirementLabelSchema;
const positiveAmountSchema = retirementPositiveAmountSchema;
const signedAmountSchema = retirementSignedAmountSchema;
const rateSchema = retirementRateSchema;

/**
 * Every lever the engine understands. Adding a lever means adding a member
 * here, an engine branch in `applyLevers`, and a catalog entry for the UI.
 * There is no second definition of this union anywhere in the repo.
 */
export const RetirementLeverSchema = z.discriminatedUnion("type", [
	// --- Work & income ------------------------------------------------------
	z.object({
		type: z.literal("retire_earlier"),
		params: z.object({ years: yearsSchema }),
	}),
	z.object({
		type: z.literal("retire_later"),
		params: z.object({ years: yearsSchema }),
	}),
	z.object({
		type: z.literal("retire_at_age"),
		params: z.object({ age: ageSchema }),
	}),
	z.object({
		type: z.literal("stop_working_at_age"),
		params: z.object({ age: ageSchema }),
	}),
	z.object({
		type: z.literal("part_time_before_retirement"),
		params: z.object({
			annualIncome: z.number().min(0).max(10_000_000),
			fromAge: ageSchema,
			toAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("spouse_retire_at_age"),
		params: z.object({ age: ageSchema }),
	}),
	z.object({
		type: z.literal("spouse_stops_working"),
		params: z.object({ atAge: ageSchema }),
	}),
	z.object({
		type: z.literal("income_change"),
		params: z.object({
			annualDelta: signedAmountSchema.optional(),
			percentDelta: rateSchema.optional(),
			fromAge: ageSchema.optional(),
			whom: z.enum(["primary", "spouse"]).default("primary"),
		}),
	}),
	z.object({
		type: z.literal("job_loss"),
		params: z.object({
			atAge: ageSchema,
			monthsOut: z.number().int().min(1).max(120),
			severanceAmount: z.number().min(0).max(10_000_000).optional(),
		}),
	}),
	z.object({
		type: z.literal("career_break"),
		params: z.object({ fromAge: ageSchema, toAge: ageSchema }),
	}),
	z.object({
		type: z.literal("annual_bonus"),
		params: z.object({
			amount: positiveAmountSchema,
			fromAge: ageSchema,
			toAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("side_business_income"),
		params: z.object({
			annualAmount: positiveAmountSchema,
			fromAge: ageSchema,
			toAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("rental_income_change"),
		params: z.object({
			propertyId: z.string().min(1).optional(),
			monthlyAmount: signedAmountSchema,
			fromAge: ageSchema,
			toAge: ageSchema.nullable().optional(),
		}),
	}),

	// --- Savings ------------------------------------------------------------
	z.object({
		type: z.literal("contribution_change"),
		params: z.object({
			accountId: z.string().min(1).optional(),
			monthlyDelta: signedAmountSchema,
			taxTreatment: RetirementTaxTreatmentSchema.optional(),
		}),
	}),
	z.object({
		type: z.literal("max_401k"),
		params: z.object({ includeCatchUp: z.boolean().default(true) }),
	}),
	z.object({
		type: z.literal("max_roth_ira"),
		params: z.object({ includeCatchUp: z.boolean().default(true) }),
	}),
	z.object({
		type: z.literal("max_spousal_iras"),
		params: z.object({ includeCatchUp: z.boolean().default(true) }),
	}),
	z.object({
		type: z.literal("employer_match"),
		params: z.object({
			matchPercent: z.number().min(0).max(2),
			upToPercentOfSalary: z.number().min(0).max(1),
		}),
	}),
	z.object({
		type: z.literal("max_hsa"),
		params: z.object({ coverageType: z.enum(["self", "family"]) }),
	}),
	z.object({
		type: z.literal("taxable_investing"),
		params: z.object({ monthlyAmount: z.number().min(0).max(10_000_000) }),
	}),
	z.object({
		type: z.literal("stop_contributions_at_age"),
		params: z.object({ age: ageSchema }),
	}),

	// --- Retirement spending ------------------------------------------------
	z.object({
		type: z.literal("retirement_spending_change"),
		params: z.object({ monthlyDelta: signedAmountSchema }),
	}),
	z.object({
		type: z.literal("retirement_spending_set"),
		params: z.object({ monthlyAmount: z.number().min(0).max(10_000_000) }),
	}),
	z.object({
		type: z.literal("retirement_spending_stages"),
		params: z.object({
			stages: z.array(RetirementSpendingStageSchema).min(1).max(8),
		}),
	}),
	z.object({
		type: z.literal("spending_category_change"),
		params: z.object({
			label: labelSchema,
			lineItemType: z.enum(["income", "expense", "savings", "debt"]),
			monthlyDelta: signedAmountSchema,
			matchKey: z.string().min(1).max(120),
			isRemoved: z.boolean(),
			isNew: z.boolean(),
			newMonthlyAmount: z.number().min(0).max(10_000_000).optional(),
		}),
	}),

	// --- Investments --------------------------------------------------------
	z.object({
		type: z.literal("return_rate_delta"),
		params: z.object({ delta: rateSchema }),
	}),
	z.object({
		type: z.literal("return_rate_set"),
		params: z.object({ rate: z.number().min(-0.2).max(0.3) }),
	}),
	z.object({
		type: z.literal("inflation_delta"),
		params: z.object({ delta: rateSchema }),
	}),
	z.object({
		type: z.literal("portfolio_shift"),
		params: z.object({
			target: z.enum(["conservative", "balanced", "aggressive"]),
		}),
	}),
	z.object({
		type: z.literal("market_crash"),
		params: z.object({
			atAge: ageSchema,
			dropPercent: z.number().min(0.01).max(0.9),
			recoveryYears: z.number().int().min(0).max(20),
		}),
	}),
	z.object({
		type: z.literal("sequence_risk"),
		params: z.object({
			years: z.number().int().min(1).max(15),
			annualReturn: z.number().min(-0.3).max(0.2),
		}),
	}),

	// --- Social Security ----------------------------------------------------
	z.object({
		type: z.literal("social_security_claim_age"),
		params: z.object({ age: ageSchema }),
	}),
	z.object({
		type: z.literal("spouse_social_security_claim_age"),
		params: z.object({ age: ageSchema }),
	}),
	z.object({
		type: z.literal("social_security_haircut"),
		params: z.object({ percent: z.number().min(0).max(1) }),
	}),

	// --- Housing ------------------------------------------------------------
	z.object({
		type: z.literal("mortgage_payoff_early"),
		params: z.object({
			propertyId: z.string().min(1).optional(),
			atAge: ageSchema.optional(),
			extraMonthlyPayment: z.number().min(0).max(1_000_000).optional(),
		}),
	}),
	z.object({
		type: z.literal("mortgage_extra_payment"),
		params: z.object({
			propertyId: z.string().min(1).optional(),
			monthlyAmount: z.number().min(0).max(1_000_000),
		}),
	}),
	z.object({
		type: z.literal("mortgage_payoff_cancel"),
		params: z.object({ propertyId: z.string().min(1).optional() }),
	}),
	z.object({
		type: z.literal("buy_home"),
		params: z.object({
			atAge: ageSchema,
			price: positiveAmountSchema,
			downPayment: z.number().min(0).max(1_000_000_000),
			rate: z.number().min(0).max(0.3),
			termYears: z.number().int().min(1).max(40),
			usage: z
				.enum(["PRIMARY_RESIDENCE", "RENTAL", "VACATION_HOME"])
				.default("PRIMARY_RESIDENCE"),
		}),
	}),
	z.object({
		type: z.literal("upsize_home"),
		params: z.object({ atAge: ageSchema, priceDelta: positiveAmountSchema }),
	}),
	z.object({
		type: z.literal("downsize_home"),
		params: z.object({
			atAge: ageSchema,
			newHomePrice: z.number().min(0).max(1_000_000_000),
		}),
	}),
	z.object({
		type: z.literal("sell_primary_home"),
		params: z.object({
			atAge: ageSchema,
			thenRent: z.boolean().default(true),
			monthlyRent: z.number().min(0).max(1_000_000).optional(),
		}),
	}),
	z.object({
		type: z.literal("rent_instead"),
		params: z.object({
			fromAge: ageSchema,
			monthlyRent: z.number().min(0).max(1_000_000),
		}),
	}),
	z.object({
		type: z.literal("add_rental_property"),
		params: z.object({
			atAge: ageSchema,
			price: positiveAmountSchema,
			downPayment: z.number().min(0).max(1_000_000_000),
			monthlyRent: z.number().min(0).max(1_000_000),
			monthlyExpenses: z.number().min(0).max(1_000_000),
		}),
	}),
	z.object({
		type: z.literal("sell_rental_property"),
		params: z.object({
			propertyId: z.string().min(1).optional(),
			atAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("move_state"),
		params: z.object({
			atAge: ageSchema,
			stateCode: z.string().length(2),
			stateTaxRate: z.number().min(0).max(0.2).optional(),
		}),
	}),

	// --- Big life events ----------------------------------------------------
	z.object({
		type: z.literal("add_dependent"),
		params: z.object({
			atAge: ageSchema,
			annualCost: positiveAmountSchema,
			years: yearsSchema,
		}),
	}),
	z.object({
		type: z.literal("fund_college"),
		params: z.object({
			startAge: ageSchema,
			years: yearsSchema,
			annualCost: positiveAmountSchema,
		}),
	}),
	z.object({
		type: z.literal("charitable_gift"),
		params: z.object({
			amount: positiveAmountSchema,
			atAge: ageSchema,
			recurringYears: z.number().int().min(1).max(50).optional(),
		}),
	}),
	z.object({
		type: z.literal("recurring_purchase"),
		params: z.object({
			amount: positiveAmountSchema,
			fromAge: ageSchema,
			toAge: ageSchema,
			everyNYears: z.number().int().min(1).max(30),
			label: labelSchema,
		}),
	}),

	// --- Healthcare ---------------------------------------------------------
	z.object({
		type: z.literal("healthcare_cost_delta"),
		params: z.object({
			percentDelta: z.number().min(-1).max(5).optional(),
			monthlyDelta: signedAmountSchema.optional(),
		}),
	}),
	z.object({
		type: z.literal("pre_medicare_coverage"),
		params: z.object({
			monthlyPremium: z.number().min(0).max(100_000),
			fromAge: ageSchema,
			toAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("long_term_care_event"),
		params: z.object({
			atAge: ageSchema,
			years: z.number().int().min(1).max(15),
			monthlyCost: z.number().min(0).max(1_000_000),
			whom: z.enum(["primary", "spouse", "both"]).default("primary"),
		}),
	}),

	// --- Insurance ----------------------------------------------------------
	z.object({
		type: z.literal("life_insurance_change"),
		params: z.object({
			policyId: z.string().min(1).optional(),
			deathBenefit: z.number().min(0).max(1_000_000_000).optional(),
			annualPremium: z.number().min(0).max(1_000_000).optional(),
			termYears: z.number().int().min(1).max(60).optional(),
			remove: z.boolean().default(false),
		}),
	}),
	z.object({
		type: z.literal("policy_expires"),
		params: z.object({
			policyId: z.string().min(1),
			atAge: ageSchema,
		}),
	}),
	z.object({
		type: z.literal("ltc_policy_change"),
		params: z.object({
			policyId: z.string().min(1).optional(),
			monthlyBenefit: z.number().min(0).max(1_000_000).optional(),
			benefitYears: z.number().int().min(1).max(20).optional(),
			eliminationDays: z.number().int().min(0).max(730).optional(),
			inflationProtection: z.boolean().optional(),
			remove: z.boolean().default(false),
		}),
	}),
	z.object({
		type: z.literal("annuity_begins"),
		params: z.object({
			atAge: ageSchema,
			monthlyPayout: z.number().min(0).max(1_000_000),
			premium: z.number().min(0).max(1_000_000_000),
			hasCola: z.boolean().default(false),
		}),
	}),
	z.object({
		type: z.literal("disability_event"),
		params: z.object({
			atAge: ageSchema,
			durationYears: z.number().int().min(1).max(50),
			monthlyBenefit: z.number().min(0).max(1_000_000).optional(),
		}),
	}),
	z.object({
		type: z.literal("spouse_death"),
		params: z.object({ atAge: ageSchema }),
	}),

	// --- Taxes --------------------------------------------------------------
	z.object({
		type: z.literal("roth_conversion"),
		params: z.object({
			fromAge: ageSchema,
			toAge: ageSchema,
			annualAmount: z.number().min(0).max(10_000_000).optional(),
			fillToBracket: z.number().min(0).max(1).optional(),
		}),
	}),
	z.object({
		type: z.literal("withdrawal_order"),
		params: z.object({
			order: z.array(RetirementTaxTreatmentSchema).length(3),
		}),
	}),

	// --- Custom -------------------------------------------------------------
	z.object({
		type: z.literal("custom_income"),
		params: z.object({
			amount: positiveAmountSchema,
			cadence: RetirementCadenceSchema,
			fromAge: ageSchema,
			toAge: ageSchema,
			taxTreatment: RetirementIncomeTaxTreatmentSchema.default("taxable"),
			label: labelSchema,
		}),
	}),
	z.object({
		type: z.literal("custom_expense"),
		params: z.object({
			amount: positiveAmountSchema,
			cadence: RetirementCadenceSchema,
			fromAge: ageSchema,
			toAge: ageSchema,
			essentiality: RetirementEssentialitySchema.default("flexible"),
			label: labelSchema,
		}),
	}),
	z.object({
		type: z.literal("custom_one_time"),
		params: z.object({
			direction: z.enum(["inflow", "outflow"]),
			amount: positiveAmountSchema,
			atAge: ageSchema,
			label: labelSchema,
			taxTreatment: RetirementIncomeTaxTreatmentSchema.default("taxable"),
		}),
	}),
]);

export type RetirementLever = z.infer<typeof RetirementLeverSchema>;
export type RetirementLeverType = RetirementLever["type"];

/** Every lever type, ordered by category. Used by catalogs and tests. */
export const RETIREMENT_LEVER_TYPES = RetirementLeverSchema.options.map(
	(option) => option.shape.type.value,
) as [RetirementLeverType, ...RetirementLeverType[]];

/** A lever as it exists inside a scenario or working stack. */
export const RetirementScenarioLeverSchema = z.object({
	id: z.string().min(1),
	enabled: z.boolean().default(true),
	sortOrder: z.number().int().min(0),
	lever: RetirementLeverSchema,
});
export type RetirementScenarioLever = z.infer<
	typeof RetirementScenarioLeverSchema
>;

/** Input shape for creating/replacing levers — id is server-assigned. */
export const RetirementLeverInputSchema = z.object({
	id: z.string().min(1).optional(),
	enabled: z.boolean().optional(),
	sortOrder: z.number().int().min(0).optional(),
	lever: RetirementLeverSchema,
});
export type RetirementLeverInput = z.infer<typeof RetirementLeverInputSchema>;

// ---------------------------------------------------------------------------
// Plan settings
// ---------------------------------------------------------------------------

/** One source of truth for trial bounds, shared by reads, writes, and the form. */
export const MONTE_CARLO_TRIALS_MIN = 100;
export const MONTE_CARLO_TRIALS_MAX = 2000;

export const RetirementPlanSettingsSchema = z.object({
	primaryBirthYear: z.number().int().min(1900).max(2100).nullable(),
	primaryCurrentAge: ageSchema,
	targetRetirementAge: ageSchema,
	longevityAge: ageSchema,
	socialSecurityClaimAge: ageSchema,
	socialSecurityMonthlyAtFra: z.number().min(0).max(100_000).nullable(),
	hasSpouse: z.boolean(),
	spouseBirthYear: z.number().int().min(1900).max(2100).nullable(),
	spouseCurrentAge: ageSchema.nullable(),
	spouseRetirementAge: ageSchema.nullable(),
	spouseLongevityAge: ageSchema.nullable(),
	spouseSocialSecurityClaimAge: ageSchema.nullable(),
	spouseSocialSecurityMonthlyAtFra: z.number().min(0).max(100_000).nullable(),
	annualEmploymentIncome: z.number().min(0).max(10_000_000).nullable(),
	annualSpouseEmploymentIncome: z.number().min(0).max(10_000_000).nullable(),
	confidenceTarget: z.number().min(0.5).max(0.99),
	monteCarloTrials: z
		.number()
		.int()
		.min(MONTE_CARLO_TRIALS_MIN)
		.max(MONTE_CARLO_TRIALS_MAX),
	spendingStages: z.array(RetirementSpendingStageSchema),
	withdrawalOrder: z.array(RetirementTaxTreatmentSchema).length(3),
	contributionPolicy: ContributionPolicySchema,
	spendingPolicy: SpendingPolicySchema,
	healthcarePolicy: HealthcarePolicySchema,
	taxPolicy: TaxPolicySchema,
	cashPolicy: CashPolicySchema,
	allocationPolicy: AllocationPolicySchema,
});
export type RetirementPlanSettings = z.infer<
	typeof RetirementPlanSettingsSchema
>;

export const UpdateRetirementPlanInputSchema = z.object({
	primaryBirthYear: z.number().int().min(1900).max(2100).nullable().optional(),
	targetRetirementAge: ageSchema.optional(),
	longevityAge: ageSchema.optional(),
	socialSecurityClaimAge: ageSchema.optional(),
	socialSecurityMonthlyAtFra: z
		.number()
		.min(0)
		.max(100_000)
		.nullable()
		.optional(),
	hasSpouse: z.boolean().optional(),
	spouseBirthYear: z.number().int().min(1900).max(2100).nullable().optional(),
	spouseRetirementAge: ageSchema.nullable().optional(),
	spouseLongevityAge: ageSchema.nullable().optional(),
	spouseSocialSecurityClaimAge: ageSchema.nullable().optional(),
	spouseSocialSecurityMonthlyAtFra: z
		.number()
		.min(0)
		.max(100_000)
		.nullable()
		.optional(),
	annualEmploymentIncome: z
		.number()
		.min(0)
		.max(10_000_000)
		.nullable()
		.optional(),
	annualSpouseEmploymentIncome: z
		.number()
		.min(0)
		.max(10_000_000)
		.nullable()
		.optional(),
	confidenceTarget: z.number().min(0.5).max(0.99).optional(),
	monteCarloTrials: z
		.number()
		.int()
		.min(MONTE_CARLO_TRIALS_MIN)
		.max(MONTE_CARLO_TRIALS_MAX)
		.optional(),
	spendingStages: z.array(RetirementSpendingStageSchema).max(8).optional(),
	withdrawalOrder: z.array(RetirementTaxTreatmentSchema).length(3).optional(),
	contributionPolicy: ContributionPolicySchema.optional(),
	spendingPolicy: SpendingPolicySchema.optional(),
	healthcarePolicy: HealthcarePolicySchema.optional(),
	taxPolicy: TaxPolicySchema.optional(),
	cashPolicy: CashPolicySchema.optional(),
	allocationPolicy: AllocationPolicySchema.optional(),
});
export type UpdateRetirementPlanInput = z.infer<
	typeof UpdateRetirementPlanInputSchema
>;

// ---------------------------------------------------------------------------
// Projection ledger
// ---------------------------------------------------------------------------

export const RetirementProjectionYearSchema = z.object({
	year: z.number().int(),
	age: z.number().int(),
	spouseAge: z.number().int().nullable(),
	isRetired: z.boolean(),
	employmentIncome: z.number(),
	spouseEmploymentIncome: z.number(),
	socialSecurityIncome: z.number(),
	spouseSocialSecurityIncome: z.number(),
	rentalIncome: z.number(),
	otherIncome: z.number(),
	insuranceIncome: z.number(),
	oneTimeInflows: z.number(),
	grossIncome: z.number(),
	contributionsTaxable: z.number(),
	contributionsTaxDeferred: z.number(),
	contributionsTaxFree: z.number(),
	contributionsCash: z.number(),
	/**
	 * Employer match and profit sharing. Money the household never sees, so it
	 * is a pure balance addition and never appears in the leftover identity.
	 */
	employerContributions: z.number(),
	/** Pre-tax salary deferral. Reduces take-home by its after-tax cost only. */
	employeeDeferral: z.number(),
	/** Signed take-home minus spending minus cash-flow tax. Engine always writes it. */
	cashFlowLeftover: z.number(),
	/** Tax subtracted in the leftover identity (not the display tax on wages). */
	cashFlowTax: z.number(),
	withdrawalsTaxable: z.number(),
	withdrawalsTaxDeferred: z.number(),
	withdrawalsTaxFree: z.number(),
	requiredMinimumDistribution: z.number(),
	rothConversion: z.number(),
	livingExpenses: z.number(),
	/** Non-discretionary outflow: housing, healthcare, premiums, debt service. */
	essentialExpenses: z.number(),
	/** `essentialExpenses + flexibleExpenses + oneTimeExpenses === totalOutflow`. */
	flexibleExpenses: z.number(),
	healthcareExpenses: z.number(),
	housingExpenses: z.number(),
	oneTimeExpenses: z.number(),
	insurancePremiums: z.number(),
	totalOutflow: z.number(),
	taxableIncome: z.number(),
	taxesPaid: z.number(),
	marginalRate: z.number(),
	effectiveRate: z.number(),
	spendableIncome: z.number(),
	balanceTaxable: z.number(),
	balanceTaxDeferred: z.number(),
	balanceTaxFree: z.number(),
	liquidAssets: z.number(),
	realEstateEquity: z.number(),
	debtBalance: z.number(),
	netWorth: z.number(),
	shortfall: z.number(),
	inflationFactor: z.number(),
	netWorthTodayDollars: z.number(),
	liquidAssetsTodayDollars: z.number(),
	cashBalance: z.number(),
	otherDebt: z.number(),
});
export type RetirementProjectionYear = z.infer<
	typeof RetirementProjectionYearSchema
>;

export const RetirementMilestoneKindSchema = z.enum([
	"retirement",
	"spouseRetirement",
	"socialSecurity",
	"spouseSocialSecurity",
	"medicare",
	"rmd",
	"mortgagePaidOff",
	"homeSale",
	"college",
	"policyExpiry",
	"annuityStart",
	"longTermCare",
	"spouseDeath",
]);
export type RetirementMilestoneKind = z.infer<
	typeof RetirementMilestoneKindSchema
>;

export const RetirementMilestoneSchema = z.object({
	kind: RetirementMilestoneKindSchema,
	label: z.string(),
	age: z.number(),
	year: z.number().int(),
});
export type RetirementMilestone = z.infer<typeof RetirementMilestoneSchema>;

export const RetirementProjectionSummarySchema = z.object({
	targetRetirementAge: z.number(),
	retirementAgeUsed: z.number(),
	earliestSustainableAge: z.number().nullable(),
	longevityAge: z.number(),
	confidence: z.number().nullable(),
	safeMonthlySpending: z.number().nullable(),
	expectedMonthlySpending: z.number(),
	assetsAtRetirement: z.number(),
	netWorthAtRetirement: z.number(),
	assetsAtRetirementTodayDollars: z.number(),
	netWorthAtRetirementTodayDollars: z.number(),
	legacyAtLongevity: z.number(),
	legacyAtLongevityTodayDollars: z.number(),
	confidenceTarget: z.number(),
	lifetimeTaxes: z.number(),
	lifetimeSocialSecurity: z.number(),
	firstShortfallAge: z.number().nullable(),
	fundedThroughLongevity: z.boolean(),
	monthlyShortfallAtTarget: z.number(),
});
export type RetirementProjectionSummary = z.infer<
	typeof RetirementProjectionSummarySchema
>;

export const RetirementAppliedLeverSchema = z.object({
	id: z.string(),
	type: z.string(),
	enabled: z.boolean(),
	sortOrder: z.number().int(),
	applied: z.boolean(),
	conflictField: z.string().nullable(),
	overriddenByLeverId: z.string().nullable(),
	overriddenByLabel: z.string().nullable(),
	overridesLeverIds: z.array(z.string()),
	note: z.string().nullable(),
});
export type RetirementAppliedLever = z.infer<
	typeof RetirementAppliedLeverSchema
>;

export const RetirementAssumptionsSchema = z.object({
	investmentReturnRate: z.number(),
	inflationRate: z.number(),
	salaryGrowthRate: z.number(),
	contributionGrowthRate: z.number(),
	expenseGrowthRate: z.number(),
	realEstateAppreciationRate: z.number(),
	cashYield: z.number(),
	volatility: z.number(),
	federalFilingStatus: z.string(),
	stateTaxRate: z.number(),
	taxYear: z.number().int(),
	rmdStartAge: z.number().int(),
	withdrawalOrder: z.array(RetirementTaxTreatmentSchema),
	scenarioRatesSource: z.string(),
});
export type RetirementAssumptions = z.infer<typeof RetirementAssumptionsSchema>;

/**
 * How taxable / deferred / tax-free balances map onto named account types.
 * Remainders (1 − these shares) land in Other, along with cash.
 */
export const RetirementLiquidTypeMixSchema = z.object({
	stocksOfTaxable: z.number(),
	four01kOfDeferred: z.number(),
	rothOfTaxFree: z.number(),
	hsaOfTaxFree: z.number(),
});
export type RetirementLiquidTypeMix = z.infer<
	typeof RetirementLiquidTypeMixSchema
>;

export const DEFAULT_LIQUID_TYPE_MIX: RetirementLiquidTypeMix = {
	stocksOfTaxable: 1,
	four01kOfDeferred: 1,
	rothOfTaxFree: 1,
	hsaOfTaxFree: 0,
};

export const RetirementProjectionSchema = z.object({
	projectionKey: z.string(),
	baselineVersion: z.string(),
	baselineRefreshedAt: z.string(),
	scenarioId: z.string().nullable(),
	scenarioName: z.string().nullable(),
	summary: RetirementProjectionSummarySchema,
	years: z.array(RetirementProjectionYearSchema),
	/** Today's balances, before year-end leftover and growth. */
	opening: RetirementProjectionYearSchema,
	milestones: z.array(RetirementMilestoneSchema),
	appliedLevers: z.array(RetirementAppliedLeverSchema),
	assumptions: RetirementAssumptionsSchema,
	taxYear: z.number().int(),
	liquidTypeMix: RetirementLiquidTypeMixSchema.default(DEFAULT_LIQUID_TYPE_MIX),
});
export type RetirementProjection = z.infer<typeof RetirementProjectionSchema>;

// ---------------------------------------------------------------------------
// Baseline, plan confidence, suggestions
// ---------------------------------------------------------------------------

export const RetirementBaselineSummarySchema = z.object({
	baselineVersion: z.string(),
	refreshedAt: z.string(),
	currentAge: z.number(),
	balanceTaxable: z.number(),
	balanceTaxDeferred: z.number(),
	balanceTaxFree: z.number(),
	realEstateEquity: z.number(),
	debtBalance: z.number(),
	netWorth: z.number(),
	monthlyIncome: z.number(),
	monthlyExpenses: z.number(),
	monthlyContributions: z.number(),
	trailingMonthCount: z.number().int(),
	expectedRetirementMonthlySpending: z.number(),
	annualEmploymentIncome: z.number(),
	annualSpouseEmploymentIncome: z.number(),
	employmentEndsAtAge: z.number(),
	spouseEmploymentEndsAtAge: z.number().nullable(),
	investmentAccountCount: z.number().int(),
	propertyCount: z.number().int(),
	insurancePolicyCount: z.number().int(),
	localOnlyPolicyCount: z.number().int(),
});
export type RetirementBaselineSummary = z.infer<
	typeof RetirementBaselineSummarySchema
>;

export const RetirementPlanConfidenceSignalSchema = z.object({
	id: z.string(),
	label: z.string(),
	satisfied: z.boolean(),
	weight: z.number(),
	actionLabel: z.string().nullable(),
	actionHref: z.string().nullable(),
});
export type RetirementPlanConfidenceSignal = z.infer<
	typeof RetirementPlanConfidenceSignalSchema
>;

export const RetirementPlanConfidenceSchema = z.object({
	score: z.number(),
	signals: z.array(RetirementPlanConfidenceSignalSchema),
});
export type RetirementPlanConfidence = z.infer<
	typeof RetirementPlanConfidenceSchema
>;

export const RetirementSuggestedLeverSchema = z.object({
	id: z.string(),
	title: z.string(),
	detail: z.string(),
	secondaryDetail: z.string().nullable(),
	category: RetirementLeverCategorySchema,
	lever: RetirementLeverSchema,
	estimatedImpactScore: z.number(),
	isPersonalized: z.boolean(),
	confidenceBefore: z.number().optional(),
	confidenceAfter: z.number().optional(),
	primaryMetricLabel: z.string().optional(),
	primaryMetricBefore: z.string().optional(),
	primaryMetricAfter: z.string().optional(),
});
export type RetirementSuggestedLever = z.infer<
	typeof RetirementSuggestedLeverSchema
>;

export const RetirementDataStatusSchema = z.enum([
	"ready",
	"insufficient_history",
	"no_investment_accounts",
	"no_data",
	"missing_birth_year",
]);
export type RetirementDataStatus = z.infer<typeof RetirementDataStatusSchema>;

export const RetirementHeadlineSchema = z.object({
	kind: z.enum(["on_track", "likely_sensitive", "short", "insufficient_data"]),
	headline: z.string(),
	supporting: z.string(),
});
export type RetirementHeadline = z.infer<typeof RetirementHeadlineSchema>;

export const RetirementSetupUrgencySchema = z.enum(["required", "encouraged"]);
export type RetirementSetupUrgency = z.infer<
	typeof RetirementSetupUrgencySchema
>;

export const RetirementSetupActionKindSchema = z.enum([
	"link",
	"birth_year",
	"social_security",
]);
export type RetirementSetupActionKind = z.infer<
	typeof RetirementSetupActionKindSchema
>;

export const RetirementMissingInputSchema = z.object({
	id: z.string(),
	label: z.string(),
	description: z.string(),
	urgency: RetirementSetupUrgencySchema,
	actionKind: RetirementSetupActionKindSchema,
	actionLabel: z.string(),
	actionHref: z.string(),
});
export type RetirementMissingInput = z.infer<
	typeof RetirementMissingInputSchema
>;

export const RetirementPlanOverviewSchema = z.object({
	plan: RetirementPlanSettingsSchema,
	baseline: RetirementBaselineSummarySchema,
	projection: RetirementProjectionSchema,
	planConfidence: RetirementPlanConfidenceSchema,
	suggestedLevers: z.array(RetirementSuggestedLeverSchema),
	headline: RetirementHeadlineSchema,
	dataStatus: RetirementDataStatusSchema,
	missingInputs: z.array(RetirementMissingInputSchema),
	standingRules: z.array(RetirementStandingRuleSchema),
	/**
	 * Detected-but-unadopted rules. These never affect the projection until the
	 * user adds them, so a heuristic can't silently change a plan.
	 */
	standingRuleSuggestions: z.array(RetirementStandingRuleSuggestionSchema),
	/** Live derived defaults for the drawer. Not compiled until the user saves. */
	policyDefaults: RetirementPoliciesSchema,
});
export type RetirementPlanOverview = z.infer<
	typeof RetirementPlanOverviewSchema
>;

// ---------------------------------------------------------------------------
// Scenarios
// ---------------------------------------------------------------------------

export const RetirementScenarioSchema = z.object({
	id: z.string(),
	name: z.string(),
	description: z.string().nullable(),
	color: z.string().nullable(),
	source: RetirementScenarioSourceSchema,
	isPinned: z.boolean(),
	sortOrder: z.number().int(),
	createdAt: z.string(),
	updatedAt: z.string(),
	levers: z.array(RetirementScenarioLeverSchema),
});
export type RetirementScenario = z.infer<typeof RetirementScenarioSchema>;

export const CreateRetirementScenarioInputSchema = z.object({
	name: z.string().min(1).max(80),
	description: z.string().max(280).nullable().optional(),
	color: z.string().max(24).nullable().optional(),
	source: RetirementScenarioSourceSchema.optional(),
	levers: z.array(RetirementLeverInputSchema).max(40),
});
export type CreateRetirementScenarioInput = z.infer<
	typeof CreateRetirementScenarioInputSchema
>;

export const UpdateRetirementScenarioInputSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(80).optional(),
	description: z.string().max(280).nullable().optional(),
	color: z.string().max(24).nullable().optional(),
	isPinned: z.boolean().optional(),
	sortOrder: z.number().int().min(0).optional(),
	levers: z.array(RetirementLeverInputSchema).max(40).optional(),
});
export type UpdateRetirementScenarioInput = z.infer<
	typeof UpdateRetirementScenarioInputSchema
>;

export const DeleteRetirementScenarioInputSchema = z.object({
	id: z.string().min(1),
});
export type DeleteRetirementScenarioInput = z.infer<
	typeof DeleteRetirementScenarioInputSchema
>;

export const DuplicateRetirementScenarioInputSchema = z.object({
	id: z.string().min(1),
	name: z.string().min(1).max(80).optional(),
});
export type DuplicateRetirementScenarioInput = z.infer<
	typeof DuplicateRetirementScenarioInputSchema
>;

// ---------------------------------------------------------------------------
// Projection / Monte Carlo / comparison requests
// ---------------------------------------------------------------------------

export const ProjectRetirementScenarioInputSchema = z.object({
	scenarioId: z.string().min(1).optional(),
	levers: z.array(RetirementLeverInputSchema).max(40).optional(),
	includeBaseline: z.boolean().optional(),
});
export type ProjectRetirementScenarioInput = z.infer<
	typeof ProjectRetirementScenarioInputSchema
>;

export const RetirementProjectionResponseSchema = z.object({
	projection: RetirementProjectionSchema,
	baseline: RetirementProjectionSchema.nullable(),
});
export type RetirementProjectionResponse = z.infer<
	typeof RetirementProjectionResponseSchema
>;

export const RunRetirementMonteCarloInputSchema = z.object({
	scenarioId: z.string().min(1).optional(),
	levers: z.array(RetirementLeverInputSchema).max(40).optional(),
	trials: z.number().int().min(100).max(2000).optional(),
	includeSafeSpending: z.boolean().optional(),
	includeCone: z.boolean().optional(),
});
export type RunRetirementMonteCarloInput = z.infer<
	typeof RunRetirementMonteCarloInputSchema
>;

export const RetirementConePointSchema = z.object({
	age: z.number(),
	year: z.number().int(),
	p10: z.number(),
	p25: z.number(),
	p50: z.number(),
	p75: z.number(),
	p90: z.number(),
	realEstateEquity: z.number(),
});
export type RetirementConePoint = z.infer<typeof RetirementConePointSchema>;

export const RetirementMonteCarloResultSchema = z.object({
	projectionKey: z.string(),
	trials: z.number().int(),
	fundedTrials: z.number().int(),
	depletedTrials: z.number().int(),
	confidence: z.number(),
	earliestDepletionAge: z.number().nullable(),
	medianDepletionAge: z.number().nullable(),
	worstDecileLegacy: z.number(),
	medianLegacy: z.number(),
	safeMonthlySpending: z.number().nullable(),
	cone: z.array(RetirementConePointSchema),
});
export type RetirementMonteCarloResult = z.infer<
	typeof RetirementMonteCarloResultSchema
>;

export const CompareRetirementScenariosInputSchema = z.object({
	scenarioIds: z.array(z.string().min(1)).max(3),
	includeBaseline: z.boolean().optional(),
	trials: z.number().int().min(100).max(2000).optional(),
});
export type CompareRetirementScenariosInput = z.infer<
	typeof CompareRetirementScenariosInputSchema
>;

export const RetirementComparisonColumnSchema = z.object({
	scenarioId: z.string().nullable(),
	name: z.string(),
	color: z.string().nullable(),
	summary: RetirementProjectionSummarySchema,
	confidence: z.number().nullable(),
	worstDecileLegacy: z.number().nullable(),
	runsOut: z.boolean(),
	series: z.array(
		z.object({ age: z.number(), year: z.number().int(), netWorth: z.number() }),
	),
});
export type RetirementComparisonColumn = z.infer<
	typeof RetirementComparisonColumnSchema
>;

export const RetirementComparisonSchema = z.object({
	columns: z.array(RetirementComparisonColumnSchema),
});
export type RetirementComparison = z.infer<typeof RetirementComparisonSchema>;

// ---------------------------------------------------------------------------
// Stress tests
// ---------------------------------------------------------------------------

export const RunRetirementStressTestsInputSchema = z.object({
	scenarioId: z.string().min(1).optional(),
	levers: z.array(RetirementLeverInputSchema).max(40).optional(),
	trials: z.number().int().min(100).max(2000).optional(),
});
export type RunRetirementStressTestsInput = z.infer<
	typeof RunRetirementStressTestsInputSchema
>;

export const RetirementStressTestResultSchema = z.object({
	id: z.string(),
	label: z.string(),
	confidence: z.number(),
	confidenceDelta: z.number(),
	legacyAtLongevity: z.number(),
	isBaseline: z.boolean(),
});
export type RetirementStressTestResult = z.infer<
	typeof RetirementStressTestResultSchema
>;

export const RetirementVulnerabilitySchema = z.object({
	testId: z.string(),
	label: z.string(),
	narrative: z.string(),
	actionLabel: z.string().nullable(),
	actionHref: z.string().nullable(),
});
export type RetirementVulnerability = z.infer<
	typeof RetirementVulnerabilitySchema
>;

export const RetirementStressTestsResponseSchema = z.object({
	results: z.array(RetirementStressTestResultSchema),
	biggestVulnerability: RetirementVulnerabilitySchema.nullable(),
});
export type RetirementStressTestsResponse = z.infer<
	typeof RetirementStressTestsResponseSchema
>;

// ---------------------------------------------------------------------------
// Goal seek and opportunities
// ---------------------------------------------------------------------------

export const RetirementGoalObjectiveSchema = z.discriminatedUnion("kind", [
	z.object({
		kind: z.literal("retire_by_age"),
		age: ageSchema,
	}),
	z.object({
		kind: z.literal("monthly_spending"),
		monthlyAmount: z.number().min(0).max(10_000_000),
	}),
	z.object({
		kind: z.literal("legacy_amount"),
		amount: z.number().min(0).max(1_000_000_000),
	}),
	z.object({
		kind: z.literal("confidence_target"),
		confidence: z.number().min(0.5).max(0.99),
	}),
	z.object({ kind: z.literal("never_run_out") }),
]);
export type RetirementGoalObjective = z.infer<
	typeof RetirementGoalObjectiveSchema
>;

export const SolveRetirementGoalInputSchema = z.object({
	objective: RetirementGoalObjectiveSchema,
	levers: z.array(RetirementLeverInputSchema).max(40).optional(),
	scenarioId: z.string().min(1).optional(),
});
export type SolveRetirementGoalInput = z.infer<
	typeof SolveRetirementGoalInputSchema
>;

export const RetirementGoalOptionSchema = z.object({
	id: z.string(),
	label: z.string(),
	detail: z.string(),
	steps: z.array(z.string()),
	levers: z.array(RetirementLeverSchema),
	resultingConfidence: z.number(),
	reachesGoal: z.boolean(),
});
export type RetirementGoalOption = z.infer<typeof RetirementGoalOptionSchema>;

export const RetirementGoalSeekResponseSchema = z.object({
	objectiveLabel: z.string(),
	currentStateLabel: z.string(),
	reachable: z.boolean(),
	unreachableMessage: z.string().nullable(),
	options: z.array(RetirementGoalOptionSchema),
});
export type RetirementGoalSeekResponse = z.infer<
	typeof RetirementGoalSeekResponseSchema
>;

export const RetirementOpportunitySchema = z.object({
	id: z.string(),
	rank: z.number().int(),
	title: z.string(),
	primaryMetricLabel: z.string(),
	primaryMetricBefore: z.string(),
	primaryMetricAfter: z.string(),
	secondaryMetricLabel: z.string().nullable(),
	secondaryMetricDelta: z.string().nullable(),
	confidenceBefore: z.number(),
	confidenceAfter: z.number(),
	lever: RetirementLeverSchema,
});
export type RetirementOpportunity = z.infer<typeof RetirementOpportunitySchema>;

export const RetirementOpportunitiesResponseSchema = z.object({
	opportunities: z.array(RetirementOpportunitySchema),
});
export type RetirementOpportunitiesResponse = z.infer<
	typeof RetirementOpportunitiesResponseSchema
>;

export const GetRetirementOpportunitiesInputSchema = z.object({
	scenarioId: z.string().min(1).optional(),
	limit: z.number().int().min(1).max(20).optional(),
});
export type GetRetirementOpportunitiesInput = z.infer<
	typeof GetRetirementOpportunitiesInputSchema
>;

// ---------------------------------------------------------------------------
// Spending plan
// ---------------------------------------------------------------------------

export const RetirementSpendingCategoryRowSchema = z.object({
	categoryId: z.string(),
	categoryName: z.string(),
	currentMonthlyAmount: z.number(),
	retirementMonthlyAmount: z.number(),
	treatment: RetirementSpendingTreatmentSchema,
	essentiality: RetirementEssentialitySchema,
	isUserEdited: z.boolean(),
});
export type RetirementSpendingCategoryRow = z.infer<
	typeof RetirementSpendingCategoryRowSchema
>;

export const RetirementSpendingAdjustmentSchema = z.object({
	id: z.string(),
	label: z.string(),
	monthlyDelta: z.number(),
});
export type RetirementSpendingAdjustment = z.infer<
	typeof RetirementSpendingAdjustmentSchema
>;

export const RetirementSpendingPlanSchema = z.object({
	trailingMonths: z.number().int(),
	currentMonthlySpending: z.number(),
	remainsMonthly: z.number(),
	disappearsMonthly: z.number(),
	changesMonthly: z.number(),
	essentialMonthly: z.number(),
	flexibleMonthly: z.number(),
	adjustments: z.array(RetirementSpendingAdjustmentSchema),
	estimatedRetirementMonthly: z.number(),
	categories: z.array(RetirementSpendingCategoryRowSchema),
	stages: z.array(RetirementSpendingStageSchema),
});
export type RetirementSpendingPlan = z.infer<
	typeof RetirementSpendingPlanSchema
>;

export const UpdateRetirementSpendingPlanInputSchema = z.object({
	categories: z
		.array(
			z.object({
				categoryId: z.string().min(1),
				treatment: RetirementSpendingTreatmentSchema.optional(),
				essentiality: RetirementEssentialitySchema.optional(),
				retirementMonthlyAmount: z
					.number()
					.min(0)
					.max(10_000_000)
					.nullable()
					.optional(),
			}),
		)
		.max(200)
		.optional(),
	stages: z.array(RetirementSpendingStageSchema).max(8).optional(),
});
export type UpdateRetirementSpendingPlanInput = z.infer<
	typeof UpdateRetirementSpendingPlanInputSchema
>;

// ---------------------------------------------------------------------------
// Timeline lenses (shared between web/desktop/iOS)
// ---------------------------------------------------------------------------

export const RETIREMENT_TIMELINE_LENSES = [
	"netWorth",
	"investments",
	"incomeVsExpenses",
	"paycheck",
	"taxes",
	"withdrawals",
] as const;
export type RetirementTimelineLens =
	(typeof RETIREMENT_TIMELINE_LENSES)[number];

export const RETIREMENT_TABS = ["overview", "plan"] as const;
export type RetirementTab = (typeof RETIREMENT_TABS)[number];

export const RETIREMENT_PLAN_SECTIONS = [
	"net-worth",
	"investments",
	"cash-flow",
	"income",
	"taxes",
	"withdrawals",
	"risk",
] as const;
export type RetirementPlanSection = (typeof RETIREMENT_PLAN_SECTIONS)[number];

/** Hard cap on scenarios in the comparison view, for chart legibility. */
export const RETIREMENT_COMPARISON_MAX_SCENARIOS = 3;

// ---------------------------------------------------------------------------
// Projection cache key
// ---------------------------------------------------------------------------

/**
 * Canonical text for a lever stack: enabled levers only, in `sortOrder`, with
 * object keys sorted so `{ a, b }` and `{ b, a }` hash alike. Disabled levers
 * are excluded because they have no effect on the projection.
 */
export function canonicalRetirementLeverStack(
	levers: Array<
		Pick<RetirementScenarioLever, "enabled" | "sortOrder" | "lever">
	>,
): string {
	return [...levers]
		.filter((entry) => entry.enabled)
		.sort((a, b) => a.sortOrder - b.sortOrder)
		.map((entry) => stableStringify(entry.lever))
		.join("|");
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") return JSON.stringify(value);
	if (Array.isArray(value)) {
		return `[${value.map(stableStringify).join(",")}]`;
	}
	const entries = Object.entries(value as Record<string, unknown>)
		.filter(([, entry]) => entry !== undefined)
		.sort(([a], [b]) => (a < b ? -1 : 1));
	return `{${entries.map(([key, entry]) => `${JSON.stringify(key)}:${stableStringify(entry)}`).join(",")}}`;
}

/**
 * Stable cache key for a projection. Computed identically on the server (for the
 * five-minute projection cache) and in the browser (for the React Query key), so
 * it must stay a pure function of its arguments.
 */
export function retirementProjectionKey(input: {
	baselineVersion: string;
	levers: Array<
		Pick<RetirementScenarioLever, "enabled" | "sortOrder" | "lever">
	>;
	/** Distinguishes derived runs — Monte Carlo trials, stress tests. */
	variant?: string;
}): string {
	const canonical = `${input.baselineVersion}::${canonicalRetirementLeverStack(input.levers)}::${input.variant ?? ""}`;
	// FNV-1a, 32-bit, rendered base36. Collisions are cache misses, not bugs.
	let hash = 0x811c9dc5;
	for (let index = 0; index < canonical.length; index++) {
		hash ^= canonical.charCodeAt(index);
		hash = Math.imul(hash, 0x01000193);
	}
	return (hash >>> 0).toString(36);
}

/** Fills confidence and 85%-safe spend, and keeps the headline gap in the same units. */
export function overlayRetirementMonteCarlo(
	summary: RetirementProjectionSummary,
	monteCarlo: {
		confidence: number;
		safeMonthlySpending: number | null;
	},
): RetirementProjectionSummary {
	const safeMonthlySpending =
		monteCarlo.safeMonthlySpending ?? summary.safeMonthlySpending;
	return {
		...summary,
		confidence: monteCarlo.confidence,
		safeMonthlySpending,
		monthlyShortfallAtTarget:
			safeMonthlySpending === null
				? summary.monthlyShortfallAtTarget
				: Math.max(0, summary.expectedMonthlySpending - safeMonthlySpending),
	};
}

/** Palette assigned to saved scenarios so overlays stay distinguishable. */
export const RETIREMENT_SCENARIO_COLORS = [
	"var(--chart-1)",
	"var(--chart-2)",
	"var(--chart-3)",
	"var(--chart-4)",
	"var(--chart-5)",
] as const;
