// Personalized What If cards.
//
// Every rule is deterministic and suppressed when it does not apply, and every
// detail line is prefilled from the user's real data — the current contribution
// rate, the real amortization payoff date, the active forecast return. That is
// what makes the grid feel like Moat rather than a generic calculator.

import type {
	RetirementSuggestedLever,
	RetirementTaxTreatment,
} from "@moat/contracts";
import {
	getEmployeeDeferralLimit,
	getIraContributionLimit,
} from "../federal-rules";
import type { RetirementBaseline } from "./build-baseline";
import {
	ASSUMED_EMPLOYER_MATCH_PERCENT,
	ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY,
	SOCIAL_SECURITY_LATEST_CLAIM_AGE,
} from "./constants";
import { formatMoney, formatPercent, formatYears } from "./format";

/** Equity above which downsizing is worth suggesting. */
const DOWNSIZE_EQUITY_THRESHOLD = 200_000;
const DOWNSIZE_AGE = 70;
/** Cap on the "retire N years earlier" suggestion, so it stays credible. */
const MAX_EARLIER_YEARS = 5;

const money = formatMoney;
const percent = formatPercent;

export type SuggestLeversInput = {
	baseline: RetirementBaseline;
	/** From `solveEarliestRetirementAge`; null when no age in range funds. */
	earliestSustainableAge: number | null;
};

