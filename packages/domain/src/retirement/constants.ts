// Planning assumptions and statutory re-exports for the retirement engine.
// Annual IRS/SSA dollar limits live in `@moat/domain/federal-rules` — never
// inline them here, and never replace a "current year" constant on Jan 1.

import {
	MONTE_CARLO_TRIALS_MAX,
	type RetirementTaxTreatment,
} from "@moat/contracts";
import {
	CATCH_UP_AGE,
	type ContributionLimits,
	contributionLimitsForYear,
	getTaxYear,
	HSA_CATCH_UP_AGE,
	MEDICARE_AGE,
	type RetirementFilingStatus,
	RMD_START_AGE,
	RMD_START_AGE_POST_1959,
	rmdStartAgeForBirthYear,
	SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR,
	SOCIAL_SECURITY_EARLIEST_CLAIM_AGE,
	SOCIAL_SECURITY_FRA,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
	SUPER_CATCH_UP_AGE_MAX,
	SUPER_CATCH_UP_AGE_MIN,
	type TaxBracket,
} from "../federal-rules";

export type { ContributionLimits, RetirementFilingStatus, TaxBracket };

export {
	CATCH_UP_AGE,
	contributionLimitsForYear,
	getTaxYear,
	HSA_CATCH_UP_AGE,
	MEDICARE_AGE,
	RMD_START_AGE,
	RMD_START_AGE_POST_1959,
	rmdStartAgeForBirthYear,
	SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR,
	SOCIAL_SECURITY_EARLIEST_CLAIM_AGE,
	SOCIAL_SECURITY_FRA,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
	SUPER_CATCH_UP_AGE_MAX,
	SUPER_CATCH_UP_AGE_MIN,
};

/**
 * IRS Uniform Lifetime Table divisors, keyed by age. Ages past the last entry
 * reuse the final divisor.
 */
export const UNIFORM_LIFETIME_TABLE: Record<number, number> = {
	72: 27.4,
	73: 26.5,
	74: 25.5,
	75: 24.6,
	76: 23.7,
	77: 22.9,
	78: 22.0,
	79: 21.1,
	80: 20.2,
	81: 19.4,
	82: 18.5,
	83: 17.7,
	84: 16.8,
	85: 16.0,
	86: 15.2,
	87: 14.4,
	88: 13.7,
	89: 12.9,
	90: 12.2,
	91: 11.5,
	92: 10.8,
	93: 10.1,
	94: 9.5,
	95: 8.9,
	96: 8.4,
	97: 7.8,
	98: 7.3,
	99: 6.8,
	100: 6.4,
	101: 6.0,
	102: 5.6,
	103: 5.2,
	104: 4.9,
	105: 4.6,
	106: 4.3,
	107: 4.1,
	108: 3.9,
	109: 3.7,
	110: 3.5,
	111: 3.4,
	112: 3.3,
	113: 3.1,
	114: 3.0,
	115: 2.9,
	120: 2.0,
};

/** Expected return and volatility per portfolio posture. */
export const PORTFOLIO_PROFILES = {
	conservative: { returnRate: 0.05, volatility: 0.08 },
	balanced: { returnRate: 0.07, volatility: 0.13 },
	aggressive: { returnRate: 0.085, volatility: 0.18 },
} as const;

export type PortfolioPosture = keyof typeof PORTFOLIO_PROFILES;

export const DEFAULT_WITHDRAWAL_ORDER: RetirementTaxTreatment[] = [
	"taxable",
	"taxDeferred",
	"taxFree",
];

/** Longevity horizon used when the user has not chosen one. */
export const DEFAULT_LONGEVITY_AGE = 95;
export const DEFAULT_TARGET_RETIREMENT_AGE = 65;
export const DEFAULT_CONFIDENCE_TARGET = 0.85;
export const DEFAULT_MONTE_CARLO_TRIALS = 1000;
/** Hard ceiling so a caller cannot turn one request into an unbounded CPU job. */
export const MAX_MONTE_CARLO_TRIALS = MONTE_CARLO_TRIALS_MAX;
/** Trials used inside binary searches, before one confirming full run. */
export const REDUCED_MONTE_CARLO_TRIALS = 250;

/** Healthcare inflation runs hotter than headline inflation. */
export const HEALTHCARE_INFLATION_PREMIUM = 0.02;
/** Monthly premium assumed for a pre-Medicare marketplace plan, per adult. */
export const PRE_MEDICARE_MONTHLY_PREMIUM = 950;
/**
 * Part B + Part D + a Medigap supplement, per covered adult, per month. Post-65
 * cost is not zero, and reverting to the household's general healthcare figure
 * at 65 understates it.
 */
export const ASSUMED_MEDICARE_MONTHLY_COST = 440;
/** Regional monthly cost of a long-term care event, used when unknown. */
export const DEFAULT_LTC_MONTHLY_COST = 9_500;
/** Share of trailing spending treated as essential when nothing is classified. */
export const DEFAULT_ESSENTIAL_SHARE = 0.65;
/** Employer match assumed when a 401(k) exists but no match is on file. */
export const ASSUMED_EMPLOYER_MATCH_PERCENT = 0.5;
export const ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY = 0.06;
/** Trailing window used to derive the spending baseline. */
export const SPENDING_BASELINE_MONTHS = 12;
/** Fewer months than this and we refuse to guess at a plan. */
export const MINIMUM_HISTORY_MONTHS = 1;
/** Selling costs applied to a home sale. */
export const HOME_SALE_COST_RATE = 0.06;
/** Capital-gains exclusion on a primary-residence sale, married filing jointly. */
export const PRIMARY_RESIDENCE_GAIN_EXCLUSION = {
	single: 250_000,
	marriedJoint: 500_000,
	marriedSeparate: 250_000,
	headOfHousehold: 250_000,
} as const satisfies Record<RetirementFilingStatus, number>;

