import type {
	RealEstateInput,
	RealEstateInvestment,
	UpdateRealEstateInput,
} from "@moat/contracts";
import {
	parseFormInt,
	parseFormNumber,
	type RealEstateFormValues,
} from "./real-estate-form-state";

function toApiNumber(value: string): number | undefined {
	return value !== "" ? parseFormNumber(value) : undefined;
}

function toApiInt(value: string): number | undefined {
	return value !== "" ? parseFormInt(value) : undefined;
}

function buildRealEstateInputFromForm(
	values: RealEstateFormValues,
): RealEstateInput {
	const interestRate = toApiNumber(values.interestRate);
	const vacancyRate = toApiNumber(values.vacancyRate);
	const appreciationRate = toApiNumber(values.appreciationRate);
	const expenseGrowthRate = toApiNumber(values.expenseGrowthRate);

	const input: RealEstateInput = {
		name: values.name,
		propertyType: values.propertyType,
		usageType: values.usageType,
		currentEstimatedValue: parseFloat(
			values.currentEstimatedValue.replace(/,/g, ""),
		),
		currentLoanBalance: values.hasMortgage
			? parseFloat((values.currentLoanBalance || "0").replace(/,/g, ""))
			: 0,
		totalMonthlyExpenses: toApiNumber(values.totalMonthlyExpenses),
		forecastScenario: values.forecastScenario,
		monthlyPropertyTax: toApiNumber(values.monthlyPropertyTax),
		monthlyInsurance: toApiNumber(values.monthlyInsurance),
		monthlyHOA: toApiNumber(values.monthlyHOA),
		monthlyUtilities: toApiNumber(values.monthlyUtilities),
		monthlyMaintenance: toApiNumber(values.monthlyMaintenance),
		monthlyManagement: toApiNumber(values.monthlyManagement),
		monthlyOtherExpenses: toApiNumber(values.monthlyOtherExpenses),
		appreciationRate:
			appreciationRate !== undefined ? appreciationRate / 100 : undefined,
		expenseGrowthRate:
			expenseGrowthRate !== undefined ? expenseGrowthRate / 100 : undefined,
	};

	if (values.hasMortgage) {
		input.purchasePrice = toApiNumber(values.purchasePrice);
		input.downPayment = toApiNumber(values.downPayment);
		input.closingCosts = toApiNumber(values.closingCosts);
		input.rehabCosts = toApiNumber(values.rehabCosts);
		input.purchaseDate = values.purchaseDate
			? new Date(values.purchaseDate).toISOString()
			: undefined;
		input.interestRate =
			interestRate !== undefined ? interestRate / 100 : undefined;
		input.loanTermYears = toApiInt(values.loanTermYears);
		input.remainingTermMonths = toApiInt(values.remainingTermMonths);
		input.monthlyMortgagePayment = toApiNumber(values.monthlyMortgagePayment);
	}

	if (values.isRented) {
		input.monthlyRent = toApiNumber(values.monthlyRent);
		input.otherMonthlyIncome = toApiNumber(values.otherMonthlyIncome);
		input.vacancyRate =
			vacancyRate !== undefined ? vacancyRate / 100 : undefined;
	}

	const linkedId = values.linkedPlaidAccountId.trim();
	if (linkedId) {
		input.linkedPlaidAccountId = linkedId;
	}

	return input;
}

const mortgageClearFields = [
	"purchasePrice",
	"purchaseDate",
	"downPayment",
	"closingCosts",
	"rehabCosts",
	"interestRate",
	"loanTermYears",
	"remainingTermMonths",
	"monthlyMortgagePayment",
] as const;

const rentalClearFields = [
	"monthlyRent",
	"otherMonthlyIncome",
	"vacancyRate",
] as const;

export function mapFormValuesToCreateInput(
	values: RealEstateFormValues,
): RealEstateInput {
	return buildRealEstateInputFromForm(values);
}

