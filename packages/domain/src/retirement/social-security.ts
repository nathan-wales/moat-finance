import { getSocialSecurityLimits, getTaxYear } from "../federal-rules";
import {
	SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR,
	SOCIAL_SECURITY_EARLIEST_CLAIM_AGE,
	SOCIAL_SECURITY_FRA,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
} from "./constants";

/**
 * Monthly benefit at a chosen claim age, given the full-retirement-age amount.
 *
 * Early claiming reduces the benefit by 5/9 of 1% per month for the first 36
 * months and 5/12 of 1% per month beyond that. Delaying past FRA adds delayed
 * retirement credits until 70.
 */
export function estimateBenefit(input: {
	monthlyAtFra: number;
	claimAge: number;
	fra?: number;
}): number {
	const fra = input.fra ?? SOCIAL_SECURITY_FRA;
	const claimAge = Math.min(
		SOCIAL_SECURITY_LATEST_CLAIM_AGE,
		Math.max(SOCIAL_SECURITY_EARLIEST_CLAIM_AGE, input.claimAge),
	);
	if (input.monthlyAtFra <= 0) return 0;

	if (claimAge === fra) return input.monthlyAtFra;

	if (claimAge < fra) {
		const monthsEarly = Math.round((fra - claimAge) * 12);
		const firstTier = Math.min(36, monthsEarly);
		const secondTier = Math.max(0, monthsEarly - 36);
		const reduction = firstTier * (5 / 9 / 100) + secondTier * (5 / 12 / 100);
		return input.monthlyAtFra * Math.max(0, 1 - reduction);
	}

	const yearsLate = claimAge - fra;
	return (
		input.monthlyAtFra *
		(1 + yearsLate * SOCIAL_SECURITY_DELAYED_CREDIT_PER_YEAR)
	);
}

/**
 * Rough full-retirement-age benefit derived from career earnings, using the
 * standard bend-point formula against an assumed 35-year indexed average.
 * Always labeled as an estimate in the UI.
 */
export function estimateFraBenefitFromIncome(
	annualIncome: number,
	taxYear: number = getTaxYear(),
): number {
	if (annualIncome <= 0) return 0;
	const ss = getSocialSecurityLimits(taxYear);
	// Social Security only credits earnings up to the taxable maximum.
	const cappedIncome = Math.min(annualIncome, ss.taxableWageBase);
	const aime = cappedIncome / 12;

	const firstBend = ss.piaBendPoint1;
	const secondBend = ss.piaBendPoint2;

	const tier1 = Math.min(aime, firstBend) * 0.9;
	const tier2 = Math.max(0, Math.min(aime, secondBend) - firstBend) * 0.32;
	const tier3 = Math.max(0, aime - secondBend) * 0.15;

	return Math.round(tier1 + tier2 + tier3);
}

/**
 * The spousal benefit: a low earner receives the greater of their own benefit
 * or half the higher earner's full-retirement-age amount.
 *
 * Two rules make this more than a `max`. The spousal portion is reduced for
 * claiming early on a steeper schedule than an own-record benefit, and it earns
 * no delayed credits — waiting past full retirement age adds nothing to it. A
 * household that never enters a second benefit figure still gets this, which is
 * the point: the derivation is well-defined, so it should not be an input.
 */
export function spousalMonthlyBenefit(input: {
	ownMonthlyAtFra: number;
	higherEarnerMonthlyAtFra: number;
	claimAge: number;
	fra?: number;
}): number {
	const fra = input.fra ?? SOCIAL_SECURITY_FRA;
	const ownBenefit = estimateBenefit({
		monthlyAtFra: input.ownMonthlyAtFra,
		claimAge: input.claimAge,
		fra,
	});
	if (input.higherEarnerMonthlyAtFra <= 0) return ownBenefit;

	const spousalAtFra = input.higherEarnerMonthlyAtFra * 0.5;
	const claimAge = Math.min(
		SOCIAL_SECURITY_LATEST_CLAIM_AGE,
		Math.max(SOCIAL_SECURITY_EARLIEST_CLAIM_AGE, input.claimAge),
	);

	let spousalBenefit = spousalAtFra;
	if (claimAge < fra) {
		const monthsEarly = Math.round((fra - claimAge) * 12);
		const firstTier = Math.min(36, monthsEarly);
		const secondTier = Math.max(0, monthsEarly - 36);
		const reduction = firstTier * (25 / 36 / 100) + secondTier * (5 / 12 / 100);
		spousalBenefit = spousalAtFra * Math.max(0, 1 - reduction);
	}

	return Math.max(ownBenefit, spousalBenefit);
}

/**
 * Survivor benefit rule: the survivor keeps the larger of the two benefits, and
 * the smaller one stops entirely.
 */
export function survivorMonthlyBenefit(input: {
	primaryMonthly: number;
	spouseMonthly: number;
}): number {
	return Math.max(input.primaryMonthly, input.spouseMonthly);
}

/**
 * Lifetime household benefit for a claim age, used by the Social Security
 * tradeoff sentence in the impact panel.
 */
export function lifetimeBenefit(input: {
	monthlyAtFra: number;
	claimAge: number;
	longevityAge: number;
	colaRate: number;
}): number {
	const monthly = estimateBenefit({
		monthlyAtFra: input.monthlyAtFra,
		claimAge: input.claimAge,
	});
	let total = 0;
	let annual = monthly * 12;
	for (let age = input.claimAge; age < input.longevityAge; age++) {
		total += annual;
		annual *= 1 + input.colaRate;
	}
	return total;
}
