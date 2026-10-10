// Pure mapping helpers shared by the Postgres and SQLite retirement
// repositories. Both hosts read the same underlying tables (Plaid accounts,
// manual investments, real estate, the financial profile JSON) and must produce
// byte-identical source rows, otherwise the same user would get two different
// projections depending on which app they opened.

import {
	AllocationPolicySchema,
	CashPolicySchema,
	ContributionPolicySchema,
	emptyRetirementPolicies,
	type ForecastAssumptions,
	HealthcarePolicySchema,
	type InsurancePolicy,
	InsurancePolicySchema,
	type InsurancePolicyV2,
	normalizeInsurancePolicy,
	type PolicyFieldSource,
	PolicyFieldSourceSchema,
	type RetirementLever,
	RetirementLeverSchema,
	type RetirementPolicies,
	type RetirementSpendingStage,
	RetirementSpendingStageSchema,
	type RetirementStandingRuleBody,
	RetirementStandingRuleBodySchema,
	type RetirementTaxTreatment,
	SpendingPolicySchema,
	TaxPolicySchema,
	type TaxProfile,
} from "@moat/contracts";
import type {
	RetirementAccountSource,
	RetirementInsuranceSource,
	RetirementPlanningContext,
	RetirementPlanRecord,
	RetirementPropertySource,
} from "./repositories/RetirementRepository";

const DEFAULT_WITHDRAWAL_ORDER: RetirementTaxTreatment[] = [
	"taxable",
	"taxDeferred",
	"taxFree",
];

const DEFAULT_RETURN_RATE = 0.07;
const DEFAULT_INFLATION_RATE = 0.03;
const DEFAULT_INCOME_GROWTH_RATE = 0.03;
const DEFAULT_REAL_ESTATE_APPRECIATION = 0.03;
const DEFAULT_CASH_YIELD = 0.04;
const DEFAULT_STATE_TAX_RATE = 0.05;
const DEFAULT_FEDERAL_BRACKET = 0.22;
/** Matches `RetirementPlan.targetRetirementAge` schema default and the plan settings range. */
export const DEFAULT_TARGET_RETIREMENT_AGE = 65;
const MIN_TARGET_RETIREMENT_AGE = 30;
const MAX_TARGET_RETIREMENT_AGE = 90;
const MIN_CURRENT_AGE = 18;
const MAX_CURRENT_AGE = 100;

/** Plaid account types that represent money owed rather than money owned. */
const DEBT_ACCOUNT_TYPES = new Set(["credit", "loan"]);
const CASH_ACCOUNT_TYPES = new Set(["depository", "cash"]);

// ─── JSON column helpers ──────────────────────────────────────────────────────

/**
 * SQLite stores these columns as TEXT and Postgres as `Json`, so every read has
 * to tolerate both a string and an already-parsed value.
 */
export function parseJsonColumn(value: unknown): unknown {
	if (typeof value !== "string") return value;
	if (value.length === 0) return undefined;
	try {
		return JSON.parse(value);
	} catch {
		return undefined;
	}
}

export function parseRetirementSpendingStages(
	value: unknown,
): RetirementSpendingStage[] {
	const parsed = parseJsonColumn(value);
	if (!Array.isArray(parsed)) return [];
	const stages: RetirementSpendingStage[] = [];
	for (const entry of parsed) {
		const result = RetirementSpendingStageSchema.safeParse(entry);
		if (result.success) stages.push(result.data);
	}
	return stages;
}

export function parseRetirementSpendingOverrides(
	value: unknown,
): Record<string, number> {
	const parsed = parseJsonColumn(value);
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}
	const overrides: Record<string, number> = {};
	for (const [key, entry] of Object.entries(parsed)) {
		if (typeof entry === "number" && Number.isFinite(entry)) {
			overrides[key] = entry;
		}
	}
	return overrides;
}

export function parseRetirementTimelinePreferences(
	value: unknown,
): Record<string, unknown> {
	const parsed = parseJsonColumn(value);
	if (parsed === null || typeof parsed !== "object" || Array.isArray(parsed)) {
		return {};
	}
	return parsed as Record<string, unknown>;
}

