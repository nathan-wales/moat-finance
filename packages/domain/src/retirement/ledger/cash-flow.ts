export type CashInInputs = {
	employmentIncome: number;
	spouseEmploymentIncome: number;
	socialSecurityIncome: number;
	spouseSocialSecurityIncome: number;
	rentalIncome: number;
	otherIncome: number;
	insuranceIncome: number;
	oneTimeInflows: number;
};

export type CashOutInputs = {
	livingExpenses: number;
	housingExpenses: number;
	healthcareExpenses: number;
	recurringExpenseTotal: number;
	insurancePremiums: number;
	oneTimeOutflows: number;
	otherDebtService: number;
};

export function calculateCashIn(input: CashInInputs): number {
	return (
		input.employmentIncome +
		input.spouseEmploymentIncome +
		input.socialSecurityIncome +
		input.spouseSocialSecurityIncome +
		input.rentalIncome +
		input.otherIncome +
		input.insuranceIncome +
		input.oneTimeInflows
	);
}

export function calculateCashOut(input: CashOutInputs): number {
	return (
		input.livingExpenses +
		input.housingExpenses +
		input.healthcareExpenses +
		input.recurringExpenseTotal +
		input.insurancePremiums +
		input.oneTimeOutflows +
		input.otherDebtService
	);
}
