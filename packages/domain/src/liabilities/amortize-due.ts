import type { FinancialProfileData, ProfileLiability } from "@moat/contracts";
import { differenceInCalendarMonths } from "date-fns";
import {
	amortizeMonth,
	remainingTermMonthsFromPayment,
} from "../retirement/amortize";
import {
	addOneAnniversaryMonth,
	planAnniversaryCatchUpMonths,
	startOfUtcDay,
} from "../scheduling/anniversary";

export type AmortizationLiabilityInputs = {
	id: string;
	balance: number;
	interestRate: number;
	monthlyPayment: number;
	loanStartDate?: string;
	loanTermYears?: number;
	payoffDate?: string;
	autoUpdateBalance?: boolean;
	lastBalanceAmortizedAt?: string;
	nextBalanceAmortizationDueAt?: string;
};

export type AmortizationApplicationStep = {
	liabilityId: string;
	previousBalance: number;
	newBalance: number;
	remainingTermMonths: number;
	periodStart: Date;
	periodEnd: Date;
	lastBalanceAmortizedAt: string;
	nextBalanceAmortizationDueAt: string;
};

function parseAnnualRate(value: number): number {
	if (!Number.isFinite(value) || value === 0) return 0;
	return value > 1 ? value / 100 : value;
}

function parseOptionalDate(value: string | undefined): Date | null {
	if (!value) return null;
	const date = new Date(value.includes("T") ? value : `${value}T00:00:00.000Z`);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

function remainingMonthsUntil(endDate: string, now: Date): number | null {
	const end = new Date(endDate);
	if (Number.isNaN(end.getTime())) return null;
	return differenceInCalendarMonths(end, now);
}

/**
 * Prefer start+term, then legacy payoffDate, then solve from payment/rate.
 */
export function resolveRemainingTermMonths(
	liability: Pick<
		AmortizationLiabilityInputs,
		| "balance"
		| "interestRate"
		| "monthlyPayment"
		| "loanStartDate"
		| "loanTermYears"
		| "payoffDate"
	>,
	now: Date,
): number {
	const balance = Math.abs(liability.balance);
	const annualInterestRate = parseAnnualRate(liability.interestRate);
	const monthlyPayment = Math.max(0, liability.monthlyPayment);

	if (
		liability.loanStartDate &&
		liability.loanTermYears != null &&
		liability.loanTermYears > 0
	) {
		const start = parseOptionalDate(liability.loanStartDate);
		if (start) {
			const totalMonths = Math.round(liability.loanTermYears * 12);
			const elapsed = differenceInCalendarMonths(now, start);
			return Math.max(1, totalMonths - Math.max(0, elapsed));
		}
	}

	if (liability.payoffDate) {
		const monthsUntilPayoff = remainingMonthsUntil(liability.payoffDate, now);
		if (monthsUntilPayoff !== null) {
			return Math.max(1, monthsUntilPayoff);
		}
	}

	return remainingTermMonthsFromPayment(
		balance,
		monthlyPayment,
		annualInterestRate,
	);
}

export function resolveAmortizationAnchor(
	liability: Pick<
		AmortizationLiabilityInputs,
		"loanStartDate" | "nextBalanceAmortizationDueAt" | "lastBalanceAmortizedAt"
	>,
	fallback: Date = new Date(),
): Date {
	const start = parseOptionalDate(liability.loanStartDate);
	if (start) return startOfUtcDay(start);

	const last = parseOptionalDate(liability.lastBalanceAmortizedAt);
	if (last) return startOfUtcDay(last);

	const due = parseOptionalDate(liability.nextBalanceAmortizationDueAt);
	if (due) {
		// Walk back one month from the scheduled due date to recover the enable day.
		const prior = new Date(due);
		prior.setUTCMonth(prior.getUTCMonth() - 1);
		return startOfUtcDay(prior);
	}

	return startOfUtcDay(fallback);
}

export function isLiabilityAmortizationEligible(
	liability: AmortizationLiabilityInputs,
): boolean {
	if (liability.autoUpdateBalance !== true) return false;
	if (liability.balance <= 0) return false;
	if (liability.monthlyPayment <= 0) return false;
	return true;
}

export function isLiabilityAmortizationDue(
	liability: AmortizationLiabilityInputs,
	now: Date,
): boolean {
	if (!isLiabilityAmortizationEligible(liability)) return false;
	const dueAt = parseOptionalDate(liability.nextBalanceAmortizationDueAt);
	if (!dueAt) return false;
	return startOfUtcDay(dueAt).getTime() <= startOfUtcDay(now).getTime();
}

/**
 * Pure planner: ordered amortization steps for a single liability.
 */
export function planLiabilityAmortizationSteps(
	liability: AmortizationLiabilityInputs,
	now: Date = new Date(),
): AmortizationApplicationStep[] {
	if (!isLiabilityAmortizationDue(liability, now)) return [];

	const anchor = resolveAmortizationAnchor(liability, now);
	const months = planAnniversaryCatchUpMonths({
		anchor,
		lastAppliedAt: parseOptionalDate(liability.lastBalanceAmortizedAt),
		nextDueAt: parseOptionalDate(liability.nextBalanceAmortizationDueAt),
		now,
		isEligible: true,
	});
	if (months.length === 0) return [];

	const steps: AmortizationApplicationStep[] = [];
	let balance = liability.balance;
	let remainingTermMonths = resolveRemainingTermMonths(liability, now);
	const annualInterestRate = parseAnnualRate(liability.interestRate);

	for (const month of months) {
		const result = amortizeMonth({
			balance,
			annualInterestRate,
			monthlyPayment: liability.monthlyPayment,
			remainingTermMonths,
		});
		const lastBalanceAmortizedAt = month.periodEnd.toISOString();
		const nextBalanceAmortizationDueAt = addOneAnniversaryMonth(
			month.periodEnd,
			anchor,
		).toISOString();

		steps.push({
			liabilityId: liability.id,
			previousBalance: balance,
			newBalance: result.balance,
			remainingTermMonths: result.remainingTermMonths,
			periodStart: month.periodStart,
			periodEnd: month.periodEnd,
			lastBalanceAmortizedAt,
			nextBalanceAmortizationDueAt,
		});

		balance = result.balance;
		remainingTermMonths = result.remainingTermMonths;
		if (balance <= 0) break;
	}

	return steps;
}

export function applyAmortizationStepsToLiability(
	liability: ProfileLiability,
	steps: AmortizationApplicationStep[],
): ProfileLiability {
	const last = steps.at(-1);
	if (!last) return liability;
	return {
		...liability,
		balance: last.newBalance,
		lastBalanceAmortizedAt: last.lastBalanceAmortizedAt,
		nextBalanceAmortizationDueAt: last.nextBalanceAmortizationDueAt,
	};
}

export function toAmortizationInputs(
	liability: ProfileLiability,
): AmortizationLiabilityInputs {
	return {
		id: liability.id,
		balance: liability.balance,
		interestRate: liability.interestRate,
		monthlyPayment: liability.monthlyPayment,
		loanStartDate: liability.loanStartDate,
		loanTermYears: liability.loanTermYears,
		payoffDate: liability.payoffDate,
		autoUpdateBalance: liability.autoUpdateBalance,
		lastBalanceAmortizedAt: liability.lastBalanceAmortizedAt,
		nextBalanceAmortizationDueAt: liability.nextBalanceAmortizationDueAt,
	};
}

export type AmortizeProfileLiabilitiesResult = {
	data: FinancialProfileData;
	amortized: number;
	monthsApplied: number;
};

/** Apply due amortization steps across all liabilities in a profile document. */
export function amortizeProfileLiabilities(
	data: FinancialProfileData,
	now: Date = new Date(),
): AmortizeProfileLiabilitiesResult {
	let amortized = 0;
	let monthsApplied = 0;
	const nextLiabilities = data.liabilities.map((liability) => {
		const steps = planLiabilityAmortizationSteps(
			toAmortizationInputs(liability),
			now,
		);
		if (steps.length === 0) return liability;
		amortized += 1;
		monthsApplied += steps.length;
		return applyAmortizationStepsToLiability(liability, steps);
	});

	if (amortized === 0) {
		return { data, amortized: 0, monthsApplied: 0 };
	}

	return {
		data: { ...data, liabilities: nextLiabilities },
		amortized,
		monthsApplied,
	};
}