export function parseRetirementWithdrawalOrder(
	value: unknown,
): RetirementTaxTreatment[] {
	const parsed = parseJsonColumn(value);
	if (!Array.isArray(parsed)) return [...DEFAULT_WITHDRAWAL_ORDER];
	const seen = new Set<RetirementTaxTreatment>();
	for (const entry of parsed) {
		if (entry === "taxable" || entry === "taxDeferred" || entry === "taxFree") {
			seen.add(entry);
		}
	}
	if (seen.size !== DEFAULT_WITHDRAWAL_ORDER.length) {
		return [...DEFAULT_WITHDRAWAL_ORDER];
	}
	return [...seen];
}

/**
 * Rebuilds a typed lever from its stored discriminant and params. Rows that no
 * longer validate — a lever whose shape changed since it was saved — are
 * dropped rather than crashing the whole scenario.
 */
export function parseRetirementLever(input: {
	type: string;
	params: unknown;
}): RetirementLever | null {
	const params = parseJsonColumn(input.params);
	const candidate =
		params !== null && typeof params === "object" && !Array.isArray(params)
			? { ...(params as Record<string, unknown>), type: input.type }
			: { type: input.type };
	const result = RetirementLeverSchema.safeParse(candidate);
	return result.success ? result.data : null;
}

/** Splits a lever back into the two columns the scenario lever table stores. */
export function serializeRetirementLever(lever: RetirementLever): {
	type: string;
	params: Record<string, unknown>;
} {
	const { type, ...params } = lever;
	return { type, params: params as Record<string, unknown> };
}

/**
 * Rebuilds a standing rule body from its stored discriminant and params. A rule
 * whose shape changed since it was saved is dropped rather than crashing the
 * whole plan, matching how stale levers are handled.
 */
export function parseRetirementStandingRule(input: {
	kind: string;
	params: unknown;
}): RetirementStandingRuleBody | null {
	const params = parseJsonColumn(input.params);
	const result = RetirementStandingRuleBodySchema.safeParse({
		kind: input.kind,
		params,
	});
	return result.success ? result.data : null;
}

export function serializeRetirementStandingRule(
	body: RetirementStandingRuleBody,
): { kind: string; params: Record<string, unknown> } {
	return { kind: body.kind, params: body.params as Record<string, unknown> };
}

export function parsePolicyFieldSource(value: unknown): PolicyFieldSource {
	const result = PolicyFieldSourceSchema.safeParse(value);
	return result.success ? result.data : "userEdited";
}

/**
 * Reads the six policy columns into a complete `RetirementPolicies`. Any column
 * that is empty, malformed, or from an older shape falls back to the inert
 * default for that policy, so a partially populated row never breaks a
 * projection and an unset policy always behaves like no policy at all.
 */
export function parseRetirementPolicies(columns: {
	contributionPolicy: unknown;
	spendingPolicy: unknown;
	healthcarePolicy: unknown;
	taxPolicy: unknown;
	cashPolicy: unknown;
	allocationPolicy: unknown;
}): RetirementPolicies {
	const empty = emptyRetirementPolicies();
	const read = <T>(
		schema: {
			safeParse: (
				value: unknown,
			) => { success: true; data: T } | { success: false };
		},
		value: unknown,
		fallback: T,
	): T => {
		const parsed = parseJsonColumn(value);
		const result = schema.safeParse(parsed);
		return result.success ? result.data : fallback;
	};
	return {
		contribution: read(
			ContributionPolicySchema,
			columns.contributionPolicy,
			empty.contribution,
		),
		spending: read(
			SpendingPolicySchema,
			columns.spendingPolicy,
			empty.spending,
		),
		healthcare: read(
			HealthcarePolicySchema,
			columns.healthcarePolicy,
			empty.healthcare,
		),
		tax: read(TaxPolicySchema, columns.taxPolicy, empty.tax),
		cash: read(CashPolicySchema, columns.cashPolicy, empty.cash),
		allocation: read(
			AllocationPolicySchema,
			columns.allocationPolicy,
			empty.allocation,
		),
	};
}

/** Maps a partial policy patch onto the column names, skipping absent keys. */
export function retirementPolicyColumns(
	policies: Partial<RetirementPolicies>,
): Record<string, unknown> {
	return {
		...(policies.contribution !== undefined && {
			contributionPolicy: policies.contribution,
		}),
		...(policies.spending !== undefined && {
			spendingPolicy: policies.spending,
		}),
		...(policies.healthcare !== undefined && {
			healthcarePolicy: policies.healthcare,
		}),
		...(policies.tax !== undefined && { taxPolicy: policies.tax }),
		...(policies.cash !== undefined && { cashPolicy: policies.cash }),
		...(policies.allocation !== undefined && {
			allocationPolicy: policies.allocation,
		}),
	};
}

