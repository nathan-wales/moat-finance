// Bracket-based federal + flat state tax estimation. This is a planning
// projection, not tax preparation — the UI never implies otherwise.

import {
	getFederalTaxTables,
	type RetirementFilingStatus,
	SOCIAL_SECURITY_TAXABILITY_THRESHOLDS,
	type TaxBracket,
} from "../federal-rules";
import type { StateRetirementTaxProfile } from "./types";

export type AnnualTaxInput = {
	/** Wages, pensions, tax-deferred withdrawals, RMDs and Roth conversions. */
	ordinaryIncome: number;
	/** Realized gains and dividends from taxable brokerage assets. */
	capitalGains: number;
	/** Gross household Social Security benefit for the year. */
	socialSecurityBenefit: number;
	filingStatus: RetirementFilingStatus;
	stateTaxRate: number;
	/**
	 * Per-state treatment of retirement income. Absent applies the flat rate to
	 * all taxable income, which is what the engine did before this existed.
	 */
	stateRetirementTaxProfile?: StateRetirementTaxProfile | null;
	/**
	 * Portion of `ordinaryIncome` from pensions, RMDs and tax-deferred
	 * withdrawals. Only read to size a state's retirement-income exclusion.
	 */
	retirementOrdinaryIncome?: number;
	/** Ages used to apply the additional senior standard deduction. */
	primaryAge: number;
	spouseAge: number | null;
	/** Calendar tax year whose official (or estimated) tables apply. */
	taxYear: number;
	/** Plan inflation rate used to estimate unpublished future tax years. */
	inflationRate: number;
};

export type AnnualTaxResult = {
	taxableIncome: number;
	federalTax: number;
	stateTax: number;
	totalTax: number;
	marginalRate: number;
	effectiveRate: number;
	/** Portion of the Social Security benefit included in taxable income. */
	taxableSocialSecurity: number;
};

function applyBrackets(
	amount: number,
	brackets: TaxBracket[],
): { tax: number; marginalRate: number } {
	if (amount <= 0) {
		return { tax: 0, marginalRate: 0 };
	}

	let tax = 0;
	let previousCeiling = 0;
	let marginalRate = brackets[0]?.rate ?? 0;

	for (const bracket of brackets) {
		const ceiling = Number.isFinite(bracket.upTo)
			? bracket.upTo
			: Number.POSITIVE_INFINITY;
		const slice = Math.min(amount, ceiling) - previousCeiling;
		if (slice > 0) {
			tax += slice * bracket.rate;
			marginalRate = bracket.rate;
		}
		if (amount <= ceiling) break;
		previousCeiling = ceiling;
	}

	return { tax, marginalRate };
}

/**
 * Share of the Social Security benefit that lands in taxable income, using the
 * two-tier provisional income test.
 */
export function taxableSocialSecurityPortion(input: {
	socialSecurityBenefit: number;
	otherIncome: number;
	filingStatus: RetirementFilingStatus;
}): number {
	const { socialSecurityBenefit, otherIncome, filingStatus } = input;
	if (socialSecurityBenefit <= 0) return 0;

	const thresholds = SOCIAL_SECURITY_TAXABILITY_THRESHOLDS[filingStatus];
	const provisional = otherIncome + socialSecurityBenefit * 0.5;

	if (provisional <= thresholds.first) return 0;

	if (provisional <= thresholds.second) {
		const included = Math.min(
			(provisional - thresholds.first) * 0.5,
			socialSecurityBenefit * 0.5,
		);
		return included;
	}

	const tierOne = Math.min(
		(thresholds.second - thresholds.first) * 0.5,
		socialSecurityBenefit * 0.5,
	);
	const tierTwo = (provisional - thresholds.second) * 0.85;
	return Math.min(tierOne + tierTwo, socialSecurityBenefit * 0.85);
}

/**
 * State taxable income after the exclusions most states grant retirees. Every
 * subtraction is bounded by what the household actually received, so a large
 * statutory exclusion cannot manufacture a negative base.
 */
function stateTaxableIncome(input: {
	taxableIncome: number;
	taxableSocialSecurity: number;
	retirementOrdinaryIncome: number;
	profile: StateRetirementTaxProfile | null;
}): number {
	const base = Math.max(0, input.taxableIncome);
	if (!input.profile) return base;

	let excluded = 0;
	if (!input.profile.taxesSocialSecurity) {
		excluded += Math.max(0, input.taxableSocialSecurity);
	}
	if (input.profile.retirementIncomeExclusion > 0) {
		excluded += Math.min(
			input.profile.retirementIncomeExclusion,
			Math.max(0, input.retirementOrdinaryIncome),
		);
	}
	return Math.max(0, base - excluded);
}

