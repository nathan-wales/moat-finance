import {
	calcMonthlyPayment,
	deriveMortgageAdvancedDetails,
	monthsElapsedBetween,
} from "../financial-profile/derive-mortgage-details";

export type ForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

export interface RealEstateInputs {
	currentEstimatedValue: number;
	currentLoanBalance: number;
	purchaseDate?: Date | string | null;
	monthlyRent?: number;
	otherMonthlyIncome?: number;
	vacancyRate?: number;
	totalMonthlyExpenses?: number;
	monthlyPropertyTax?: number;
	monthlyInsurance?: number;
	monthlyHOA?: number;
	monthlyUtilities?: number;
	monthlyMaintenance?: number;
	monthlyManagement?: number;
	monthlyOtherExpenses?: number;
	interestRate?: number;
	loanTermYears?: number;
	remainingTermMonths?: number;
	monthlyMortgagePayment?: number;
	appreciationRate?: number;
	expenseGrowthRate?: number;
	/** Overrides scenario rent growth when provided (decimal, e.g. 0.04). */
	rentGrowthRate?: number;
	forecastScenario?: ForecastScenario;
}

export interface RealEstateProjectionPoint {
	year: number;
	projectedPropertyValue: number;
	projectedLoanBalance: number;
	projectedEquity: number;
	principalPaidDownThisYear: number;
	cumulativePrincipalPaidDown: number;
	appreciationThisYear: number;
	cumulativeAppreciation: number;
	equityIncreaseThisYear: number;
	annualCashFlow: number;
	cumulativeCashFlow: number;
	cumulativeNetGain: number;
	/** Starting equity used as the ROI denominator. */
	totalCashInvested: number;
	/** Alias of cumulativeNetGain for existing chart/API consumers. */
	totalGain: number;
	/** Percent ROI, or null when starting equity is zero/negative. */
	roiPercent: number | null;
	/** Alias of roiPercent for year-by-year cumulative ROI. */
	cumulativeROI: number | null;
}

type ScenarioAssumptions = {
	rentGrowthRate: number;
	appreciationRate: number;
};

const SCENARIO_ASSUMPTIONS: Record<ForecastScenario, ScenarioAssumptions> = {
	MODERATE: { rentGrowthRate: 0.02, appreciationRate: 0.02 },
	STANDARD: { rentGrowthRate: 0.04, appreciationRate: 0.03 },
	AGGRESSIVE: { rentGrowthRate: 0.06, appreciationRate: 0.05 },
};

const DEFAULT_EXPENSE_GROWTH_RATE = 0.02;
const DEFAULT_VACANCY_RATE = 0.05;

export { calcMonthlyPayment, monthsElapsedBetween };

function resolveBaseMonthlyExpenses(property: RealEstateInputs): number {
	const itemizedExpenses =
		(property.monthlyPropertyTax ?? 0) +
		(property.monthlyInsurance ?? 0) +
		(property.monthlyHOA ?? 0) +
		(property.monthlyUtilities ?? 0) +
		(property.monthlyMaintenance ?? 0) +
		(property.monthlyManagement ?? 0) +
		(property.monthlyOtherExpenses ?? 0);

	if (itemizedExpenses > 0) return itemizedExpenses;
	return property.totalMonthlyExpenses ?? 0;
}

function resolveRemainingTermMonths(
	property: RealEstateInputs,
	now: Date,
): number | undefined {
	if (
		property.remainingTermMonths !== undefined &&
		property.remainingTermMonths > 0
	) {
		return property.remainingTermMonths;
	}

	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: property.interestRate,
		currentLoanBalance: property.currentLoanBalance,
		loanTermYears: property.loanTermYears,
		now,
		purchaseDate: property.purchaseDate,
	});
	if (derived.remainingTermMonths != null) {
		return Math.max(1, derived.remainingTermMonths);
	}

	const totalLoanTermMonths = property.loanTermYears
		? property.loanTermYears * 12
		: undefined;
	return totalLoanTermMonths;
}

function resolveMonthlyMortgagePayment(
	property: RealEstateInputs,
	remainingTermMonths: number | undefined,
	now: Date,
): number {
	if (property.currentLoanBalance <= 0) return 0;

	const explicitPayment = property.monthlyMortgagePayment ?? 0;
	if (explicitPayment > 0) return explicitPayment;

	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: property.interestRate,
		currentLoanBalance: property.currentLoanBalance,
		loanTermYears: property.loanTermYears,
		now,
		purchaseDate: property.purchaseDate,
	});
	if (derived.monthlyMortgagePayment != null) {
		return derived.monthlyMortgagePayment;
	}

	const interestRate = property.interestRate;
	if (
		interestRate === undefined ||
		remainingTermMonths === undefined ||
		remainingTermMonths <= 0
	) {
		return 0;
	}

	return calcMonthlyPayment(
		property.currentLoanBalance,
		interestRate,
		remainingTermMonths,
	);
}

