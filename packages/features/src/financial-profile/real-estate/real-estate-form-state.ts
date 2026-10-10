import {
	deriveMortgageAdvancedDetails,
	roundMortgageDollars,
} from "@moat/domain/derive-mortgage-details";
import { calculateRealEstateProjection } from "./real-estate-forecasting";

export type PropertyType =
	| "SINGLE_FAMILY"
	| "MULTI_FAMILY"
	| "CONDO"
	| "COMMERCIAL"
	| "LAND"
	| "OTHER";

export type UsageType =
	| "PRIMARY_RESIDENCE"
	| "RENTAL"
	| "VACATION_HOME"
	| "MIXED_USE";

export type ForecastScenario = "MODERATE" | "STANDARD" | "AGGRESSIVE";

export interface RealEstateFormValues {
	name: string;
	propertyType: PropertyType;
	usageType: UsageType;
	currentEstimatedValue: string;
	currentLoanBalance: string;
	hasMortgage: boolean;
	isRented: boolean;
	monthlyRent: string;
	totalMonthlyExpenses: string;
	forecastScenario: ForecastScenario;
	purchaseDate: string;
	loanTermYears: string;
	interestRate: string;
	purchasePrice: string;
	downPayment: string;
	downPaymentEstimated: boolean;
	closingCosts: string;
	rehabCosts: string;
	remainingTermMonths: string;
	remainingTermMonthsEstimated: boolean;
	monthlyMortgagePayment: string;
	monthlyMortgagePaymentEstimated: boolean;
	otherMonthlyIncome: string;
	vacancyRate: string;
	monthlyPropertyTax: string;
	monthlyInsurance: string;
	monthlyHOA: string;
	monthlyUtilities: string;
	monthlyMaintenance: string;
	monthlyManagement: string;
	monthlyOtherExpenses: string;
	appreciationRate: string;
	expenseGrowthRate: string;
	linkedPlaidAccountId: string;
}

export const DEFAULT_RE_FORM: RealEstateFormValues = {
	name: "",
	propertyType: "SINGLE_FAMILY",
	usageType: "PRIMARY_RESIDENCE",
	currentEstimatedValue: "",
	currentLoanBalance: "",
	hasMortgage: true,
	isRented: false,
	monthlyRent: "",
	totalMonthlyExpenses: "",
	forecastScenario: "STANDARD",
	purchaseDate: "",
	loanTermYears: "",
	interestRate: "",
	purchasePrice: "",
	downPayment: "",
	downPaymentEstimated: false,
	closingCosts: "",
	rehabCosts: "",
	remainingTermMonths: "",
	remainingTermMonthsEstimated: false,
	monthlyMortgagePayment: "",
	monthlyMortgagePaymentEstimated: false,
	otherMonthlyIncome: "",
	vacancyRate: "",
	monthlyPropertyTax: "",
	monthlyInsurance: "",
	monthlyHOA: "",
	monthlyUtilities: "",
	monthlyMaintenance: "",
	monthlyManagement: "",
	monthlyOtherExpenses: "",
	appreciationRate: "",
	expenseGrowthRate: "",
	linkedPlaidAccountId: "",
};

export const realEstateIntakeSteps = [
	{ id: "property", label: "Property" },
	{ id: "mortgage", label: "Mortgage" },
	{ id: "income", label: "Income" },
	{ id: "expenses", label: "Expenses" },
	{ id: "forecast", label: "Forecast" },
	{ id: "review", label: "Review" },
] as const;

export type RealEstateIntakeStepId =
	(typeof realEstateIntakeSteps)[number]["id"];

export function parseFormNumber(value: string): number | undefined {
	const parsed = parseFloat(value.replace(/,/g, ""));
	return Number.isNaN(parsed) ? undefined : parsed;
}

export function parseFormInt(value: string): number | undefined {
	const parsed = parseInt(value, 10);
	return Number.isNaN(parsed) ? undefined : parsed;
}

type AdvancedMortgagePatch = Partial<
	Pick<
		RealEstateFormValues,
		| "remainingTermMonths"
		| "remainingTermMonthsEstimated"
		| "monthlyMortgagePayment"
		| "monthlyMortgagePaymentEstimated"
		| "downPayment"
		| "downPaymentEstimated"
	>
>;

