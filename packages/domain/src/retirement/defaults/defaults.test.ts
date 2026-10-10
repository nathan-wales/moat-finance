import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { deriveRecurringExpenseSuggestions } from "./derive-rule-suggestions";
import { deriveSmartDefaults } from "./index";
import type { DefaultSignals } from "./signals";

const SIGNALS: DefaultSignals = {
	currentAge: 45,
	retirementAge: 65,
	longevityAge: 95,
	filingStatus: "marriedJoint",
	hasSpouse: true,
	netEmploymentIncome: 80_000,
	netSpouseEmploymentIncome: 40_000,
	stateTaxRate: 0.05,
	accounts: [
		{
			kind: "employerPlan",
			balance: 200_000,
			annualContribution: 12_000,
			institutionLabel: "Fidelity",
		},
	],
	holdingMix: {
		equityValue: 70_000,
		fixedIncomeValue: 20_000,
		cashValue: 10_000,
		unclassifiedValue: 0,
	},
	hsaEligible: true,
	healthCoverageAdults: 2,
	transactionStateCode: "UT",
	profileLocation: "Salt Lake City, UT",
	recurringExpenses: [
		{
			key: "gym",
			label: "Gym membership",
			monthlyAmount: 80,
			observedMonths: 12,
		},
	],
	monthlyHealthcareSpend: 400,
};

describe("deriveSmartDefaults", () => {
	it("produces a stable provenance map for a fixed signal set", () => {
		const defaults = deriveSmartDefaults(SIGNALS);
		assert.equal(
			defaults.contribution.primary.employerPlan.mode,
			"fixedAnnual",
		);
		assert.equal(defaults.contribution.primary.employerPlan.amount, 12_000);
		assert.equal(
			defaults.contribution.primary.grossAnnualCompensation?.source,
			"assumed",
		);
		assert.equal(defaults.tax.currentStateCode?.value, "UT");
		assert.equal(defaults.tax.currentStateCode?.source, "detected");
		assert.equal(defaults.allocation.glidePath.enabled, false);
		assert.equal(defaults.cash.excessDestination, "cash");
	});
});

describe("deriveRecurringExpenseSuggestions", () => {
	it("offers detected streams without compiling them as rules", () => {
		const suggestions = deriveRecurringExpenseSuggestions(
			SIGNALS.recurringExpenses,
			{ retirementAge: 65 },
		);
		assert.equal(suggestions.length, 1);
		assert.equal(suggestions[0]?.rule.kind, "RECURRING_EXPENSE");
		assert.equal(suggestions[0]?.rule.params.annualAmount, 960);
		assert.match(
			suggestions[0]?.rationale ?? "",
			/We noticed \$80\/mo for Gym membership/,
		);
	});
});