function amortizeOneMonth(params: {
	loanBalance: number;
	annualInterestRate: number | undefined;
	scheduledPayment: number;
}): {
	interest: number;
	principal: number;
	payment: number;
	newBalance: number;
} {
	const { loanBalance, annualInterestRate, scheduledPayment } = params;
	if (loanBalance <= 0 || scheduledPayment <= 0) {
		return { interest: 0, principal: 0, payment: 0, newBalance: 0 };
	}

	if (annualInterestRate === undefined) {
		const principal = Math.min(scheduledPayment, loanBalance);
		return {
			interest: 0,
			principal,
			payment: principal,
			newBalance: Math.max(0, loanBalance - principal),
		};
	}

	const interest = loanBalance * (annualInterestRate / 12);
	const principalPortion = scheduledPayment - interest;

	if (principalPortion <= 0) {
		return {
			interest,
			principal: 0,
			payment: scheduledPayment,
			newBalance: loanBalance + interest - scheduledPayment,
		};
	}

	const principal = Math.min(principalPortion, loanBalance);
	const payment = interest + principal;
	return {
		interest,
		principal,
		payment,
		newBalance: Math.max(0, loanBalance - principal),
	};
}

/**
 * Projects real-estate equity, cash flow, and ROI using current equity as the
 * investment basis. Appreciation and principal paydown are captured via the
 * equity change — they are not added again on top of endingEquity - startingEquity.
 */
export function calculateRealEstateProjection(
	property: RealEstateInputs,
	scenario: ForecastScenario = "STANDARD",
	years = 5,
	now: Date = new Date(),
): RealEstateProjectionPoint[] {
	const startingPropertyValue = property.currentEstimatedValue;
	const startingLoanBalance = Math.max(0, property.currentLoanBalance);
	const startingEquity = startingPropertyValue - startingLoanBalance;

	const assumptions = SCENARIO_ASSUMPTIONS[scenario];
	const appreciationRate =
		property.appreciationRate ?? assumptions.appreciationRate;
	const rentGrowthRate = property.rentGrowthRate ?? assumptions.rentGrowthRate;
	const expenseGrowthRate =
		property.expenseGrowthRate ?? DEFAULT_EXPENSE_GROWTH_RATE;
	const vacancyRate = property.vacancyRate ?? DEFAULT_VACANCY_RATE;

	const baseMonthlyRent =
		(property.monthlyRent ?? 0) + (property.otherMonthlyIncome ?? 0);
	const baseMonthlyExpenses = resolveBaseMonthlyExpenses(property);
	const remainingTermMonths = resolveRemainingTermMonths(property, now);
	const scheduledPayment = resolveMonthlyMortgagePayment(
		property,
		remainingTermMonths,
		now,
	);

	const canComputeRoi = startingEquity > 0;
	const totalMonths = Math.max(0, years) * 12;

	let loanBalance = startingLoanBalance;
	let cumulativeCashFlow = 0;
	let cumulativePrincipalPaidDown = 0;
	let yearCashFlow = 0;
	let previousPropertyValue = startingPropertyValue;
	let previousLoanBalance = startingLoanBalance;
	let previousEquity = startingEquity;

	const points: RealEstateProjectionPoint[] = [];

	for (let month = 1; month <= totalMonths; month++) {
		const growthYears = Math.floor((month - 1) / 12);
		const propertyValue =
			startingPropertyValue * (1 + appreciationRate) ** (month / 12);

		const amortization = amortizeOneMonth({
			loanBalance,
			annualInterestRate: property.interestRate,
			scheduledPayment,
		});
		loanBalance = amortization.newBalance;
		cumulativePrincipalPaidDown += amortization.principal;

		const monthlyIncome =
			baseMonthlyRent * (1 + rentGrowthRate) ** growthYears * (1 - vacancyRate);
		const monthlyExpenses =
			baseMonthlyExpenses * (1 + expenseGrowthRate) ** growthYears;
		const monthlyCashFlow =
			monthlyIncome - monthlyExpenses - amortization.payment;

		cumulativeCashFlow += monthlyCashFlow;
		yearCashFlow += monthlyCashFlow;

		if (month % 12 !== 0) continue;

		const year = month / 12;
		const equity = propertyValue - loanBalance;
		const appreciationThisYear = propertyValue - previousPropertyValue;
		const cumulativeAppreciation = propertyValue - startingPropertyValue;
		const principalPaidDownThisYear = previousLoanBalance - loanBalance;
		const equityIncreaseThisYear = equity - previousEquity;
		const cumulativeNetGain = equity - startingEquity + cumulativeCashFlow;
		const cumulativeROI = canComputeRoi
			? (cumulativeNetGain / startingEquity) * 100
			: null;

		points.push({
			year,
			projectedPropertyValue: propertyValue,
			projectedLoanBalance: loanBalance,
			projectedEquity: equity,
			principalPaidDownThisYear,
			cumulativePrincipalPaidDown,
			appreciationThisYear,
			cumulativeAppreciation,
			equityIncreaseThisYear,
			annualCashFlow: yearCashFlow,
			cumulativeCashFlow,
			cumulativeNetGain,
			totalCashInvested: startingEquity,
			totalGain: cumulativeNetGain,
			roiPercent: cumulativeROI,
			cumulativeROI,
		});

		previousPropertyValue = propertyValue;
		previousLoanBalance = loanBalance;
		previousEquity = equity;
		yearCashFlow = 0;
	}

	return points;
}