// ─── Account sources ──────────────────────────────────────────────────────────

export type PlaidAccountSourceRow = {
	id: string;
	name: string;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	monthlyContribution?: number | null;
	annualReturnRate?: number | null;
	forecastInputsUserEdited?: boolean | number | null;
};

export type ManualInvestmentSourceRow = {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
};

/**
 * Buckets an account by the tax treatment of withdrawals from it. Plaid does
 * not expose this directly, so the subtype string is the only signal available.
 */
export function retirementTaxTreatmentForSubtype(
	subtype: string | null | undefined,
): RetirementTaxTreatment {
	const value = (subtype ?? "").toLowerCase();
	if (value.includes("roth")) return "taxFree";
	if (value.includes("hsa")) return "taxFree";
	if (
		value.includes("401") ||
		value.includes("403") ||
		value.includes("457") ||
		value.includes("ira") ||
		value.includes("sep") ||
		value.includes("simple") ||
		value.includes("keogh") ||
		value.includes("pension") ||
		value.includes("thrift") ||
		value.includes("tsp")
	) {
		return "taxDeferred";
	}
	return "taxable";
}

export function toRetirementAccountSourceFromPlaid(
	row: PlaidAccountSourceRow,
	fallbackReturnRate = DEFAULT_RETURN_RATE,
): RetirementAccountSource {
	const isDebt = DEBT_ACCOUNT_TYPES.has(row.type.toLowerCase());
	const isCash = CASH_ACCOUNT_TYPES.has(row.type.toLowerCase());
	const balance = row.currentBalance ?? row.availableBalance ?? 0;
	const forecastInputsUserEdited = Boolean(row.forecastInputsUserEdited);
	const annualReturnRate = isCash
		? forecastInputsUserEdited
			? (row.annualReturnRate ?? 0)
			: 0
		: (row.annualReturnRate ?? fallbackReturnRate);
	return {
		id: `plaid_${row.id}`,
		name: row.name,
		origin: "plaid",
		kind: row.subtype ?? row.type,
		taxTreatment: isCash
			? "taxable"
			: retirementTaxTreatmentForSubtype(row.subtype ?? row.name),
		balance,
		monthlyContribution: row.monthlyContribution ?? 0,
		annualReturnRate,
		isCash,
		isDebt,
		forecastInputsUserEdited,
	};
}

export function toRetirementAccountSourceFromInvestment(
	row: ManualInvestmentSourceRow,
): RetirementAccountSource {
	const type = row.type.toUpperCase();
	const taxTreatment: RetirementTaxTreatment =
		type === "ROTH_IRA" || type === "HSA"
			? "taxFree"
			: type === "FOUR01K"
				? "taxDeferred"
				: "taxable";
	return {
		id: `investment_${row.id}`,
		name: row.name,
		origin: "manual",
		kind: type,
		taxTreatment,
		balance: row.startingBalance,
		monthlyContribution: row.monthlyContribution,
		annualReturnRate: row.annualReturnRate,
		isCash: false,
		isDebt: false,
		forecastInputsUserEdited: true,
	};
}

/** Plaid account types that hold investable balances. */
export const RETIREMENT_INVESTABLE_PLAID_TYPES = ["investment", "brokerage"];

/** Plaid types whose forecast rate can be user-edited (investments + cash). */
export const FORECAST_RATE_PLAID_TYPES = [
	"investment",
	"brokerage",
	"depository",
	"cash",
];

export function isPlaidCashAccountType(type: string): boolean {
	return CASH_ACCOUNT_TYPES.has(type.toLowerCase());
}

// ─── Property sources ─────────────────────────────────────────────────────────

export type RealEstateSourceRow = {
	id: string;
	name: string;
	usageType: string;
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
	linkedPlaidAccountId?: string | null;
};

