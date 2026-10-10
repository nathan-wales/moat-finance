// Resolves a contribution policy into this year's dollars.
//
// The policy exists because a contribution rule's value depends on state the
// engine computes that year: the salary after growth and levers, that year's
// IRS limit, that year's catch-up eligibility, and the employee's own deferral
// (which is what the employer match is a function of). None of that survives
// being folded into a scalar at t=0.
//
// Two cash-flow rules are load-bearing and everything else follows from them:
//
//   1. Employer money never appears in cash flow. A match is a balance
//      addition, not a household expense. Charging it against take-home makes
//      free money look like a cost.
//   2. A pre-tax deferral costs less than a dollar of take-home per dollar
//      deferred, because the dollar was never taxed. Charging the full dollar
//      against post-tax leftover double-counts the tax.

import {
	getEmployeeDeferralLimit,
	getHsaContributionLimit,
	getIraContributionLimit,
} from "../../federal-rules";
import type {
	EngineContributionPolicy,
	EnginePersonContributionPolicy,
} from "../types";

export type ContributionLine = {
	/** Dollars landing in the balance. */
	amount: number;
	/** Reduction in take-home cash flow this costs the household. */
	cashCost: number;
};

export type ResolvedContributions = {
	taxDeferred: ContributionLine;
	taxFree: ContributionLine;
	taxable: ContributionLine;
	/** Match and profit sharing. Never enters `cashIn`, `cashOut` or leftover. */
	employerTaxDeferred: number;
	/** Gross employee deferral across all accounts, for the year row. */
	employeeDeferral: number;
};

const EMPTY_LINE: ContributionLine = { amount: 0, cashCost: 0 };

export function emptyResolvedContributions(): ResolvedContributions {
	return {
		taxDeferred: { ...EMPTY_LINE },
		taxFree: { ...EMPTY_LINE },
		taxable: { ...EMPTY_LINE },
		employerTaxDeferred: 0,
		employeeDeferral: 0,
	};
}

/**
 * Employer match for a tiered formula. Tiers consume salary percentage in
 * order, so "100% of the first 3%, 50% of the next 2%" is two entries and a
 * single-tier plan degrades to one without a second shape.
 */
export function employerMatchAmount(input: {
	salary: number;
	deferralPercentOfSalary: number;
	tiers: Array<{ matchRate: number; upToPercent: number }>;
}): number {
	if (input.salary <= 0 || input.deferralPercentOfSalary <= 0) return 0;

	let matched = 0;
	let consumedPercent = 0;
	for (const tier of input.tiers) {
		const eligiblePercent = Math.max(
			0,
			Math.min(
				input.deferralPercentOfSalary - consumedPercent,
				tier.upToPercent,
			),
		);
		matched += eligiblePercent * tier.matchRate * input.salary;
		consumedPercent += tier.upToPercent;
		if (consumedPercent >= input.deferralPercentOfSalary) break;
	}
	return matched;
}

function employerPlanDeferral(input: {
	person: EnginePersonContributionPolicy;
	salary: number;
	limit: number;
}): number {
	const { mode, amount } = input.person.employerPlan;
	if (mode === "none") return 0;
	if (mode === "maxAllowed") return input.limit;
	if (mode === "percentOfSalary") {
		return Math.min(input.limit, input.salary * (amount ?? 0));
	}
	return Math.min(input.limit, amount ?? 0);
}

function iraContribution(input: {
	person: EnginePersonContributionPolicy;
	limit: number;
}): number {
	const { mode, amount } = input.person.ira;
	if (mode === "none") return 0;
	if (mode === "maxAllowed") return input.limit;
	return Math.min(input.limit, amount ?? 0);
}

function hsaContribution(input: {
	person: EnginePersonContributionPolicy;
	limit: number;
}): number {
	const { mode, employeeAmount, employerAmount } = input.person.hsa;
	if (mode === "none") return 0;
	// The employer's HSA dollars count against the same statutory limit, so the
	// employee can only fill what is left of it.
	const headroom = Math.max(0, input.limit - employerAmount);
	if (mode === "maxAllowed") return headroom;
	return Math.min(headroom, employeeAmount ?? 0);
}