/** Mortgage rate assumed for a home a lever buys, absent a user-supplied rate. */
export const ASSUMED_MORTGAGE_RATE = 0.065;
export const ASSUMED_MORTGAGE_TERM_YEARS = 30;
/** Down payment share assumed when a lever cannot fund one from equity. */
export const ASSUMED_DOWN_PAYMENT_RATE = 0.2;
/** Annual carrying cost of a property — tax, insurance, upkeep — as a share of value. */
export const ASSUMED_PROPERTY_EXPENSE_RATE = 0.02;
/** Monthly rent a rental property is assumed to command, as a share of price. */
export const ASSUMED_MONTHLY_RENT_RATE = 0.006;
/** Vacancy assumed for a rental a lever adds. */
export const ASSUMED_VACANCY_RATE = 0.05;

/**
 * Flat effective state income-tax rates used by `move_state`. These are
 * planning approximations of a retiree's blended rate, not filing-grade
 * figures, and several states tax retirement income differently from wages.
 */
export const STATE_INCOME_TAX_RATES: Record<string, number> = {
	AK: 0,
	AL: 0.04,
	AR: 0.039,
	AZ: 0.025,
	CA: 0.075,
	CO: 0.044,
	CT: 0.05,
	DC: 0.075,
	DE: 0.052,
	FL: 0,
	GA: 0.0539,
	HI: 0.072,
	IA: 0.038,
	ID: 0.053,
	IL: 0.0495,
	IN: 0.03,
	KS: 0.0558,
	KY: 0.04,
	LA: 0.03,
	MA: 0.05,
	MD: 0.0525,
	ME: 0.0715,
	MI: 0.0425,
	MN: 0.0785,
	MO: 0.047,
	MS: 0.044,
	MT: 0.059,
	NC: 0.0425,
	ND: 0.0195,
	NE: 0.052,
	NH: 0,
	NJ: 0.0637,
	NM: 0.049,
	NV: 0,
	NY: 0.065,
	OH: 0.035,
	OK: 0.0475,
	OR: 0.099,
	PA: 0.0307,
	RI: 0.0599,
	SC: 0.062,
	SD: 0,
	TN: 0,
	TX: 0,
	UT: 0.0455,
	VA: 0.0575,
	VT: 0.0875,
	WA: 0,
	WI: 0.0765,
	WV: 0.0482,
	WY: 0,
};

export function stateIncomeTaxRate(
	stateCode: string,
	fallback: number,
): number {
	return STATE_INCOME_TAX_RATES[stateCode.toUpperCase()] ?? fallback;
}

/**
 * States that tax Social Security benefits. Everywhere else the benefit is
 * exempt, which a single flat rate on all taxable income cannot express.
 */
const STATES_TAXING_SOCIAL_SECURITY = new Set([
	"CO",
	"CT",
	"MN",
	"MT",
	"NM",
	"RI",
	"UT",
	"VT",
	"WV",
]);

/**
 * Annual pension / retirement-account income a state excludes, per return.
 * Planning approximations of the common exclusion, not filing-grade figures;
 * states absent from this map exclude nothing beyond Social Security.
 */
const STATE_RETIREMENT_INCOME_EXCLUSIONS: Record<string, number> = {
	AL: 6_000,
	AR: 6_000,
	CO: 24_000,
	DE: 12_500,
	GA: 65_000,
	IA: 6_000,
	ID: 0,
	IL: 1_000_000,
	KY: 31_110,
	MD: 39_500,
	ME: 30_000,
	MI: 20_000,
	MO: 6_000,
	MS: 1_000_000,
	NJ: 20_000,
	NY: 20_000,
	OK: 10_000,
	PA: 1_000_000,
	SC: 10_000,
	UT: 0,
	VA: 12_000,
	WV: 8_000,
};

export type StateRetirementTaxTreatment = {
	taxesSocialSecurity: boolean;
	retirementIncomeExclusion: number;
};

export function stateRetirementTaxTreatment(
	stateCode: string,
): StateRetirementTaxTreatment {
	const code = stateCode.toUpperCase();
	return {
		taxesSocialSecurity: STATES_TAXING_SOCIAL_SECURITY.has(code),
		retirementIncomeExclusion: STATE_RETIREMENT_INCOME_EXCLUSIONS[code] ?? 0,
	};
}

export function normalizeFilingStatus(
	value: string | null | undefined,
): RetirementFilingStatus {
	const lowered = (value ?? "").toLowerCase();
	if (lowered.includes("jointly")) return "marriedJoint";
	if (lowered.includes("separately")) return "marriedSeparate";
	if (lowered.includes("head")) return "headOfHousehold";
	return "single";
}

export function portfolioPostureFromStyle(
	style: string | null | undefined,
): PortfolioPosture {
	const lowered = (style ?? "").toLowerCase();
	if (lowered.startsWith("conservative")) return "conservative";
	if (lowered.startsWith("aggressive")) return "aggressive";
	return "balanced";
}
