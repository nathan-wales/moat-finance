import type {
	ContributionPolicy,
	PersonContributionPolicy,
} from "@moat/contracts";
import { emptyPersonContributionPolicy } from "@moat/contracts";
import { ASSUMED_EMPLOYER_MATCH_PERCENT } from "../constants";
import { grossUpNetIncome } from "./gross-up";
import type { DefaultSignals, DetectedAccountSignal } from "./signals";

/**
 * The match no household has on file. Real plans cluster around a tiered
 * formula, so the shape is right even when the numbers are not — which is
 * exactly why it ships as `assumed` / `low` with a rationale telling the user
 * to check their plan documents.
 */
function assumedMatchTiers() {
	return [
		{ matchRate: 1, upToPercent: 0.03 },
		{ matchRate: ASSUMED_EMPLOYER_MATCH_PERCENT, upToPercent: 0.02 },
	];
}

function annualContributionFor(
	accounts: DetectedAccountSignal[],
	kind: DetectedAccountSignal["kind"],
): number | null {
	const matching = accounts.filter((account) => account.kind === kind);
	if (matching.length === 0) return null;
	const total = matching.reduce(
		(sum, account) => sum + (account.annualContribution ?? 0),
		0,
	);
	return total > 0 ? total : null;
}

function hasAccount(
	accounts: DetectedAccountSignal[],
	kind: DetectedAccountSignal["kind"],
): boolean {
	return accounts.some((account) => account.kind === kind);
}

function derivePerson(input: {
	netIncome: number;
	signals: DefaultSignals;
	accounts: DetectedAccountSignal[];
}): PersonContributionPolicy {
	const policy = emptyPersonContributionPolicy();
	const { signals } = input;

	if (input.netIncome > 0) {
		const grossed = grossUpNetIncome({
			netIncome: input.netIncome,
			filingStatus: signals.filingStatus,
			stateTaxRate: signals.stateTaxRate,
		});
		policy.grossAnnualCompensation = {
			value: grossed.grossAnnualCompensation,
			source: "assumed",
			confidence: "low",
			rationale:
				"Estimated from your take-home deposits, taxes and payroll withholding. Enter your salary for a precise figure.",
		};
	}

	if (hasAccount(input.accounts, "employerPlan")) {
		const detected = annualContributionFor(input.accounts, "employerPlan");
		policy.employerPlan = {
			mode: detected === null ? "none" : "fixedAnnual",
			amount: detected,
			rothShare: 0,
			match: assumedMatchTiers(),
			profitSharingPercentOfSalary: 0,
		};
	}

	const rothIraContribution = annualContributionFor(input.accounts, "rothIra");
	const traditionalIraContribution = annualContributionFor(
		input.accounts,
		"traditionalIra",
	);
	if (rothIraContribution !== null || hasAccount(input.accounts, "rothIra")) {
		policy.ira = {
			mode: rothIraContribution === null ? "none" : "fixedAnnual",
			amount: rothIraContribution,
			kind: "roth",
			backdoor: false,
		};
	} else if (
		traditionalIraContribution !== null ||
		hasAccount(input.accounts, "traditionalIra")
	) {
		policy.ira = {
			mode: traditionalIraContribution === null ? "none" : "fixedAnnual",
			amount: traditionalIraContribution,
			kind: "traditional",
			backdoor: false,
		};
	}

	if (hasAccount(input.accounts, "hsa") || signals.hsaEligible === true) {
		const detected = annualContributionFor(input.accounts, "hsa");
		policy.hsa = {
			mode: detected === null ? "none" : "fixedAnnual",
			employeeAmount: detected,
			employerAmount: 0,
			coverage: signals.healthCoverageAdults > 1 ? "family" : "self",
			invested: true,
			treatAsRetirementHealthcareAsset: true,
		};
	}

	const brokerage = annualContributionFor(input.accounts, "brokerage");
	if (brokerage !== null) {
		policy.taxableMonthly = brokerage / 12;
	}

	return policy;
}

/**
 * Pre-fills the contribution drawer from detected accounts. Every mode defaults
 * to `none` unless a real contribution figure was observed, so opening the
 * drawer never silently changes a projection — the numbers are visible first
 * and only take effect when the user picks a mode.
 */
export function deriveContributionPolicy(
	signals: DefaultSignals,
): ContributionPolicy {
	const primary = derivePerson({
		netIncome: signals.netEmploymentIncome,
		signals,
		accounts: signals.accounts,
	});

	const spouse = signals.hasSpouse
		? derivePerson({
				netIncome: signals.netSpouseEmploymentIncome,
				signals,
				// Account ownership is not attributed per person in the data, so
				// the spouse starts from an empty account set rather than
				// inheriting the household's accounts and double-counting them.
				accounts: [],
			})
		: null;

	return {
		primary,
		spouse,
		autoApplyCatchUp: true,
		contributionsStopAge: null,
	};
}
