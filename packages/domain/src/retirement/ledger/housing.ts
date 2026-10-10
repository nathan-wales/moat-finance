import { amortizeYear } from "../amortize";
import type { ProjectedProperty } from "../types";

export type HousingInputs = {
	ownedNow: ProjectedProperty[];
	yearIndex: number;
	inflationFactor: number;
	age: number;
	rentingFromAge: number | null;
	monthlyRentAfterSale: number;
	ownsPrimaryResidence: boolean;
};

export type HousingResult = {
	rentalIncome: number;
	housingExpenses: number;
};

export function propertyLoanSchedule(property: ProjectedProperty): {
	monthlyPayment: number;
	balance: number;
	annualInterestRate: number;
	remainingTermMonths: number;
} {
	return {
		monthlyPayment: property.monthlyPayment + property.extraMonthlyPayment,
		balance: property.loanBalance,
		annualInterestRate: property.annualInterestRate,
		remainingTermMonths: property.remainingTermMonths,
	};
}

/** Rent collected and housing cash-out for the year, P&I prorated to payoff. */
export function calculateHousing(input: HousingInputs): HousingResult {
	let rentalIncome = 0;
	let housingExpenses = 0;
	for (const property of input.ownedNow) {
		const grossRent = property.monthlyRent * 12 * input.inflationFactor;
		rentalIncome += grossRent * (1 - property.vacancyRate);
		housingExpenses +=
			property.monthlyExpenses *
			12 *
			(1 + property.expenseGrowthRate) ** input.yearIndex;
		if (property.loanBalance > 0) {
			const schedule = propertyLoanSchedule(property);
			housingExpenses +=
				schedule.monthlyPayment * amortizeYear(schedule).monthsPaid;
		}
	}
	if (
		input.rentingFromAge !== null &&
		input.age >= input.rentingFromAge &&
		!input.ownsPrimaryResidence
	) {
		housingExpenses += input.monthlyRentAfterSale * 12 * input.inflationFactor;
	}
	return { rentalIncome, housingExpenses };
}