const ADVANCED_ESTIMATED_FLAG = {
	downPayment: "downPaymentEstimated",
	remainingTermMonths: "remainingTermMonthsEstimated",
	monthlyMortgagePayment: "monthlyMortgagePaymentEstimated",
} as const;

function isEmptyInput(value: string): boolean {
	return value.trim() === "";
}

function shouldAutofillAdvancedField(
	value: string,
	estimated: boolean,
): boolean {
	return isEmptyInput(value) || estimated;
}

function requiredMortgageDrivers(form: RealEstateFormValues) {
	if (!form.hasMortgage) return null;
	const purchasePrice = parseFormNumber(form.purchasePrice);
	const interestPercent = parseFormNumber(form.interestRate);
	const loanTermYears = parseFormInt(form.loanTermYears);
	const currentLoanBalance = parseFormNumber(form.currentLoanBalance);
	if (
		purchasePrice == null ||
		purchasePrice <= 0 ||
		isEmptyInput(form.purchaseDate) ||
		loanTermYears == null ||
		loanTermYears <= 0 ||
		interestPercent == null ||
		interestPercent < 0 ||
		currentLoanBalance == null ||
		currentLoanBalance <= 0
	) {
		return null;
	}
	return {
		currentLoanBalance,
		interestPercent,
		loanTermYears,
		purchaseDate: form.purchaseDate,
		purchasePrice,
	};
}

function assignEstimatedField(
	patch: AdvancedMortgagePatch,
	currentValue: string,
	estimated: boolean,
	nextValue: string,
	valueKey: "downPayment" | "remainingTermMonths" | "monthlyMortgagePayment",
): void {
	if (currentValue !== nextValue) {
		patch[valueKey] = nextValue;
	}
	if (!estimated) {
		patch[ADVANCED_ESTIMATED_FLAG[valueKey]] = true;
	}
}

export function mortgageAdvancedFieldsPatch(
	form: RealEstateFormValues,
	now = new Date(),
): AdvancedMortgagePatch {
	const drivers = requiredMortgageDrivers(form);
	if (!drivers) return {};

	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: drivers.interestPercent / 100,
		currentLoanBalance: drivers.currentLoanBalance,
		loanTermYears: drivers.loanTermYears,
		now,
		purchaseDate: drivers.purchaseDate,
		purchasePrice: drivers.purchasePrice,
	});

	const patch: AdvancedMortgagePatch = {};
	if (
		shouldAutofillAdvancedField(
			form.remainingTermMonths,
			form.remainingTermMonthsEstimated,
		) &&
		derived.remainingTermMonths != null
	) {
		assignEstimatedField(
			patch,
			form.remainingTermMonths,
			form.remainingTermMonthsEstimated,
			String(derived.remainingTermMonths),
			"remainingTermMonths",
		);
	}
	if (
		shouldAutofillAdvancedField(
			form.monthlyMortgagePayment,
			form.monthlyMortgagePaymentEstimated,
		) &&
		derived.monthlyMortgagePayment != null
	) {
		assignEstimatedField(
			patch,
			form.monthlyMortgagePayment,
			form.monthlyMortgagePaymentEstimated,
			String(roundMortgageDollars(derived.monthlyMortgagePayment)),
			"monthlyMortgagePayment",
		);
	}
	if (
		shouldAutofillAdvancedField(form.downPayment, form.downPaymentEstimated) &&
		derived.downPayment != null
	) {
		assignEstimatedField(
			patch,
			form.downPayment,
			form.downPaymentEstimated,
			String(roundMortgageDollars(derived.downPayment)),
			"downPayment",
		);
	}
	return patch;
}

export function applyRealEstateFormChange<K extends keyof RealEstateFormValues>(
	prev: RealEstateFormValues,
	key: K,
	value: RealEstateFormValues[K],
	now = new Date(),
): RealEstateFormValues {
	const next = { ...prev, [key]: value };
	if (key === "downPayment") next.downPaymentEstimated = false;
	if (key === "remainingTermMonths") next.remainingTermMonthsEstimated = false;
	if (key === "monthlyMortgagePayment") {
		next.monthlyMortgagePaymentEstimated = false;
	}
	const patch = mortgageAdvancedFieldsPatch(next, now);
	if (Object.keys(patch).length === 0) return next;
	return { ...next, ...patch };
}