export function toRetirementPropertySource(
	row: RealEstateSourceRow,
): RetirementPropertySource {
	return {
		id: row.id,
		name: row.name,
		usageType: row.usageType,
		isPrimaryResidence: row.usageType === "PRIMARY_RESIDENCE",
		currentEstimatedValue: row.currentEstimatedValue,
		currentLoanBalance: row.currentLoanBalance,
		interestRate: row.interestRate,
		loanTermYears: row.loanTermYears,
		purchaseDate: row.purchaseDate,
		remainingTermMonths: row.remainingTermMonths,
		monthlyMortgagePayment: row.monthlyMortgagePayment,
		monthlyRent: row.monthlyRent,
		otherMonthlyIncome: row.otherMonthlyIncome,
		vacancyRate: row.vacancyRate,
		totalMonthlyExpenses: row.totalMonthlyExpenses,
		appreciationRate: row.appreciationRate,
		expenseGrowthRate: row.expenseGrowthRate,
		purchasePrice: row.purchasePrice,
		linkedPlaidAccountId: row.linkedPlaidAccountId ?? null,
	};
}

// ─── Insurance sources ────────────────────────────────────────────────────────

const PREMIUM_CADENCE_MULTIPLIER: Record<string, number> = {
	monthly: 12,
	quarterly: 4,
	semiannual: 2,
	annual: 1,
	oneTime: 0,
	unknown: 1,
};

function annualPremiumOf(policy: InsurancePolicyV2): number {
	const amount = policy.premiumAmount ?? 0;
	const multiplier =
		PREMIUM_CADENCE_MULTIPLIER[policy.premiumCadence ?? "annual"];
	return amount * (multiplier ?? 1);
}

function insuredOf(policy: InsurancePolicyV2): "primary" | "spouse" {
	const covered = policy.parties.filter(
		(party) => party.role === "coveredPerson" || party.role === "policyholder",
	);
	const looksLikeSpouse = covered.some((party) =>
		/spouse|partner|wife|husband/i.test(
			`${party.relationship ?? ""} ${party.displayName ?? ""}`,
		),
	);
	const looksLikeSelf = covered.some((party) =>
		/self|primary|^me$/i.test(party.relationship ?? ""),
	);
	if (looksLikeSpouse && !looksLikeSelf) return "spouse";
	return "primary";
}

function detailsOf(policy: InsurancePolicyV2) {
	return policy.details as Record<string, unknown>;
}

function numberFrom(value: unknown): number | null {
	return typeof value === "number" && Number.isFinite(value) ? value : null;
}

/** "90 days" / "3 months" → 90. Elimination periods are stored free-form. */
function parseEliminationDays(value: unknown): number | null {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return null;
	const match = value.match(/(\d+)\s*(day|week|month|year)/i);
	if (!match?.[1] || !match[2]) return null;
	const amount = Number(match[1]);
	const unit = match[2].toLowerCase();
	if (unit === "day") return amount;
	if (unit === "week") return amount * 7;
	if (unit === "month") return amount * 30;
	return amount * 365;
}

/** "3 years" / "lifetime" → 3 / null (unbounded). */
function parseBenefitYears(value: unknown): number | null {
	if (typeof value === "number") return value;
	if (typeof value !== "string") return null;
	if (/unlimited|lifetime/i.test(value)) return 99;
	const match = value.match(/(\d+)\s*(month|year)/i);
	if (!match?.[1] || !match[2]) return null;
	const amount = Number(match[1]);
	return match[2].toLowerCase() === "month" ? amount / 12 : amount;
}

function monthlyBenefitOf(policy: InsurancePolicyV2): number | null {
	const details = detailsOf(policy);
	const monthly = numberFrom(details.monthlyBenefit);
	if (monthly !== null) return monthly;
	const daily = numberFrom(details.dailyBenefit);
	if (daily !== null) return daily * 30;
	return null;
}

/**
 * Reduces the rich policy model to the handful of fields the projection reads.
 * `localOnlyIsUsable` is true on desktop, where the engine runs on the same
 * device the policy is stored on, and false in the cloud.
 */
