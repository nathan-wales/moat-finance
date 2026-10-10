import {
	addOneAnniversaryMonth,
	anniversaryDateInMonth,
	computeNextAnniversaryDueAt,
	initialNextAnniversaryDueAt,
	MAX_ANNIVERSARY_CATCH_UP_MONTHS,
	planAnniversaryCatchUpMonths,
	startOfUtcDay,
} from "../scheduling/anniversary";

export const MAX_ACCRUAL_CATCH_UP_MONTHS = MAX_ANNIVERSARY_CATCH_UP_MONTHS;

export type AccrualInvestmentInputs = {
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	autoUpdateBalance: boolean;
	createdAt: Date;
	lastBalanceAccruedAt?: Date | null;
	nextBalanceAccrualDueAt?: Date | null;
};

export type MonthStepResult = {
	newBalance: number;
	contributionApplied: number;
	returnApplied: number;
	netIncrement: number;
};

export type PlannedAccrualMonth = {
	periodStart: Date;
	periodEnd: Date;
};

export { addOneAnniversaryMonth, anniversaryDateInMonth, startOfUtcDay };

/**
 * First accrual due date after `fromExclusive` (typically createdAt or last accrued).
 * Always at least one anniversary month after the anchor.
 */
export function computeNextAccrualDueAt(
	createdAt: Date,
	lastAccruedAt: Date | null | undefined,
	_fromDate: Date = new Date(),
): Date {
	return computeNextAnniversaryDueAt(createdAt, lastAccruedAt);
}

/**
 * Live balance accrual requires a non-zero contribution.
 * Default annualReturnRate (7%) is forecast-only unless the user also contributes.
 */
export function hasAccrualGrowth(inputs: {
	monthlyContribution: number;
	annualReturnRate: number;
}): boolean {
	return inputs.monthlyContribution !== 0;
}

export function isAccrualDue(
	investment: AccrualInvestmentInputs,
	now: Date,
): boolean {
	if (!investment.autoUpdateBalance) return false;
	if (!hasAccrualGrowth(investment)) return false;
	const dueAt =
		investment.nextBalanceAccrualDueAt ??
		computeNextAccrualDueAt(
			investment.createdAt,
			investment.lastBalanceAccruedAt,
			now,
		);
	return startOfUtcDay(dueAt).getTime() <= startOfUtcDay(now).getTime();
}

export function applyOneMonthStep(inputs: {
	balance: number;
	monthlyContribution: number;
	annualReturnRate: number;
}): MonthStepResult {
	const monthlyRate = inputs.annualReturnRate / 12;
	const returnApplied = inputs.balance * monthlyRate;
	const contributionApplied = inputs.monthlyContribution;
	const newBalance = inputs.balance * (1 + monthlyRate) + contributionApplied;
	return {
		newBalance,
		contributionApplied,
		returnApplied,
		netIncrement: newBalance - inputs.balance,
	};
}

/**
 * Ordered months to apply for catch-up, each ending on an anniversary date.
 */
export function planCatchUpMonths(
	investment: AccrualInvestmentInputs,
	now: Date,
	maxMonths: number = MAX_ACCRUAL_CATCH_UP_MONTHS,
): PlannedAccrualMonth[] {
	return planAnniversaryCatchUpMonths({
		anchor: investment.createdAt,
		lastAppliedAt: investment.lastBalanceAccruedAt,
		nextDueAt: investment.nextBalanceAccrualDueAt,
		now,
		isEligible: investment.autoUpdateBalance && hasAccrualGrowth(investment),
		maxMonths,
	});
}

export function initialNextAccrualDueAt(createdAt: Date): Date {
	return initialNextAnniversaryDueAt(createdAt);
}
