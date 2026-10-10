import { amortizeYear } from "../amortize";
import type { ProjectedLiability } from "../types";

/** Installment payments due this year, prorated to the month the balance hits 0. */
export function calculateOtherDebtService(
	liabilities: ProjectedLiability[],
): number {
	let otherDebtService = 0;
	for (const liability of liabilities) {
		const monthlyPayment =
			liability.monthlyPayment + (liability.extraMonthlyPayment ?? 0);
		if (liability.balance <= 0 || monthlyPayment <= 0) continue;
		const monthsDue = amortizeYear({
			balance: liability.balance,
			annualInterestRate: liability.annualInterestRate,
			monthlyPayment,
			remainingTermMonths: liability.remainingTermMonths,
		}).monthsPaid;
		otherDebtService += monthlyPayment * monthsDue;
	}
	return otherDebtService;
}