export function toRetirementInsuranceSources(
	rawPolicies: unknown,
	options: { localOnlyIsUsable: boolean },
): { policies: RetirementInsuranceSource[]; excludedLocalOnlyCount: number } {
	const parsed = parseJsonColumn(rawPolicies);
	if (!Array.isArray(parsed)) {
		return { policies: [], excludedLocalOnlyCount: 0 };
	}

	const policies: RetirementInsuranceSource[] = [];
	let excludedLocalOnlyCount = 0;

	for (const entry of parsed) {
		const result = InsurancePolicySchema.safeParse(entry);
		if (!result.success) continue;
		const policy = normalizeInsurancePolicy(result.data as InsurancePolicy);
		const isLocalOnly =
			!options.localOnlyIsUsable && policy.storageScope === "localPrivate";
		if (isLocalOnly) excludedLocalOnlyCount += 1;

		const details = detailsOf(policy);
		policies.push({
			id: policy.id,
			type: policy.type,
			status: policy.status,
			effectiveEndDate:
				policy.effectiveEndDate ??
				(typeof details.termExpiry === "string" ? details.termExpiry : null),
			annualPremium: annualPremiumOf(policy),
			deathBenefit: numberFrom(details.deathBenefit),
			monthlyBenefit: monthlyBenefitOf(policy),
			benefitYears: parseBenefitYears(details.benefitDuration),
			eliminationDays: parseEliminationDays(details.eliminationPeriod),
			hasInflationProtection:
				details.colaRider === true ||
				(typeof details.inflationProtection === "string" &&
					details.inflationProtection.trim().length > 0 &&
					!/none/i.test(details.inflationProtection)),
			isLocalOnly,
			insured: insuredOf(policy),
		});
	}

	return { policies, excludedLocalOnlyCount };
}

// ─── Planning context ─────────────────────────────────────────────────────────

/**
 * "5%" / "0.05" / "5" all mean the same thing to a user typing a rate.
 * Financial-profile forecast assumptions are stored as percents (3 = 3%);
 * the retirement engine compounds decimals (0.03). Values already in
 * (0, 1] are left alone so scenario-style decimals keep working.
 */
export function parseRateString(value: unknown, fallback: number): number {
	if (typeof value === "number" && Number.isFinite(value)) {
		return value > 1 ? value / 100 : value;
	}
	if (typeof value !== "string") return fallback;
	const match = value.match(/-?\d+(\.\d+)?/);
	if (!match) return fallback;
	const parsed = Number(match[0]);
	if (!Number.isFinite(parsed)) return fallback;
	return parsed > 1 ? parsed / 100 : parsed;
}

export type PlanningContextSources = {
	taxProfile: unknown;
	forecastAssumptions: unknown;
	insurancePolicies: unknown;
	localOnlyIsUsable: boolean;
	/** Onboarding `UserSettings.currentAge`, when the host has one. */
	currentAge?: unknown;
	/** Onboarding `UserSettings.retirementAge`, when the host has one. */
	retirementAge?: unknown;
};

export type OnboardingAgeHints = {
	currentAgeHint: number | null;
	retirementAgeHint: number | null;
};

function optionalInt(value: unknown): number | null {
	if (typeof value !== "number" || !Number.isFinite(value)) return null;
	return Math.round(value);
}

function clampInt(value: number, min: number, max: number): number {
	return Math.min(max, Math.max(min, value));
}

/**
 * Onboarding age wins when present; financial-profile assumptions are the
 * fallback. Empty financial-profile defaults (65) are treated as a hint only
 * when the user never captured an onboarding age.
 */
export function resolveOnboardingAgeHints(input: {
	currentAge?: unknown;
	retirementAge?: unknown;
	forecastAssumptions?: unknown;
}): OnboardingAgeHints {
	const assumptions = (parseJsonColumn(input.forecastAssumptions) ??
		{}) as Partial<Record<keyof ForecastAssumptions, unknown>>;
	const onboardingRetirementAge = optionalInt(input.retirementAge);
	const forecastRetirementAge = optionalInt(assumptions.retirementAge);

	return {
		currentAgeHint: optionalInt(input.currentAge),
		retirementAgeHint: onboardingRetirementAge ?? forecastRetirementAge,
	};
}

export function retirementPlanSeedsFromOnboarding(
	hints: OnboardingAgeHints,
	now: Date = new Date(),
): Partial<
	Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">
> {
	const seeds: Partial<
		Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">
	> = {};
	const currentAge = hints.currentAgeHint;
	if (
		currentAge !== null &&
		currentAge >= MIN_CURRENT_AGE &&
		currentAge <= MAX_CURRENT_AGE
	) {
		seeds.primaryBirthYear = now.getFullYear() - currentAge;
	}
	if (hints.retirementAgeHint !== null) {
		seeds.targetRetirementAge = clampInt(
			hints.retirementAgeHint,
			MIN_TARGET_RETIREMENT_AGE,
			MAX_TARGET_RETIREMENT_AGE,
		);
	}
	return seeds;
}

