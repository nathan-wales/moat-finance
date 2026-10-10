// Required vs encouraged setup checklist for the retirement empty state.
//
// Required items block the projection UI. Encouraged items improve forecast
// accuracy but never gate the page. Copy lives here so Overview, Plan, and the
// context rail share one source of truth.

import type { RetirementMissingInput } from "@moat/contracts";
import type { RetirementBaseline } from "./build-baseline";
import { MINIMUM_HISTORY_MONTHS } from "./constants";
import { formatMoney } from "./format";

const ACCOUNTS_HREF = "/financial-profile#accounts";
const PLAN_EDIT_HREF = "/retirement?edit=plan";
const ENCOURAGED_HISTORY_MONTHS = 12;

export type RetirementSetupChecklistItem = RetirementMissingInput & {
	satisfied: boolean;
};

export function hasBirthYearForSetup(baseline: RetirementBaseline): boolean {
	return (
		baseline.plan.primaryBirthYear !== null ||
		baseline.context.currentAgeHint !== null
	);
}

export function buildRetirementSetupChecklist(
	baseline: RetirementBaseline,
): RetirementSetupChecklistItem[] {
	const { plan, summary, detected, inputs, context, spendingPlan } = baseline;
	const monthCount = summary.trailingMonthCount;
	const hasInvestable = summary.investmentAccountCount > 0;
	const hasMinHistory = monthCount >= MINIMUM_HISTORY_MONTHS;
	const hasBirthYear = hasBirthYearForSetup(baseline);

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

	const items: RetirementSetupChecklistItem[] = [
		{
			id: "investment_accounts",
			label: "Investment or retirement account",
			description:
				"We project from brokerage, 401(k), and IRA balances. Checking and savings do not count.",
			urgency: "required",
			actionKind: "link",
			actionLabel: "Connect investment accounts",
			actionHref: ACCOUNTS_HREF,
			satisfied: hasInvestable,
		},
		{
			id: "transaction_history_minimum",
			label: "Transaction history",
			description: historyMinimumDescription(monthCount),
			urgency: "required",
			actionKind: "link",
			actionLabel: "Connect more accounts",
			actionHref: ACCOUNTS_HREF,
			satisfied: hasMinHistory,
		},
		{
			id: "birth_year",
			label: "Birth year",
			description: "Sets your current age and how long the plan has to run.",
			urgency: "required",
			actionKind: "birth_year",
			actionLabel: "Save birth year",
			actionHref: PLAN_EDIT_HREF,
			satisfied: hasBirthYear,
		},
		{
			id: "social_security_estimate",
			label: "Social Security at full retirement age",
			description: socialSecurityDescription(
				plan.socialSecurityMonthlyAtFra,
				inputs.socialSecurity.monthlyAtFra,
			),
			urgency: "encouraged",
			actionKind: "social_security",
			actionLabel: "Save estimate",
			actionHref: PLAN_EDIT_HREF,
			satisfied: plan.socialSecurityMonthlyAtFra !== null,
		},
	];

	if (hasMinHistory && monthCount < ENCOURAGED_HISTORY_MONTHS) {
		items.push({
			id: "transaction_history_recommended",
			label: "Longer transaction history",
			description: `You have ${monthCount} of ${ENCOURAGED_HISTORY_MONTHS} months. A fuller year of spending makes the baseline more trustworthy.`,
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Connect more accounts",
			actionHref: ACCOUNTS_HREF,
			satisfied: false,
		});
	}

	items.push(
		{
			id: "income_verified",
			label: "Income categories",
			description:
				"Take-home is inferred from categorized transactions. If paychecks are missing or miscategorized, the savings rate is wrong.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Review income categories",
			actionHref: "/transactions",
			satisfied:
				summary.monthlyIncome > 0 && monthCount >= MINIMUM_HISTORY_MONTHS,
		},
		{
			id: "spending_classified",
			label: "Spending categories",
			description:
				"Categorize expenses so retirement living costs reflect what you actually spend.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Categorize expenses",
			actionHref: "/transactions",
			satisfied: spendingPlan.categories.some(
				(category) => category.isUserEdited,
			),
		},
		{
			id: "retirement_contributions",
			label: "Retirement contributions",
			description:
				"Ongoing 401(k), IRA, or HSA contributions change how fast balances grow before you retire.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Add contributions",
			actionHref: "/investments",
			satisfied:
				detected.has401k ||
				detected.hasRothIra ||
				detected.hasHsa ||
				summary.monthlyContributions > 0,
		},
		{
			id: "mortgage_current",
			label: "Mortgage terms",
			description:
				"Interest rate and payment let us model when housing debt drops off.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Review liabilities",
			actionHref: "/financial-profile#liabilities",
			satisfied: mortgageDataComplete,
		},
		{
			id: "insurance_policies",
			label: "Insurance policies",
			description:
				"Life, disability, and long-term care coverage change the plan under stress.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Add policies",
			actionHref: "/financial-profile#insurance",
			satisfied: summary.insurancePolicyCount > 0,
		},
		{
			id: "tax_profile",
			label: "Tax profile",
			description:
				"Filing status and state tax rate refine lifetime tax estimates.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Review tax profile",
			actionHref: "/financial-profile#taxes",
			satisfied: context.filingStatus.length > 0 && inputs.stateTaxRate > 0,
		},
	);

	if (summary.localOnlyPolicyCount > 0) {
		items.push({
			id: "local_policies_excluded",
			label: "Local-only insurance",
			description:
				"Some policies are stored only on this device and are not included in the projection.",
			urgency: "encouraged",
			actionKind: "link",
			actionLabel: "Review insurance",
			actionHref: "/financial-profile#insurance",
			satisfied: false,
		});
	}

	if (plan.hasSpouse) {
		items.push(
			{
				id: "spouse_longevity",
				label: "Spouse planning horizon",
				description:
					"How long the plan should cover your spouse after retirement.",
				urgency: "encouraged",
				actionKind: "link",
				actionLabel: "Review assumption",
				actionHref: PLAN_EDIT_HREF,
				satisfied: plan.spouseLongevityAge !== null,
			},
			{
				id: "spouse_social_security",
				label: "Spouse Social Security estimate",
				description:
					"A stated benefit is more accurate than estimating from household income.",
				urgency: "encouraged",
				actionKind: "link",
				actionLabel: "Enter estimate",
				actionHref: PLAN_EDIT_HREF,
				satisfied: plan.spouseSocialSecurityMonthlyAtFra !== null,
			},
		);
	}

	return items;
}

/** Unsatisfied checklist rows for the API / empty-state UI. */
export function missingInputsFromChecklist(
	items: RetirementSetupChecklistItem[],
): RetirementMissingInput[] {
	return items
		.filter((item) => !item.satisfied)
		.map(({ satisfied: _satisfied, ...input }) => input);
}

function historyMinimumDescription(monthCount: number): string {
	if (monthCount <= 0) {
		return "At least one month of transactions is needed to estimate spending.";
	}
	return `You have ${monthCount} of ${MINIMUM_HISTORY_MONTHS} months. A few more months of transactions will make the spending baseline trustworthy.`;
}

function socialSecurityDescription(
	userEntered: number | null,
	estimatedMonthly: number,
): string {
	if (userEntered !== null) {
		return `Using your estimate of ${formatMoney(userEntered)}/mo at full retirement age.`;
	}
	if (estimatedMonthly > 0) {
		return `We're estimating ${formatMoney(estimatedMonthly)}/mo from your income. Your SSA statement is more accurate.`;
	}
	return "Enter the monthly amount from your Social Security statement at full retirement age.";
}
