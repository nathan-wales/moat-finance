import type {
	FinancialProfileData,
	TaxProfile,
	TaxProfileRecommendations,
} from "@moat/contracts";
import {
	getFederalTaxTables,
	getTaxYear,
	type RetirementFilingStatus,
} from "../federal-rules";

export const TAX_INCOME_LOOKBACK_MONTHS = 12;

const NO_STATE_INCOME_TAX_LOCATIONS = [
	"alaska",
	"florida",
	"nevada",
	"new hampshire",
	"south dakota",
	"tennessee",
	"texas",
	"washington",
	"wyoming",
];

export type TaxIncomeTransaction = {
	amount: number;
	date: Date;
	category: string;
	description: string | null;
	merchantName: string | null;
};

export function taxIncomeLookbackStartDate(now: Date = new Date()): Date {
	const date = new Date(now);
	date.setMonth(date.getMonth() - (TAX_INCOME_LOOKBACK_MONTHS - 1));
	date.setDate(1);
	date.setHours(0, 0, 0, 0);
	return date;
}

export function stripTaxProfileRecommendations(
	data: FinancialProfileData,
): FinancialProfileData {
	if (!data.taxProfileRecommendations) return data;
	const { taxProfileRecommendations: _recommendations, ...rest } = data;
	return rest;
}

export function applyTaxProfileDefaults(input: {
	taxProfile: TaxProfile;
	location: string;
	incomeTransactions: TaxIncomeTransaction[];
	now?: Date;
}): {
	taxProfile: TaxProfile;
	recommendations: TaxProfileRecommendations;
} {
	const recommendedTaxYear = getTaxYear(input.now ?? new Date());
	const filingStatus = toRetirementFilingStatus(input.taxProfile.filingStatus);
	const totalAnnualIncome = estimateAnnualIncome(input.incomeTransactions);
	const tables = getFederalTaxTables(recommendedTaxYear);
	const taxableIncomeEstimate = Math.max(
		0,
		totalAnnualIncome - tables.standardDeduction[filingStatus],
	);
	const estimatedFederalTaxBracket = getFederalBracket(
		taxableIncomeEstimate,
		filingStatus,
		recommendedTaxYear,
	);
	const selfEmployedIncome = hasSelfEmployedIncome(input.incomeTransactions);
	const rentalIncome = hasRentalIncome(input.incomeTransactions);

	const recommendations: TaxProfileRecommendations = {
		taxYear: recommendedTaxYear,
		estimatedFederalTaxBracket,
		totalAnnualIncome,
		taxableIncomeEstimate,
		selfEmployedIncome,
		rentalIncome,
	};

	const estimatesUnset =
		input.taxProfile.totalAnnualIncome <= 0 &&
		input.taxProfile.taxableIncomeEstimate <= 0 &&
		input.taxProfile.estimatedFederalTaxBracket.trim() === "";

	return {
		taxProfile: {
			...input.taxProfile,
			estimatedFederalTaxBracket:
				input.taxProfile.estimatedFederalTaxBracket.trim() ||
				estimatedFederalTaxBracket,
			estimatedStateTaxRate:
				input.taxProfile.estimatedStateTaxRate ||
				getDefaultStateTaxRate(input.location),
			totalAnnualIncome:
				input.taxProfile.totalAnnualIncome > 0
					? input.taxProfile.totalAnnualIncome
					: totalAnnualIncome,
			taxableIncomeEstimate:
				input.taxProfile.taxableIncomeEstimate > 0
					? input.taxProfile.taxableIncomeEstimate
					: taxableIncomeEstimate,
			selfEmployedIncome: estimatesUnset
				? selfEmployedIncome
				: input.taxProfile.selfEmployedIncome,
			rentalIncome: estimatesUnset
				? rentalIncome
				: input.taxProfile.rentalIncome,
		},
		recommendations,
	};
}

function toRetirementFilingStatus(
	filingStatus: TaxProfile["filingStatus"],
): RetirementFilingStatus {
	if (filingStatus === "Married filing jointly") return "marriedJoint";
	if (filingStatus === "Married filing separately") return "marriedSeparate";
	if (filingStatus === "Head of household") return "headOfHousehold";
	return "single";
}

function estimateAnnualIncome(transactions: TaxIncomeTransaction[]) {
	if (transactions.length === 0) return 0;

	const months = new Set<string>();
	const totalIncome = transactions.reduce((sum, transaction) => {
		months.add(transaction.date.toISOString().slice(0, 7));
		return sum + transaction.amount;
	}, 0);
	const observedMonths = Math.max(
		1,
		Math.min(months.size, TAX_INCOME_LOOKBACK_MONTHS),
	);

	return Math.round((totalIncome / observedMonths) * 12);
}

function hasSelfEmployedIncome(transactions: TaxIncomeTransaction[]) {
	return transactions.some((transaction) =>
		containsAny(transactionText(transaction), [
			"1099",
			"business",
			"contract",
			"consulting",
			"freelance",
			"side income",
		]),
	);
}

function hasRentalIncome(transactions: TaxIncomeTransaction[]) {
	return transactions.some((transaction) =>
		containsAny(transactionText(transaction), ["rental income", "rent income"]),
	);
}

function transactionText(transaction: TaxIncomeTransaction) {
	return [
		transaction.category,
		transaction.description,
		transaction.merchantName,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

function containsAny(value: string, terms: string[]) {
	return terms.some((term) => value.includes(term));
}

function getFederalBracket(
	taxableIncome: number,
	filingStatus: RetirementFilingStatus,
	taxYear: number,
) {
	const brackets = getFederalTaxTables(taxYear).brackets[filingStatus];
	for (const bracket of brackets) {
		if (taxableIncome <= bracket.upTo) {
			return `${Math.round(bracket.rate * 100)}%`;
		}
	}
	return "";
}

function getDefaultStateTaxRate(location: string) {
	const normalizedLocation = location.toLowerCase();
	return NO_STATE_INCOME_TAX_LOCATIONS.some((name) =>
		normalizedLocation.includes(name),
	)
		? "0%"
		: "";
}
