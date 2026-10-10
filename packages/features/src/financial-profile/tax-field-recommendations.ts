import type { TaxProfileRecommendations } from "@moat/contracts";
import type { FieldConfig, FieldValue } from "./components";

function numberValue(value: FieldValue) {
	if (typeof value === "number") return value;
	if (typeof value === "string" && value.trim() !== "") {
		return Number(value.replace(/,/g, ""));
	}
	return 0;
}

function stringValue(value: FieldValue) {
	if (typeof value === "string") return value;
	if (typeof value === "number") {
		if (!Number.isFinite(value)) return "";
		return String(value);
	}
	return "";
}

function booleanValue(value: FieldValue) {
	return value === true;
}

function formatCurrency(value: number) {
	return new Intl.NumberFormat("en-US", {
		currency: "USD",
		maximumFractionDigits: 0,
		style: "currency",
	}).format(value);
}

function normalizeBracket(value: string) {
	const trimmed = value.trim().replace(/\s+/g, "");
	if (trimmed === "") return "";
	return trimmed.endsWith("%") ? trimmed : `${trimmed}%`;
}

function matchesNumber(value: FieldValue, recommended: number) {
	return numberValue(value) === recommended;
}

function matchesBracket(value: FieldValue, recommended: string) {
	return normalizeBracket(stringValue(value)) === normalizeBracket(recommended);
}

function matchesBoolean(value: FieldValue, recommended: boolean) {
	return booleanValue(value) === recommended;
}

function yesNo(value: boolean) {
	return value ? "Yes" : "No";
}

export function withTaxFieldRecommendations(
	fields: FieldConfig[],
	recommendations: TaxProfileRecommendations | undefined,
): FieldConfig[] {
	if (!recommendations) return fields;

	const hasIncomeInsight = recommendations.totalAnnualIncome > 0;

	return fields.map((field) => {
		if (field.name === "taxYear") {
			return {
				...field,
				recommendation: String(recommendations.taxYear),
				recommendationHelpText:
					"Taken from today's date as the current calendar tax year.",
				recommendedValue: recommendations.taxYear,
				matchesRecommendation: (value) =>
					matchesNumber(value, recommendations.taxYear),
			};
		}
		if (field.name === "estimatedFederalTaxBracket" && hasIncomeInsight) {
			return {
				...field,
				recommendation: recommendations.estimatedFederalTaxBracket,
				recommendationHelpText:
					"Looked up from IRS federal tax tables using income on your connected accounts, your filing status, and the current tax year.",
				recommendedValue: recommendations.estimatedFederalTaxBracket,
				matchesRecommendation: (value) =>
					matchesBracket(value, recommendations.estimatedFederalTaxBracket),
			};
		}
		if (field.name === "totalAnnualIncome" && hasIncomeInsight) {
			return {
				...field,
				recommendation: formatCurrency(recommendations.totalAnnualIncome),
				recommendationHelpText:
					"Calculated from income on your connected accounts over the last 12 months, then annualized.",
				recommendedValue: recommendations.totalAnnualIncome,
				matchesRecommendation: (value) =>
					matchesNumber(value, recommendations.totalAnnualIncome),
			};
		}
		if (field.name === "taxableIncomeEstimate" && hasIncomeInsight) {
			return {
				...field,
				recommendation: formatCurrency(recommendations.taxableIncomeEstimate),
				recommendationHelpText:
					"Calculated from income on your connected accounts, minus the IRS standard deduction for your filing status.",
				recommendedValue: recommendations.taxableIncomeEstimate,
				matchesRecommendation: (value) =>
					matchesNumber(value, recommendations.taxableIncomeEstimate),
			};
		}
		if (field.name === "selfEmployedIncome") {
			return {
				...field,
				recommendation: yesNo(recommendations.selfEmployedIncome),
				recommendationHelpText:
					"Detected from income on your connected accounts that looks like 1099, freelance, consulting, or business income.",
				recommendedValue: recommendations.selfEmployedIncome,
				matchesRecommendation: (value) =>
					matchesBoolean(value, recommendations.selfEmployedIncome),
			};
		}
		if (field.name === "rentalIncome") {
			return {
				...field,
				recommendation: yesNo(recommendations.rentalIncome),
				recommendationHelpText:
					"Detected from income on your connected accounts labeled as rental income.",
				recommendedValue: recommendations.rentalIncome,
				matchesRecommendation: (value) =>
					matchesBoolean(value, recommendations.rentalIncome),
			};
		}
		return field;
	});
}