export function suggestLevers(
	input: SuggestLeversInput,
): RetirementSuggestedLever[] {
	const { baseline, earliestSustainableAge } = input;
	const { inputs, plan, detected } = baseline;
	const suggestions: RetirementSuggestedLever[] = [];

	// ─── Retire earlier ──────────────────────────────────────────────────────
	if (
		earliestSustainableAge !== null &&
		earliestSustainableAge < plan.targetRetirementAge
	) {
		const years = Math.min(
			MAX_EARLIER_YEARS,
			plan.targetRetirementAge - earliestSustainableAge,
		);
		suggestions.push({
			id: "retire_earlier",
			title: `Retire ${formatYears(years)} earlier`,
			detail: `Age ${plan.targetRetirementAge} → ${plan.targetRetirementAge - years}`,
			secondaryDetail: `Your projection funds retirement from age ${earliestSustainableAge}.`,
			category: "work",
			lever: { type: "retire_earlier", params: { years } },
			estimatedImpactScore: 90,
			isPersonalized: true,
		});
	}

	// ─── Max the 401(k) ──────────────────────────────────────────────────────
	const limit401k = getEmployeeDeferralLimit({
		taxYear: inputs.taxYear,
		age: inputs.currentAge,
		autoApplyCatchUp: true,
	}).amount;
	if (detected.annual401kContribution < limit401k) {
		suggestions.push({
			id: "max_401k",
			title: "Max your 401(k)",
			detail: `+${money(limit401k - detected.annual401kContribution)}/year of contributions`,
			secondaryDetail: `You're currently at ${money(detected.annual401kContribution)}`,
			category: "savings",
			lever: { type: "max_401k", params: { includeCatchUp: true } },
			estimatedImpactScore: 80,
			isPersonalized: detected.has401k,
		});
	}

	// ─── Max the IRA(s) ──────────────────────────────────────────────────────
	const iraLimit = getIraContributionLimit({
		taxYear: inputs.taxYear,
		age: inputs.currentAge,
		autoApplyCatchUp: true,
	}).amount;
	const iraTarget = plan.hasSpouse
		? iraLimit +
			getIraContributionLimit({
				taxYear: inputs.taxYear,
				age: plan.spouseCurrentAge ?? inputs.currentAge,
				autoApplyCatchUp: true,
			}).amount
		: iraLimit;
	if (detected.annualRothContribution < iraTarget) {
		suggestions.push({
			id: plan.hasSpouse ? "max_spousal_iras" : "max_roth_ira",
			title: plan.hasSpouse ? "Max both Roth IRAs" : "Max your Roth IRA",
			detail: `+${money(iraTarget - detected.annualRothContribution)}/year of contributions`,
			secondaryDetail: `You're currently at ${money(detected.annualRothContribution)}`,
			category: "savings",
			lever: plan.hasSpouse
				? { type: "max_spousal_iras", params: { includeCatchUp: true } }
				: { type: "max_roth_ira", params: { includeCatchUp: true } },
			estimatedImpactScore: 70,
			isPersonalized: detected.hasRothIra,
		});
	}

	// ─── Employer match ──────────────────────────────────────────────────────
	if (detected.has401k && detected.employerMatchUnmodeled) {
		suggestions.push({
			id: "employer_match",
			title: "Capture your full employer match",
			detail: `Assumes ${percent(ASSUMED_EMPLOYER_MATCH_PERCENT)} of the first ${percent(ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY)} of pay`,
			secondaryDetail:
				"We don't have your plan's match on file, so this is an assumption you can edit.",
			category: "savings",
			lever: {
				type: "employer_match",
				params: {
					matchPercent: ASSUMED_EMPLOYER_MATCH_PERCENT,
					upToPercentOfSalary: ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY,
				},
			},
			estimatedImpactScore: 75,
			isPersonalized: true,
		});
	}

	// ─── Mortgage payoff ─────────────────────────────────────────────────────
	const mortgaged = baseline.properties.find(
		(property) => property.currentLoanBalance > 0,
	);
	if (mortgaged && baseline.mortgagePayoffAge !== null) {
		const payoffAge = Math.max(
			inputs.currentAge + 1,
			baseline.mortgagePayoffAge - 5,
		);
		suggestions.push({
			id: "mortgage_payoff_early",
			title: "Pay off your mortgage early",
			detail: `Current payoff: age ${baseline.mortgagePayoffAge}`,
			secondaryDetail: `${money(mortgaged.currentLoanBalance)} remaining on ${mortgaged.name}`,
			category: "housing",
			lever: {
				type: "mortgage_payoff_early",
				params: { propertyId: mortgaged.id, atAge: payoffAge },
			},
			estimatedImpactScore: 55,
			isPersonalized: true,
		});
	}

	// ─── Delay Social Security ───────────────────────────────────────────────
	if (plan.socialSecurityClaimAge < SOCIAL_SECURITY_LATEST_CLAIM_AGE) {
		suggestions.push({
			id: "social_security_claim_age",
			title: "Delay Social Security",
			detail: `${plan.socialSecurityClaimAge} → ${SOCIAL_SECURITY_LATEST_CLAIM_AGE}`,
			secondaryDetail:
				"Each year of delay past full retirement age raises the benefit about 8%.",
			category: "socialSecurity",
			lever: {
				type: "social_security_claim_age",
				params: { age: SOCIAL_SECURITY_LATEST_CLAIM_AGE },
			},
			estimatedImpactScore: 65,
			isPersonalized: true,
		});
	}

	// ─── Downsize ────────────────────────────────────────────────────────────
	if (baseline.primaryResidenceEquity > DOWNSIZE_EQUITY_THRESHOLD) {
		const primary = baseline.properties.find(
			(property) => property.isPrimaryResidence,
		);
		const newPrice = Math.round((primary?.currentEstimatedValue ?? 0) * 0.6);
		suggestions.push({
			id: "downsize_home",
			title: `Downsize at ${DOWNSIZE_AGE}`,
			detail: `${money(baseline.primaryResidenceEquity)} of equity today`,
			secondaryDetail: `Assumes a ${money(newPrice)} replacement home`,
			category: "housing",
			lever: {
				type: "downsize_home",
				params: { atAge: DOWNSIZE_AGE, newHomePrice: newPrice },
			},
			estimatedImpactScore: 50,
			isPersonalized: true,
		});
	}

	// ─── Spouse stops working ────────────────────────────────────────────────
	if (
		plan.hasSpouse &&
		plan.spouseCurrentAge !== null &&
		inputs.spouseEmploymentEndsAtAge !== null &&
		plan.spouseCurrentAge < inputs.spouseEmploymentEndsAtAge &&
		inputs.annualSpouseEmploymentIncome > 0
	) {
		suggestions.push({
			id: "spouse_stops_working",
			title: "Spouse stops working",
			detail: `From age ${plan.spouseCurrentAge}, their wages end and household spending stays put`,
			secondaryDetail: `Currently modeled until age ${inputs.spouseEmploymentEndsAtAge}`,
			category: "work",
			lever: {
				type: "spouse_stops_working",
				params: { atAge: plan.spouseCurrentAge },
			},
			estimatedImpactScore: 50,
			isPersonalized: true,
		});
	}

	// ─── Spouse retires later ────────────────────────────────────────────────
	if (
		plan.hasSpouse &&
		plan.spouseCurrentAge !== null &&
		inputs.spouseEmploymentEndsAtAge !== null &&
		plan.spouseCurrentAge < inputs.spouseEmploymentEndsAtAge
	) {
		const target = inputs.spouseEmploymentEndsAtAge + 3;
		suggestions.push({
			id: "spouse_retire_at_age",
			title: "Spouse retires later",
			detail: `${inputs.spouseEmploymentEndsAtAge} → ${target}`,
			secondaryDetail: null,
			category: "work",
			lever: { type: "spouse_retire_at_age", params: { age: target } },
			estimatedImpactScore: 60,
			isPersonalized: true,
		});
	}

	// ─── Always-on framing cards ─────────────────────────────────────────────
	suggestions.push({
		id: "spend_more",
		title: "Spend $1,000 more a month in retirement",
		detail: `${money(baseline.summary.expectedRetirementMonthlySpending)} → ${money(baseline.summary.expectedRetirementMonthlySpending + 1000)}`,
		secondaryDetail: null,
		category: "spending",
		lever: {
			type: "retirement_spending_change",
			params: { monthlyDelta: 1000 },
		},
		estimatedImpactScore: 40,
		isPersonalized: false,
	});

	suggestions.push({
		id: "returns_lower",
		title: "Market returns 1% lower than expected",
		detail: `${percent(inputs.returnRate)} → ${percent(inputs.returnRate - 0.01)}`,
		secondaryDetail: `From ${baseline.scenarioRatesSource}`,
		category: "investments",
		lever: { type: "return_rate_delta", params: { delta: -0.01 } },
		estimatedImpactScore: 35,
		isPersonalized: false,
	});

	// ─── Invest the surplus ──────────────────────────────────────────────────
	const monthlySurplus = baseline.trailing.avgNetGain;
	if (monthlySurplus > 250 && !detected.hasTaxableBrokerage) {
		const rounded = Math.round(monthlySurplus / 100) * 100;
		suggestions.push({
			id: "taxable_investing",
			title: "Invest your monthly surplus",
			detail: `${money(rounded)}/month into a brokerage account`,
			secondaryDetail: `Based on your trailing ${baseline.trailing.monthCount}-month net gain`,
			category: "savings",
			lever: {
				type: "taxable_investing",
				params: { monthlyAmount: rounded },
			},
			estimatedImpactScore: 45,
			isPersonalized: true,
		});
	}

	// ─── Withdrawal order ────────────────────────────────────────────────────
	const hasTaxDeferredHeavyMix =
		inputs.balances.taxDeferred >
		inputs.balances.taxable + inputs.balances.taxFree;
	if (hasTaxDeferredHeavyMix) {
		const order: RetirementTaxTreatment[] = [
			"taxable",
			"taxDeferred",
			"taxFree",
		];
		suggestions.push({
			id: "roth_conversion",
			title: "Convert to Roth before RMDs",
			detail: `Fill the 12% bracket from ${plan.targetRetirementAge} to ${inputs.rmdStartAge - 1}`,
			secondaryDetail: `${money(inputs.balances.taxDeferred)} sits in tax-deferred accounts`,
			category: "taxes",
			lever: {
				type: "roth_conversion",
				params: {
					fromAge: plan.targetRetirementAge,
					toAge: Math.max(plan.targetRetirementAge, inputs.rmdStartAge - 1),
					fillToBracket: 0.12,
				},
			},
			estimatedImpactScore: 58,
			isPersonalized: true,
		});
		// Ordering matters more when the mix is lopsided, so surface it too.
		if (inputs.withdrawalOrder.join() !== order.join()) {
			suggestions.push({
				id: "withdrawal_order",
				title: "Change your withdrawal order",
				detail: "Taxable → tax-deferred → tax-free",
				secondaryDetail: null,
				category: "taxes",
				lever: { type: "withdrawal_order", params: { order } },
				estimatedImpactScore: 30,
				isPersonalized: true,
			});
		}
	}

	return suggestions.sort(
		(a, b) => b.estimatedImpactScore - a.estimatedImpactScore,
	);
}
