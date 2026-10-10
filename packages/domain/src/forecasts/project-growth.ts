import { addMonths, format } from "date-fns";

export type InvestmentGrowthInputs = {
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
};

export type RealEstateEquityInputs = {
	currentEstimatedValue: number;
	currentLoanBalance: number;
	appreciationRate?: number | null;
	interestRate?: number | null;
	monthlyMortgagePayment?: number | null;
};

/**
 * Projects investment growth with monthly compounding and contributions.
 */
export function forecastInvestmentGrowth(
	inputs: InvestmentGrowthInputs,
	months: number,
	now: Date = new Date(),
): { month: string; balance: number }[] {
	const monthlyRate = inputs.annualReturnRate / 12;
	let balance = inputs.startingBalance;
	const points: { month: string; balance: number }[] = [];

	for (let i = 1; i <= months; i++) {
		balance = balance * (1 + monthlyRate) + inputs.monthlyContribution;
		points.push({
			month: format(addMonths(now, i), "yyyy-MM"),
			balance,
		});
	}

	return points;
}

/**
 * Projects real estate equity forward, modeling appreciation and optional
 * mortgage amortization. Equity = projected property value − loan balance.
 */
export function projectRealEstateEquity(
	inputs: RealEstateEquityInputs,
	months: number,
	now: Date = new Date(),
): { month: string; equity: number }[] {
	const annualAppreciation = inputs.appreciationRate ?? 0.04;
	const monthlyAppreciationRate = annualAppreciation / 12;

	const canAmortize =
		inputs.interestRate != null &&
		inputs.monthlyMortgagePayment != null &&
		inputs.currentLoanBalance > 0;

	const monthlyInterestRate = canAmortize ? (inputs.interestRate ?? 0) / 12 : 0;
	const monthlyPayment = inputs.monthlyMortgagePayment ?? 0;

	return Array.from({ length: months }, (_, i) => {
		const m = i + 1;
		const projectedValue =
			inputs.currentEstimatedValue * (1 + monthlyAppreciationRate) ** m;

		let remainingBalance: number;
		if (canAmortize && monthlyInterestRate > 0) {
			const factor = (1 + monthlyInterestRate) ** m;
			remainingBalance = Math.max(
				0,
				inputs.currentLoanBalance * factor -
					monthlyPayment * ((factor - 1) / monthlyInterestRate),
			);
		} else {
			remainingBalance = inputs.currentLoanBalance;
		}

		return {
			month: format(addMonths(now, m), "yyyy-MM"),
			equity: projectedValue - remainingBalance,
		};
	});
}
