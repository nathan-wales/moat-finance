import type { RetirementLever, RetirementLeverType } from "@moat/contracts";

/**
 * When a lever writes the year loop versus when it is folded at t=0.
 * Relative deltas and employer match run after contribution setters so they
 * see the final 401(k) / return / spend figure.
 */
export type LeverApplyPhase = "standard" | "relative" | "employerMatch";

const RELATIVE_LEVER_TYPES = new Set<RetirementLeverType>([
	"return_rate_delta",
	"inflation_delta",
	"retirement_spending_change",
]);

const EMPLOYER_MATCH_LEVER_TYPES = new Set<RetirementLeverType>([
	"employer_match",
]);

export function leverApplyPhase(type: RetirementLeverType): LeverApplyPhase {
	if (RELATIVE_LEVER_TYPES.has(type)) return "relative";
	if (EMPLOYER_MATCH_LEVER_TYPES.has(type)) return "employerMatch";
	return "standard";
}

/**
 * The mutable slot a lever writes. Two enabled levers sharing a slot conflict;
 * `null` means the lever is additive and always composes with its neighbours.
 */
export function conflictFieldFor(lever: RetirementLever): string | null {
	switch (lever.type) {
		case "retire_earlier":
		case "retire_later":
		case "retire_at_age":
			return "retirementAge";
		case "stop_working_at_age":
			return "employmentEndsAtAge";
		case "spouse_retire_at_age":
			return "spouseRetirementAge";
		case "spouse_stops_working":
			return "spouseEmploymentEndsAtAge";
		case "max_401k":
			return "contributions401k";
		case "max_roth_ira":
		case "max_spousal_iras":
			return "contributionsIra";
		case "max_hsa":
			return "contributionsHsa";
		case "employer_match":
			return "employerMatch";
		case "stop_contributions_at_age":
			return "contributionsStopAge";
		case "retirement_spending_set":
		case "retirement_spending_stages":
			return "retirementSpendingSchedule";
		case "return_rate_set":
		case "portfolio_shift":
			return "returnRate";
		case "sequence_risk":
			return "sequenceRisk";
		case "social_security_claim_age":
			return "socialSecurityClaimAge";
		case "spouse_social_security_claim_age":
			return "spouseSocialSecurityClaimAge";
		case "social_security_haircut":
			return "socialSecurityHaircut";
		case "mortgage_payoff_early":
		case "mortgage_extra_payment":
		case "mortgage_payoff_cancel":
			return `mortgage:${lever.params.propertyId ?? "primary"}`;
		case "upsize_home":
		case "downsize_home":
		case "sell_primary_home":
		case "rent_instead":
			return "primaryResidence";
		case "sell_rental_property":
			return `propertySale:${lever.params.propertyId ?? "firstRental"}`;
		case "move_state":
			return "stateTaxRate";
		case "pre_medicare_coverage":
			return "preMedicareCoverage";
		case "life_insurance_change":
			return `lifePolicy:${lever.params.policyId ?? "added"}`;
		case "policy_expires":
			return `policyExpiry:${lever.params.policyId}`;
		case "ltc_policy_change":
			return "ltcCoverage";
		case "spouse_death":
			return "spouseDeath";
		case "roth_conversion":
			return "rothConversion";
		case "withdrawal_order":
			return "withdrawalOrder";
		default:
			return null;
	}
}