export function estimateAnnualTax(input: AnnualTaxInput): AnnualTaxResult {
	const {
		ordinaryIncome,
		capitalGains,
		socialSecurityBenefit,
		filingStatus,
		stateTaxRate,
		primaryAge,
		spouseAge,
		taxYear,
		inflationRate,
	} = input;

	const tables = getFederalTaxTables(taxYear, inflationRate);

	const taxableSocialSecurity = taxableSocialSecurityPortion({
		socialSecurityBenefit,
		otherIncome: Math.max(0, ordinaryIncome) + Math.max(0, capitalGains),
		filingStatus,
	});

	let deduction = tables.standardDeduction[filingStatus];
	const seniorExtra = tables.seniorAdditionalDeduction[filingStatus];
	if (primaryAge >= 65) deduction += seniorExtra;
	if (spouseAge !== null && spouseAge >= 65) {
		deduction += seniorExtra;
	}

	const grossOrdinary = Math.max(
		0,
		ordinaryIncome + taxableSocialSecurity - deduction,
	);
	const remainingDeduction = Math.max(
		0,
		deduction - (ordinaryIncome + taxableSocialSecurity),
	);
	const taxableGains = Math.max(0, capitalGains - remainingDeduction);

	const ordinaryResult = applyBrackets(
		grossOrdinary,
		tables.brackets[filingStatus],
	);

	// Long-term gains stack on top of ordinary income for rate determination.
	const gainsBrackets = tables.longTermCapitalGains[filingStatus];
	const gainsTop = applyBrackets(grossOrdinary + taxableGains, gainsBrackets);
	const gainsBase = applyBrackets(grossOrdinary, gainsBrackets);
	const gainsTax = Math.max(0, gainsTop.tax - gainsBase.tax);

	const federalTax = ordinaryResult.tax + gainsTax;
	const taxableIncome = grossOrdinary + taxableGains;
	const stateBase = stateTaxableIncome({
		taxableIncome,
		taxableSocialSecurity,
		retirementOrdinaryIncome: input.retirementOrdinaryIncome ?? 0,
		profile: input.stateRetirementTaxProfile ?? null,
	});
	const stateTax = stateBase * Math.max(0, stateTaxRate);
	const totalTax = federalTax + stateTax;
	const stateMarginal = stateBase > 0 ? Math.max(0, stateTaxRate) : 0;

	const grossIncome =
		Math.max(0, ordinaryIncome) +
		Math.max(0, capitalGains) +
		Math.max(0, socialSecurityBenefit);

	return {
		taxableIncome,
		federalTax,
		stateTax,
		totalTax,
		marginalRate: ordinaryResult.marginalRate + stateMarginal,
		effectiveRate: grossIncome > 0 ? totalTax / grossIncome : 0,
		taxableSocialSecurity,
	};
}

/**
 * Taxable income headroom before the next federal bracket. Used to size Roth
 * conversions that fill a low-income window without spilling over.
 */
export function headroomToBracketTop(input: {
	taxableIncome: number;
	filingStatus: RetirementFilingStatus;
	taxYear: number;
	inflationRate: number;
	targetRate: number;
}): number {
	const brackets = getFederalTaxTables(input.taxYear, input.inflationRate)
		.brackets[input.filingStatus];
	for (const bracket of brackets) {
		if (bracket.rate < input.targetRate) continue;
		if (bracket.rate > input.targetRate) break;
		const ceiling = Number.isFinite(bracket.upTo)
			? bracket.upTo
			: Number.POSITIVE_INFINITY;
		return Math.max(0, ceiling - input.taxableIncome);
	}
	return 0;
}

/** The marginal federal rate a given taxable income lands in. */
export function marginalFederalRate(input: {
	taxableIncome: number;
	filingStatus: RetirementFilingStatus;
	taxYear: number;
	inflationRate: number;
}): number {
	return applyBrackets(
		Math.max(0, input.taxableIncome),
		getFederalTaxTables(input.taxYear, input.inflationRate).brackets[
			input.filingStatus
		],
	).marginalRate;
}

export type RothConversionWindow = {
	fromAge: number;
	toAge: number;
	lowBracket: number;
	postRmdBracket: number;
};

/**
 * Contiguous post-retirement years whose marginal rate sits at least one
 * bracket below the typical post-RMD rate. V1 identifies the window; it does
 * not size a conversion ladder.
 */
export function findRothConversionWindow(input: {
	years: Array<{ age: number; isRetired: boolean; marginalRate: number }>;
	rmdStartAge: number;
}): RothConversionWindow | null {
	const postRmdRates = input.years
		.filter((year) => year.isRetired && year.age >= input.rmdStartAge)
		.map((year) => year.marginalRate);
	if (postRmdRates.length === 0) return null;
	const sorted = [...postRmdRates].sort((a, b) => a - b);
	const median = sorted[Math.floor(sorted.length / 2)];
	if (median === undefined) return null;

	const BRACKET_GAP = 0.03;
	let best: RothConversionWindow | null = null;
	let runStart: number | null = null;
	let runLow = median;

	const closeRun = (endAge: number) => {
		if (runStart === null) return;
		if (endAge - runStart < 1) {
			runStart = null;
			return;
		}
		const candidate: RothConversionWindow = {
			fromAge: runStart,
			toAge: endAge,
			lowBracket: runLow,
			postRmdBracket: median,
		};
		const length = candidate.toAge - candidate.fromAge;
		const bestLength = best ? best.toAge - best.fromAge : -1;
		if (length > bestLength) best = candidate;
		runStart = null;
	};

	for (const year of input.years) {
		if (
			!year.isRetired ||
			year.age >= input.rmdStartAge ||
			year.marginalRate > median - BRACKET_GAP
		) {
			closeRun(year.age - 1);
			continue;
		}
		if (runStart === null) {
			runStart = year.age;
			runLow = year.marginalRate;
		} else {
			runLow = Math.min(runLow, year.marginalRate);
		}
	}
	const last = input.years.at(-1);
	if (last) closeRun(last.age);

	return best;
}
