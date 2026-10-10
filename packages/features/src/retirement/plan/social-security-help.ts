import { estimateFraBenefitFromIncome } from "@moat/domain/retirement-social-security";
import { formatExactMoney } from "../format";

const TYPICAL_PRIMARY_FRA_MONTHLY = 2_400;
const TYPICAL_SPOUSE_FRA_MONTHLY = 1_800;

type SocialSecurityPerson = "primary" | "spouse";
type SocialSecurityEarningsTier = "lower" | "typical" | "higher" | "maximum";

export function socialSecurityFraHelpText(input: {
	person: SocialSecurityPerson;
	annualIncome: number;
}): string {
	const typicalMonthly =
		input.person === "spouse"
			? TYPICAL_SPOUSE_FRA_MONTHLY
			: TYPICAL_PRIMARY_FRA_MONTHLY;
	const typicalLabel = `${formatExactMoney(typicalMonthly)}/mo`;
	const explanation =
		"The monthly amount you'd receive at full retirement age, usually 67. Find it on your Social Security statement. The plan then raises or lowers it if you claim earlier or later.";

	if (input.annualIncome <= 0) {
		return `${explanation} If you don't have a statement, ${typicalLabel} is a typical starting point.`;
	}

	const estimatedMonthly = roundToHundred(
		estimateFraBenefitFromIncome(input.annualIncome),
	);
	const estimatedLabel = `${formatExactMoney(estimatedMonthly)}/mo`;
	const tier = earningsTierForMonthlyBenefit(estimatedMonthly);
	const incomePhrase =
		input.person === "spouse" ? "your spouse's income" : "your income";

	if (tier === "typical") {
		return `${explanation} Based on ${incomePhrase}, about ${estimatedLabel} is a reasonable estimate.`;
	}

	return `${explanation} ${typicalLabel} is typical; based on ${incomePhrase} you'd likely fall in ${tierPhrase(tier)} — about ${estimatedLabel}.`;
}

function earningsTierForMonthlyBenefit(
	monthlyAtFra: number,
): SocialSecurityEarningsTier {
	if (monthlyAtFra < 1_800) return "lower";
	if (monthlyAtFra < 2_800) return "typical";
	if (monthlyAtFra < 3_800) return "higher";
	return "maximum";
}

function tierPhrase(
	tier: Exclude<SocialSecurityEarningsTier, "typical">,
): string {
	if (tier === "lower") return "the lower-earner range";
	if (tier === "higher") return "the higher-earner range";
	return "near the maximum benefit";
}

function roundToHundred(value: number): number {
	return Math.round(value / 100) * 100;
}