/** True when the stored plan still looks like an untouched schema default. */
export function shouldApplyOnboardingSeeds(
	plan: Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">,
): boolean {
	return (
		plan.primaryBirthYear === null &&
		plan.targetRetirementAge === DEFAULT_TARGET_RETIREMENT_AGE
	);
}

/** Fields that would actually change an existing default plan. */
export function onboardingSeedsToApply(
	plan: Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">,
	seeds: Partial<
		Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">
	>,
): Partial<
	Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">
> {
	if (!shouldApplyOnboardingSeeds(plan)) return {};
	const next: Partial<
		Pick<RetirementPlanRecord, "primaryBirthYear" | "targetRetirementAge">
	> = {};
	if (seeds.primaryBirthYear !== undefined && plan.primaryBirthYear === null) {
		next.primaryBirthYear = seeds.primaryBirthYear;
	}
	if (
		seeds.targetRetirementAge !== undefined &&
		seeds.targetRetirementAge !== plan.targetRetirementAge
	) {
		next.targetRetirementAge = seeds.targetRetirementAge;
	}
	return next;
}

export function toRetirementPlanningContext(
	sources: PlanningContextSources,
): RetirementPlanningContext {
	const taxProfile = (parseJsonColumn(sources.taxProfile) ?? {}) as Partial<
		Record<keyof TaxProfile, unknown>
	>;
	const assumptions = (parseJsonColumn(sources.forecastAssumptions) ??
		{}) as Partial<Record<keyof ForecastAssumptions, unknown>>;
	const ageHints = resolveOnboardingAgeHints({
		currentAge: sources.currentAge,
		retirementAge: sources.retirementAge,
		forecastAssumptions: sources.forecastAssumptions,
	});

	const insurance = toRetirementInsuranceSources(sources.insurancePolicies, {
		localOnlyIsUsable: sources.localOnlyIsUsable,
	});

	return {
		filingStatus:
			typeof taxProfile.filingStatus === "string"
				? taxProfile.filingStatus
				: "Single",
		stateTaxRate: parseRateString(
			taxProfile.estimatedStateTaxRate,
			DEFAULT_STATE_TAX_RATE,
		),
		federalBracketHint: parseRateString(
			taxProfile.estimatedFederalTaxBracket,
			DEFAULT_FEDERAL_BRACKET,
		),
		inflationRate: parseRateString(
			assumptions.inflationRate,
			DEFAULT_INFLATION_RATE,
		),
		incomeGrowthRate: parseRateString(
			assumptions.incomeGrowthRate,
			DEFAULT_INCOME_GROWTH_RATE,
		),
		investmentReturnRate: parseRateString(
			assumptions.investmentReturnRate,
			DEFAULT_RETURN_RATE,
		),
		realEstateAppreciationRate: parseRateString(
			assumptions.realEstateAppreciationRate,
			DEFAULT_REAL_ESTATE_APPRECIATION,
		),
		cashYield: parseRateString(
			assumptions.defaultCashYield,
			DEFAULT_CASH_YIELD,
		),
		forecastStyle:
			typeof assumptions.forecastStyle === "string"
				? assumptions.forecastStyle
				: "Balanced",
		retirementAgeHint: ageHints.retirementAgeHint,
		currentAgeHint: ageHints.currentAgeHint,
		insurancePolicies: insurance.policies,
		excludedLocalPolicyCount: insurance.excludedLocalOnlyCount,
	};
}

/**
 * Collapses a set of `updatedAt` timestamps into the single version string the
 * projection cache key is built from. Anything that changes the baseline must
 * contribute a timestamp here or a stale projection could be served.
 */
export function retirementBaselineVersionFrom(
	timestamps: Array<Date | string | null | undefined>,
): string {
	let latest = 0;
	for (const entry of timestamps) {
		if (!entry) continue;
		const time = entry instanceof Date ? entry.getTime() : Date.parse(entry);
		if (Number.isFinite(time) && time > latest) latest = time;
	}
	return latest === 0
		? "empty"
		: new Date(latest).toISOString().replace(/[-:.TZ]/g, "");
}