export function canContinueRealEstateStep(
	stepId: RealEstateIntakeStepId,
	form: RealEstateFormValues,
): boolean {
	switch (stepId) {
		case "property":
			return (
				form.name.trim().length > 0 &&
				(parseFormNumber(form.currentEstimatedValue) ?? 0) > 0
			);
		case "mortgage":
			if (!form.hasMortgage) return true;
			return (
				(parseFormNumber(form.purchasePrice) ?? 0) > 0 &&
				form.purchaseDate.trim().length > 0 &&
				(parseFormInt(form.loanTermYears) ?? 0) > 0 &&
				(parseFormNumber(form.currentLoanBalance) ?? 0) > 0 &&
				(parseFormNumber(form.interestRate) ?? 0) > 0
			);
		case "income":
			if (!form.isRented) return true;
			return (parseFormNumber(form.monthlyRent) ?? 0) > 0;
		case "expenses":
		case "forecast":
		case "review":
			return true;
		default:
			return true;
	}
}

export function canSubmitRealEstateForm(form: RealEstateFormValues): boolean {
	return realEstateIntakeSteps
		.filter((step) => step.id !== "review")
		.every((step) => canContinueRealEstateStep(step.id, form));
}

export function computeRealEstatePreview(form: RealEstateFormValues) {
	const value = parseFormNumber(form.currentEstimatedValue) ?? 0;
	const loan = form.hasMortgage
		? (parseFormNumber(form.currentLoanBalance) ?? 0)
		: 0;
	const equity = value - loan;

	const rent = form.isRented ? (parseFormNumber(form.monthlyRent) ?? 0) : 0;
	const expenses = parseFormNumber(form.totalMonthlyExpenses) ?? 0;
	const mortgage = parseFormNumber(form.monthlyMortgagePayment) ?? 0;
	const monthlyCashFlow = rent - expenses - mortgage;
	const annualCashFlow = monthlyCashFlow * 12;

	const interestRate = parseFormNumber(form.interestRate);
	const vacancyRate = parseFormNumber(form.vacancyRate);
	const appreciationRate = parseFormNumber(form.appreciationRate);
	const expenseGrowthRate = parseFormNumber(form.expenseGrowthRate);
	const projection =
		value > 0
			? calculateRealEstateProjection(
					{
						currentEstimatedValue: value,
						currentLoanBalance: loan,
						purchaseDate: form.purchaseDate || undefined,
						monthlyRent: rent,
						otherMonthlyIncome: parseFormNumber(form.otherMonthlyIncome),
						vacancyRate:
							vacancyRate !== undefined ? vacancyRate / 100 : undefined,
						totalMonthlyExpenses: expenses,
						monthlyMortgagePayment: mortgage || undefined,
						monthlyPropertyTax: parseFormNumber(form.monthlyPropertyTax),
						monthlyInsurance: parseFormNumber(form.monthlyInsurance),
						monthlyHOA: parseFormNumber(form.monthlyHOA),
						monthlyUtilities: parseFormNumber(form.monthlyUtilities),
						monthlyMaintenance: parseFormNumber(form.monthlyMaintenance),
						monthlyManagement: parseFormNumber(form.monthlyManagement),
						monthlyOtherExpenses: parseFormNumber(form.monthlyOtherExpenses),
						interestRate:
							interestRate !== undefined ? interestRate / 100 : undefined,
						loanTermYears: parseFormInt(form.loanTermYears),
						remainingTermMonths: parseFormInt(form.remainingTermMonths),
						appreciationRate:
							appreciationRate !== undefined
								? appreciationRate / 100
								: undefined,
						expenseGrowthRate:
							expenseGrowthRate !== undefined
								? expenseGrowthRate / 100
								: undefined,
					},
					form.forecastScenario,
					5,
				)
			: [];

	const year5 = projection[4];
	return {
		equity,
		monthlyCashFlow,
		annualCashFlow,
		roi5yr: year5?.roiPercent ?? null,
	};
}

export function formatRealEstateRoiPercent(
	roiPercent: number | null,
	startingEquity: number,
): string {
	if (roiPercent !== null) return `${roiPercent.toFixed(1)}%`;
	if (startingEquity <= 0) return "N/A";
	return "—";
}
