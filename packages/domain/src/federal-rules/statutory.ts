import type { RetirementFilingStatus } from "./types";

/**
 * Ages and thresholds that change only when Congress amends the statute —
 * not annually with COLA notices. Do not duplicate these into every year's
 * annual tables.
 */

/** Age at which required minimum distributions begin. SECURE 2.0 moves this to
 * 75 for people born in 1960 or later. */
export const RMD_START_AGE = 73;
export const RMD_START_AGE_POST_1959 = 75;
export const MEDICARE_AGE = 65;

export const SOCIAL_SECURITY_FRA = 67;
export const SOCIAL_SECURITY_EARLIEST_CLAIM_AGE = 62;
export const SOCIAL_SECURITY_LATEST_CLAIM_AGE = 70;
/** Delayed retirement credit per year of deferral past full retirement age. */
export const SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR = 0.08;

/** Catch-up contributions unlock at this age for IRA and workplace plans. */
export const CATCH_UP_AGE = 50;
/** Ages 60–63 may use the higher "super" catch-up under SECURE 2.0. */
export const SUPER_CATCH_UP_AGE_MIN = 60;
export const SUPER_CATCH_UP_AGE_MAX = 63;
/** HSA catch-up unlocks later than the retirement-account catch-up. */
export const HSA_CATCH_UP_AGE = 55;

/** Provisional-income thresholds that determine Social Security taxability.
 * These are fixed in statute and are not inflation-indexed. */
export const SOCIAL_SECURITY_TAXABILITY_THRESHOLDS: Record<
	RetirementFilingStatus,
	{ first: number; second: number }
> = {
	single: { first: 25_000, second: 34_000 },
	marriedJoint: { first: 32_000, second: 44_000 },
	marriedSeparate: { first: 0, second: 0 },
	headOfHousehold: { first: 25_000, second: 34_000 },
};

export function rmdStartAgeForBirthYear(birthYear: number | null): number {
	if (birthYear !== null && birthYear >= 1960) return RMD_START_AGE_POST_1959;
	return RMD_START_AGE;
}
