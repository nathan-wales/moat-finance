// Plan confidence scores the *inputs*, not the outcome.
//
// Retirement confidence answers "how likely is this to work"; plan confidence
// answers "how much should you trust the answer". Conflating the two is the most
// common way these tools mislead people, so they are computed separately, from
// different data, and are never allowed to be the same number by construction.

import type {
	RetirementPlanConfidence,
	RetirementPlanConfidenceSignal,
} from "@moat/contracts";
import type { RetirementBaseline } from "./build-baseline";
import { MINIMUM_HISTORY_MONTHS } from "./constants";

const PLAN_EDIT_HREF = "/retirement?edit=plan";

export function scorePlanConfidence(
	baseline: RetirementBaseline,
): RetirementPlanConfidence {
	const { plan, summary, detected, inputs, context } = baseline;

	const mortgagedProperties = baseline.properties.filter(
		(property) => property.currentLoanBalance > 0,
	);
	const mortgageDataComplete =
		mortgagedProperties.length === 0 ||
		mortgagedProperties.every(
			(property) =>
				property.interestRate !== null &&
				property.monthlyMortgagePayment !== null &&
				property.monthlyMortgagePayment > 0,
		);

	const signals: RetirementPlanConfidenceSignal[] = [
		{
			id: "transaction_history",
			label: historyLabel(summary.trailingMonthCount),
			satisfied: summary.trailingMonthCount >= 12,
			weight: 3,
			actionLabel: "Connect more accounts",
			actionHref: "/financial-profile#accounts",
		},
		{
			id: "investment_accounts",
			label: "Investment accounts connected",
			satisfied: summary.investmentAccountCount > 0,
			weight: 3,
			actionLabel: "Add investment accounts",
			actionHref: "/financial-profile#accounts",
		},
		{
			id: "income_verified",
			label: "Income categories checked",
			satisfied:
				summary.monthlyIncome > 0 &&
				summary.trailingMonthCount >= MINIMUM_HISTORY_MONTHS,
			weight: 2,
			actionLabel: "Review income categories",
			actionHref: "/insights",
		},
		{
			id: "retirement_contributions",
			label: "Retirement contributions detected",
			satisfied:
				detected.has401k ||
				detected.hasRothIra ||
				detected.hasHsa ||
				summary.monthlyContributions > 0,
			weight: 2,
			actionLabel: "Add contributions",
			actionHref: "/investments",
		},
		{
			id: "mortgage_current",
			label: "Mortgage terms on file",
			satisfied: mortgageDataComplete,
			weight: 1,
			actionLabel: "Review liabilities",
			actionHref: "/financial-profile#liabilities",
		},
		{
			id: "insurance_policies",
			label: "Insurance policies on file",
			satisfied: summary.insurancePolicyCount > 0,
			weight: 1,
			actionLabel: "Add policies",
			actionHref: "/financial-profile#insurance",
		},
		{
			id: "birth_year",
			label: "Date of birth entered",
			satisfied:
				plan.primaryBirthYear !== null || context.currentAgeHint !== null,
			weight: 2,
			actionLabel: "Set birth year",
			actionHref: PLAN_EDIT_HREF,
		},
		{
			id: "social_security_estimate",
			label: "Social Security estimate entered",
			satisfied: plan.socialSecurityMonthlyAtFra !== null,
			weight: 2,
			actionLabel: "Enter estimate",
			actionHref: PLAN_EDIT_HREF,
		},
		{
			id: "tax_profile",
			label: "Tax profile complete",
			satisfied: context.filingStatus.length > 0 && inputs.stateTaxRate > 0,
			weight: 1,
			actionLabel: "Review tax profile",
			actionHref: "/financial-profile#taxes",
		},
		{
			id: "spending_classified",
			label: "Retirement spending reviewed",
			satisfied: baseline.spendingPlan.categories.some(
				(category) => category.isUserEdited,
			),
			weight: 1,
			actionLabel: "Review spending",
			actionHref: "/retirement?section=cash-flow",
		},
	];

	if (summary.localOnlyPolicyCount > 0) {
		signals.push({
			id: "local_policies_excluded",
			label:
				"Some policies are stored locally and aren't included in this projection",
			satisfied: false,
			weight: 2,
			actionLabel: "Review insurance",
			actionHref: "/financial-profile#insurance",
		});
	}

	if (plan.hasSpouse) {
		signals.push(
			{
				id: "spouse_longevity",
				label: "Spouse longevity assumption reviewed",
				satisfied: plan.spouseLongevityAge !== null,
				weight: 1,
				actionLabel: "Review the assumption",
				actionHref: PLAN_EDIT_HREF,
			},
			{
				id: "spouse_social_security",
				label: "Spouse Social Security estimate entered",
				satisfied: plan.spouseSocialSecurityMonthlyAtFra !== null,
				weight: 1,
				actionLabel: "Enter the estimate",
				actionHref: PLAN_EDIT_HREF,
			},
		);
	}

	const totalWeight = signals.reduce((sum, signal) => sum + signal.weight, 0);
	const satisfiedWeight = signals.reduce(
		(sum, signal) => sum + (signal.satisfied ? signal.weight : 0),
		0,
	);

	return {
		score: totalWeight === 0 ? 0 : satisfiedWeight / totalWeight,
		// Unsatisfied signals sort first: the actionable rows are the point.
		signals: signals.sort((a, b) => {
			if (a.satisfied !== b.satisfied) return a.satisfied ? 1 : -1;
			return b.weight - a.weight;
		}),
	};
}

function historyLabel(monthCount: number): string {
	if (monthCount >= 24) {
		const years = Math.floor(monthCount / 12);
		return `${years} years of transaction history`;
	}
	if (monthCount === 1) return "1 month of transaction history";
	return `${monthCount} months of transaction history`;
}