export function mapFormValuesToUpdateInput(
	id: string,
	values: RealEstateFormValues,
): UpdateRealEstateInput {
	const input: UpdateRealEstateInput = {
		id,
		...buildRealEstateInputFromForm(values),
		linkedPlaidAccountId: values.linkedPlaidAccountId.trim() || null,
	};

	if (!values.hasMortgage) {
		for (const field of mortgageClearFields) {
			input[field] = null;
		}
	}

	if (!values.isRented) {
		for (const field of rentalClearFields) {
			input[field] = null;
		}
	}

	return input;
}

function formatOptionalNumber(value: number | null | undefined): string {
	if (value == null) return "";
	return String(value);
}

function formatOptionalPercent(value: number | null | undefined): string {
	if (value == null) return "";
	return String(value * 100);
}

function propertyHasMortgage(property: RealEstateInvestment): boolean {
	return (
		property.currentLoanBalance > 0 ||
		!!property.linkedPlaidAccountId ||
		property.interestRate != null ||
		property.loanTermYears != null ||
		property.purchaseDate != null
	);
}

function propertyIsRented(property: RealEstateInvestment): boolean {
	return (
		property.usageType === "RENTAL" ||
		property.monthlyRent != null ||
		property.otherMonthlyIncome != null
	);
}

export function mapPropertyToFormValues(
	property: RealEstateInvestment,
): RealEstateFormValues {
	return {
		name: property.name,
		propertyType: property.propertyType,
		usageType: property.usageType,
		currentEstimatedValue: String(property.currentEstimatedValue),
		currentLoanBalance: String(property.currentLoanBalance),
		hasMortgage: propertyHasMortgage(property),
		isRented: propertyIsRented(property),
		monthlyRent: formatOptionalNumber(property.monthlyRent),
		totalMonthlyExpenses: formatOptionalNumber(property.totalMonthlyExpenses),
		forecastScenario: property.forecastScenario,
		purchaseDate: property.purchaseDate
			? (new Date(property.purchaseDate).toISOString().split("T")[0] ?? "")
			: "",
		loanTermYears: formatOptionalNumber(property.loanTermYears),
		interestRate: formatOptionalPercent(property.interestRate),
		purchasePrice: formatOptionalNumber(property.purchasePrice),
		downPayment: formatOptionalNumber(property.downPayment),
		downPaymentEstimated: property.downPayment == null,
		closingCosts: formatOptionalNumber(property.closingCosts),
		rehabCosts: formatOptionalNumber(property.rehabCosts),
		remainingTermMonths: formatOptionalNumber(property.remainingTermMonths),
		remainingTermMonthsEstimated: property.remainingTermMonths == null,
		monthlyMortgagePayment: formatOptionalNumber(
			property.monthlyMortgagePayment,
		),
		monthlyMortgagePaymentEstimated: property.monthlyMortgagePayment == null,
		otherMonthlyIncome: formatOptionalNumber(property.otherMonthlyIncome),
		vacancyRate: formatOptionalPercent(property.vacancyRate),
		monthlyPropertyTax: formatOptionalNumber(property.monthlyPropertyTax),
		monthlyInsurance: formatOptionalNumber(property.monthlyInsurance),
		monthlyHOA: formatOptionalNumber(property.monthlyHOA),
		monthlyUtilities: formatOptionalNumber(property.monthlyUtilities),
		monthlyMaintenance: formatOptionalNumber(property.monthlyMaintenance),
		monthlyManagement: formatOptionalNumber(property.monthlyManagement),
		monthlyOtherExpenses: formatOptionalNumber(property.monthlyOtherExpenses),
		appreciationRate: formatOptionalPercent(property.appreciationRate),
		expenseGrowthRate: formatOptionalPercent(property.expenseGrowthRate),
		linkedPlaidAccountId: property.linkedPlaidAccountId ?? "",
	};
}
