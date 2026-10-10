import type { Investment } from "@moat/data-access";
import type { AppContext } from "../context";
import {
	addOneAnniversaryMonth,
	applyOneMonthStep,
	type AccrualInvestmentInputs,
	planCatchUpMonths,
} from "./accrual";

export type AccrualApplicationStep = {
	investmentId: string;
	userId: string;
	previousBalance: number;
	newBalance: number;
	contributionApplied: number;
	returnApplied: number;
	netIncrement: number;
	periodStart: Date;
	periodEnd: Date;
	lastBalanceAccruedAt: Date;
	nextBalanceAccrualDueAt: Date;
	accruedAt: Date;
};

export type AccrueDueManualInvestmentsResult = {
	processed: number;
	accrued: number;
	monthsApplied: number;
	skipped: number;
	failed: number;
	/** Applied steps for callers that need to write history/snapshots. */
	appliedSteps: AccrualApplicationStep[];
};

function toAccrualInputs(investment: Investment): AccrualInvestmentInputs {
	return {
		startingBalance: investment.startingBalance,
		monthlyContribution: investment.monthlyContribution,
		annualReturnRate: investment.annualReturnRate,
		autoUpdateBalance: investment.autoUpdateBalance,
		createdAt: investment.createdAt,
		lastBalanceAccruedAt: investment.lastBalanceAccruedAt,
		nextBalanceAccrualDueAt: investment.nextBalanceAccrualDueAt,
	};
}

/**
 * Pure planner: given an investment and now, return ordered accrual steps to apply.
 */
export function planAccrualSteps(
	investment: Investment,
	now: Date = new Date(),
): AccrualApplicationStep[] {
	const months = planCatchUpMonths(toAccrualInputs(investment), now);
	if (months.length === 0) return [];

	const steps: AccrualApplicationStep[] = [];
	let balance = investment.startingBalance;

	for (const month of months) {
		const step = applyOneMonthStep({
			balance,
			monthlyContribution: investment.monthlyContribution,
			annualReturnRate: investment.annualReturnRate,
		});
		const lastBalanceAccruedAt = month.periodEnd;
		const nextBalanceAccrualDueAt = addOneAnniversaryMonth(
			month.periodEnd,
			investment.createdAt,
		);
		steps.push({
			investmentId: investment.id,
			userId: investment.userId,
			previousBalance: balance,
			newBalance: step.newBalance,
			contributionApplied: step.contributionApplied,
			returnApplied: step.returnApplied,
			netIncrement: step.netIncrement,
			periodStart: month.periodStart,
			periodEnd: month.periodEnd,
			lastBalanceAccruedAt,
			nextBalanceAccrualDueAt,
			accruedAt: now,
		});
		balance = step.newBalance;
	}

	return steps;
}

/**
 * Single-user accrual for desktop (and any AppContext-backed caller).
 */
export async function accrueDueManualInvestments(
	ctx: AppContext,
	now: Date = new Date(),
): Promise<AccrueDueManualInvestmentsResult> {
	const investmentsRepo = ctx.repositories.investments;
	if (!investmentsRepo) {
		return {
			processed: 0,
			accrued: 0,
			monthsApplied: 0,
			skipped: 0,
			failed: 0,
			appliedSteps: [],
		};
	}

	const due = await investmentsRepo.listDueForUser({
		userId: ctx.userId,
		now,
	});

	let accrued = 0;
	let monthsApplied = 0;
	let skipped = 0;
	let failed = 0;
	const appliedSteps: AccrualApplicationStep[] = [];

	for (const investment of due) {
		const steps = planAccrualSteps(investment, now);
		if (steps.length === 0) {
			skipped += 1;
			continue;
		}

		try {
			await investmentsRepo.applyAccruals({
				userId: investment.userId,
				investmentId: investment.id,
				steps: steps.map((step) => ({
					newBalance: step.newBalance,
					lastBalanceAccruedAt: step.lastBalanceAccruedAt,
					nextBalanceAccrualDueAt: step.nextBalanceAccrualDueAt,
					audit: {
						previousBalance: step.previousBalance,
						newBalance: step.newBalance,
						contributionApplied: step.contributionApplied,
						returnApplied: step.returnApplied,
						netIncrement: step.netIncrement,
						periodStart: step.periodStart,
						periodEnd: step.periodEnd,
						accruedAt: step.accruedAt,
					},
				})),
			});
			monthsApplied += steps.length;
			accrued += 1;
			appliedSteps.push(...steps);
		} catch {
			failed += 1;
		}
	}

	return {
		processed: due.length,
		accrued,
		monthsApplied,
		skipped,
		failed,
		appliedSteps,
	};
}
