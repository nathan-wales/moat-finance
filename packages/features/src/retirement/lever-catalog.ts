import type {
	RetirementLeverCategory,
	RetirementLeverType,
} from "@moat/contracts";

export type LeverCatalogEntry = {
	type: RetirementLeverType;
	category: RetirementLeverCategory;
	label: string;
	hiddenFromCatalog?: boolean;
};

export const LEVER_CATALOG: Record<RetirementLeverType, LeverCatalogEntry> = {
	retire_earlier: {
		type: "retire_earlier",
		category: "work",
		label: "Retire earlier",
	},
	retire_later: {
		type: "retire_later",
		category: "work",
		label: "Retire later",
	},
	retire_at_age: {
		type: "retire_at_age",
		category: "work",
		label: "Retire at an age",
	},
	stop_working_at_age: {
		type: "stop_working_at_age",
		category: "work",
		label: "Stop working at an age",
	},
	part_time_before_retirement: {
		type: "part_time_before_retirement",
		category: "work",
		label: "Work part-time",
	},
	spouse_retire_at_age: {
		type: "spouse_retire_at_age",
		category: "work",
		label: "Spouse retires at an age",
	},
	spouse_stops_working: {
		type: "spouse_stops_working",
		category: "work",
		label: "Spouse stops working",
	},
	income_change: {
		type: "income_change",
		category: "work",
		label: "Change income",
	},
	job_loss: { type: "job_loss", category: "work", label: "Job loss" },
	career_break: {
		type: "career_break",
		category: "work",
		label: "Career break",
	},
	annual_bonus: {
		type: "annual_bonus",
		category: "work",
		label: "Annual bonus",
	},
	side_business_income: {
		type: "side_business_income",
		category: "work",
		label: "Side business income",
	},
	rental_income_change: {
		type: "rental_income_change",
		category: "housing",
		label: "Change rental income",
	},
	contribution_change: {
		type: "contribution_change",
		category: "savings",
		label: "Change contributions",
	},
	max_401k: { type: "max_401k", category: "savings", label: "Max 401(k)" },
	max_roth_ira: {
		type: "max_roth_ira",
		category: "savings",
		label: "Max Roth IRA",
	},
	max_spousal_iras: {
		type: "max_spousal_iras",
		category: "savings",
		label: "Max spousal IRAs",
	},
	employer_match: {
		type: "employer_match",
		category: "savings",
		label: "Capture employer match",
	},
	max_hsa: { type: "max_hsa", category: "savings", label: "Max HSA" },
	taxable_investing: {
		type: "taxable_investing",
		category: "savings",
		label: "Taxable investing",
	},
	stop_contributions_at_age: {
		type: "stop_contributions_at_age",
		category: "savings",
		label: "Stop contributions",
	},
	retirement_spending_change: {
		type: "retirement_spending_change",
		category: "spending",
		label: "Change retirement spending",
	},
	retirement_spending_set: {
		type: "retirement_spending_set",
		category: "spending",
		label: "Set retirement spending",
	},
	retirement_spending_stages: {
		type: "retirement_spending_stages",
		category: "spending",
		label: "Spending stages",
	},
	spending_category_change: {
		type: "spending_category_change",
		category: "spending",
		label: "Spending mix change",
		hiddenFromCatalog: true,
	},
	return_rate_delta: {
		type: "return_rate_delta",
		category: "investments",
		label: "Change expected returns",
	},
	return_rate_set: {
		type: "return_rate_set",
		category: "investments",
		label: "Set expected returns",
	},
	inflation_delta: {
		type: "inflation_delta",
		category: "investments",
		label: "Change inflation",
	},
	portfolio_shift: {
		type: "portfolio_shift",
		category: "investments",
		label: "Shift portfolio",
	},
	market_crash: {
		type: "market_crash",
		category: "investments",
		label: "Market crash",
	},
	sequence_risk: {
		type: "sequence_risk",
		category: "investments",
		label: "Sequence risk",
	},
	social_security_claim_age: {
		type: "social_security_claim_age",
		category: "socialSecurity",
		label: "Social Security claim age",
	},
	spouse_social_security_claim_age: {
		type: "spouse_social_security_claim_age",
		category: "socialSecurity",
		label: "Spouse Social Security claim age",
	},
	social_security_haircut: {
		type: "social_security_haircut",
		category: "socialSecurity",
		label: "Social Security haircut",
	},
	mortgage_payoff_early: {
		type: "mortgage_payoff_early",
		category: "housing",
		label: "Pay off mortgage early",
	},
	mortgage_extra_payment: {
		type: "mortgage_extra_payment",
		category: "housing",
		label: "Extra mortgage payment",
	},
	mortgage_payoff_cancel: {
		type: "mortgage_payoff_cancel",
		category: "housing",
		label: "Keep the mortgage",
	},
	buy_home: { type: "buy_home", category: "housing", label: "Buy a home" },
	upsize_home: {
		type: "upsize_home",
		category: "housing",
		label: "Upsize home",
	},
	downsize_home: {
		type: "downsize_home",
		category: "housing",
		label: "Downsize home",
	},
	sell_primary_home: {
		type: "sell_primary_home",
		category: "housing",
		label: "Sell primary home",
	},
	rent_instead: {
		type: "rent_instead",
		category: "housing",
		label: "Rent instead",
	},
	add_rental_property: {
		type: "add_rental_property",
		category: "housing",
		label: "Add a rental",
	},
	sell_rental_property: {
		type: "sell_rental_property",
		category: "housing",
		label: "Sell a rental",
	},
	move_state: {
		type: "move_state",
		category: "taxes",
		label: "Move to another state",
	},
	add_dependent: {
		type: "add_dependent",
		category: "lifeEvents",
		label: "Add a dependent",
	},
	fund_college: {
		type: "fund_college",
		category: "lifeEvents",
		label: "Fund college",
	},
	charitable_gift: {
		type: "charitable_gift",
		category: "lifeEvents",
		label: "Charitable gift",
	},
	recurring_purchase: {
		type: "recurring_purchase",
		category: "lifeEvents",
		label: "Recurring purchase",
	},
	healthcare_cost_delta: {
		type: "healthcare_cost_delta",
		category: "healthcare",
		label: "Change healthcare costs",
	},
	pre_medicare_coverage: {
		type: "pre_medicare_coverage",
		category: "healthcare",
		label: "Pre-Medicare coverage",
	},
	long_term_care_event: {
		type: "long_term_care_event",
		category: "healthcare",
		label: "Long-term care event",
	},
	life_insurance_change: {
		type: "life_insurance_change",
		category: "insurance",
		label: "Change life insurance",
	},
	policy_expires: {
		type: "policy_expires",
		category: "insurance",
		label: "Policy expires",
	},
	ltc_policy_change: {
		type: "ltc_policy_change",
		category: "insurance",
		label: "Change LTC policy",
	},
	annuity_begins: {
		type: "annuity_begins",
		category: "insurance",
		label: "Annuity begins",
	},
	disability_event: {
		type: "disability_event",
		category: "insurance",
		label: "Disability event",
	},
	spouse_death: {
		type: "spouse_death",
		category: "lifeEvents",
		label: "Spouse death",
	},
	roth_conversion: {
		type: "roth_conversion",
		category: "taxes",
		label: "Roth conversion",
	},
	withdrawal_order: {
		type: "withdrawal_order",
		category: "taxes",
		label: "Withdrawal order",
	},
	custom_income: {
		type: "custom_income",
		category: "custom",
		label: "Custom income",
	},
	custom_expense: {
		type: "custom_expense",
		category: "custom",
		label: "Custom expense",
	},
	custom_one_time: {
		type: "custom_one_time",
		category: "custom",
		label: "One-time cash flow",
	},
};

export const LEVER_CATEGORY_LABELS: Record<RetirementLeverCategory, string> = {
	work: "Work & income",
	savings: "Savings",
	spending: "Spending",
	investments: "Investments",
	socialSecurity: "Social Security",
	housing: "Housing",
	lifeEvents: "Life events",
	healthcare: "Healthcare",
	insurance: "Insurance",
	taxes: "Taxes",
	custom: "Custom",
};

export function catalogEntryFor(type: RetirementLeverType): LeverCatalogEntry {
	return LEVER_CATALOG[type];
}

export { describeRetirementLever } from "./describe-lever";