function resolvePerson(input: {
	person: EnginePersonContributionPolicy;
	age: number;
	isWorking: boolean;
	taxYear: number;
	inflationRate: number;
	autoApplyCatchUp: boolean;
	/** Grown gross for this year. Falls back to the policy's year-0 figure. */
	salary: number;
}): ResolvedContributions {
	const { person, age, isWorking, taxYear, inflationRate, autoApplyCatchUp } =
		input;
	const resolved = emptyResolvedContributions();

	const salary = Math.max(0, input.salary);

	const wageTaxRate = Math.min(0.6, Math.max(0, person.wageTaxRate));
	const preTaxCostPerDollar = 1 - wageTaxRate;

	const addTaxDeferred = (amount: number, cashCost: number) => {
		resolved.taxDeferred.amount += amount;
		resolved.taxDeferred.cashCost += cashCost;
	};
	const addTaxFree = (amount: number, cashCost: number) => {
		resolved.taxFree.amount += amount;
		resolved.taxFree.cashCost += cashCost;
	};

	// Employer-plan deferrals and the match require active employment.
	if (isWorking) {
		const planLimit = getEmployeeDeferralLimit({
			taxYear,
			age,
			inflationRate,
			autoApplyCatchUp,
		}).amount;
		const deferral = employerPlanDeferral({ person, salary, limit: planLimit });
		const rothShare = Math.min(1, Math.max(0, person.employerPlan.rothShare));
		const rothDeferral = deferral * rothShare;
		const traditionalDeferral = deferral - rothDeferral;

		addTaxDeferred(
			traditionalDeferral,
			traditionalDeferral * preTaxCostPerDollar,
		);
		// Roth deferrals are made from money that has already been taxed, so
		// they cost a full dollar of take-home.
		addTaxFree(rothDeferral, rothDeferral);
		resolved.employeeDeferral += deferral;

		if (salary > 0) {
			const deferralPercent = deferral / salary;
			resolved.employerTaxDeferred +=
				employerMatchAmount({
					salary,
					deferralPercentOfSalary: deferralPercent,
					tiers: person.employerPlan.match,
				}) +
				salary * Math.max(0, person.employerPlan.profitSharingPercentOfSalary);
		}

		const hsaLimit = getHsaContributionLimit({
			taxYear,
			age,
			coverage: person.hsa.coverage === "family" ? "family" : "self",
			inflationRate,
			autoApplyCatchUp,
		}).amount;
		const hsaEmployee = hsaContribution({ person, limit: hsaLimit });
		addTaxDeferred(hsaEmployee, hsaEmployee * preTaxCostPerDollar);
		resolved.employeeDeferral += hsaEmployee;
		resolved.employerTaxDeferred += Math.max(0, person.hsa.employerAmount);
	}

	// An IRA needs earned income somewhere in the household, which the caller
	// has already established by gating on `contributing`.
	const iraLimit = getIraContributionLimit({
		taxYear,
		age,
		inflationRate,
		autoApplyCatchUp,
	}).amount;
	const ira = iraContribution({ person, limit: iraLimit });
	if (person.ira.kind === "roth") {
		addTaxFree(ira, ira);
	} else {
		addTaxDeferred(ira, ira * preTaxCostPerDollar);
	}
	resolved.employeeDeferral += ira;

	const taxable = Math.max(0, person.taxableMonthly) * 12;
	resolved.taxable.amount += taxable;
	resolved.taxable.cashCost += taxable;

	return resolved;
}

function mergeResolved(
	a: ResolvedContributions,
	b: ResolvedContributions,
): ResolvedContributions {
	return {
		taxDeferred: {
			amount: a.taxDeferred.amount + b.taxDeferred.amount,
			cashCost: a.taxDeferred.cashCost + b.taxDeferred.cashCost,
		},
		taxFree: {
			amount: a.taxFree.amount + b.taxFree.amount,
			cashCost: a.taxFree.cashCost + b.taxFree.cashCost,
		},
		taxable: {
			amount: a.taxable.amount + b.taxable.amount,
			cashCost: a.taxable.cashCost + b.taxable.cashCost,
		},
		employerTaxDeferred: a.employerTaxDeferred + b.employerTaxDeferred,
		employeeDeferral: a.employeeDeferral + b.employeeDeferral,
	};
}

/**
 * This year's contributions for the household. Each person contributes while
 * that person is working, which is the structural answer to "who contributes
 * when only the spouse has a job" — it is not a household-wide gate on the
 * primary's employment end.
 */
export function resolveContributionPolicy(input: {
	policy: EngineContributionPolicy;
	age: number;
	spouseAge: number | null;
	primaryWorking: boolean;
	spouseWorking: boolean;
	taxYear: number;
	inflationRate: number;
	/** This year's primary gross after salary growth. */
	primaryGrossSalary?: number;
	/** This year's spouse gross after salary growth. */
	spouseGrossSalary?: number;
}): ResolvedContributions {
	const stopAge = input.policy.contributionsStopAge;
	if (stopAge !== null && input.age >= stopAge) {
		return emptyResolvedContributions();
	}

	const primary = resolvePerson({
		person: input.policy.primary,
		age: input.age,
		isWorking: input.primaryWorking,
		taxYear: input.taxYear,
		inflationRate: input.inflationRate,
		autoApplyCatchUp: input.policy.autoApplyCatchUp,
		salary:
			input.primaryGrossSalary ?? input.policy.primary.grossAnnualCompensation,
	});

	if (!input.policy.spouse || input.spouseAge === null) return primary;

	const spouse = resolvePerson({
		person: input.policy.spouse,
		age: input.spouseAge,
		isWorking: input.spouseWorking,
		taxYear: input.taxYear,
		inflationRate: input.inflationRate,
		autoApplyCatchUp: input.policy.autoApplyCatchUp,
		salary:
			input.spouseGrossSalary ?? input.policy.spouse.grossAnnualCompensation,
	});
	return mergeResolved(primary, spouse);
}

/**
 * Clips resolved contributions to available leftover, tax-advantaged first, and
 * scales each balance addition by the share of its cash cost that survived.
 * A pre-tax dollar buys more balance than it costs, so the two must be tracked
 * separately rather than clipped as one number.
 */
export function clipResolvedContributions(input: {
	resolved: ResolvedContributions;
	leftover: number;
	contributing: boolean;
}): {
	taxDeferred: number;
	taxFree: number;
	taxable: number;
	cashSpent: number;
	residual: number;
} {
	const { resolved, leftover, contributing } = input;
	if (!contributing || leftover <= 0) {
		return {
			taxDeferred: 0,
			taxFree: 0,
			taxable: 0,
			cashSpent: 0,
			residual: Math.max(0, leftover),
		};
	}

	let remaining = leftover;
	const take = (line: ContributionLine): number => {
		if (line.cashCost <= 0) return line.amount;
		const affordable = Math.min(line.cashCost, remaining);
		remaining -= affordable;
		return line.amount * (affordable / line.cashCost);
	};

	const taxDeferred = take(resolved.taxDeferred);
	const taxFree = take(resolved.taxFree);
	const taxable = take(resolved.taxable);

	return {
		taxDeferred,
		taxFree,
		taxable,
		cashSpent: leftover - remaining,
		residual: remaining,
	};
}
