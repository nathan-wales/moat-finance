import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyRetirementPolicies, SpendingPolicySchema } from "@moat/contracts";
import { applyPolicies } from "./apply-policies";
import { DEFAULT_WITHDRAWAL_ORDER } from "./constants";
import type { RetirementPlanInputs } from "./types";

function baseInputs(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return {
		currentYear: 2026,
		currentAge: 50,
		primaryBirthYear: 1976,
		spouseCurrentAge: 50,
		retirementAge: 65,
		spouseRetirementAge: 65,
		longevityAge: 90,
		balances: { cash: 100_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
		contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
		contributionsStopAge: 65,
		annualEmploymentIncome: 0,
		annualSpouseEmploymentIncome: 0,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: 65,
		returnRate: 0,
		inflationRate: 0,
		incomeGrowthRate: 0,
		cashYield: 0,
		volatility: 0,
		preRetirementAnnualSpending: 144_000,
		preRetirementAnnualNetIncome: 0,
		preRetirementAnnualHealthcare: 0,
		retirementMonthlySpending: 8_000,
		essentialShare: 0.65,
		spendingStages: [],
		annualHealthcareSpending: 0,
		healthcareCostMultiplier: 1,
		preMedicareMonthlyPremium: 0,
		preMedicareWindow: null,
		properties: [],
		monthlyRentAfterHomeSale: 0,
		rentFromAge: null,
		socialSecurity: {
			monthlyAtFra: 0,
			claimAge: 67,
			haircut: 0,
			isEstimated: false,
		},
		spouseSocialSecurity: null,
		filingStatus: "marriedJoint",
		stateTaxRate: 0,
		stateTaxChange: null,
		withdrawalOrder: [...DEFAULT_WITHDRAWAL_ORDER],
		rmdStartAge: 75,
		oneTimeEvents: [],
		recurringIncome: [],
		recurringExpenses: [],
		incomeGaps: [],
		incomeAdjustments: [],
		marketShocks: [],
		sequenceRisk: null,
		rothConversion: null,
		annuities: [],
		longTermCareEvents: [],
		ltcCoverage: null,
		lifeCoverage: [],
		disabilityEvents: [],
		spouseDeathAtAge: null,
		insurancePremiums: [],
		taxYear: 2026,
		...overrides,
	};
}

const percentPolicy = {
	value: 0.9,
	source: "assumed" as const,
	confidence: "low" as const,
	rationale: "Test.",
};

describe("applySpendingPolicy", () => {
	it("uses Insights spending as the percent base when lifestyle is unset", () => {
		const policies = emptyRetirementPolicies();
		policies.spending.retirementSpendPercentOfCurrent = percentPolicy;
		const compiled = applyPolicies(baseInputs(), policies, {
			primaryWageTaxRate: 0,
			spouseWageTaxRate: 0,
		});
		assert.equal(compiled.retirementMonthlySpending, 10_800);
		assert.equal(compiled.preRetirementAnnualSpending, 144_000);
	});

	it("uses the lifestyle override as the percent base", () => {
		const policies = emptyRetirementPolicies();
		policies.spending.retirementSpendPercentOfCurrent = percentPolicy;
		policies.spending.currentLifestyleMonthly = {
			value: 8_000,
			source: "userEdited",
			confidence: "high",
			rationale: "Set from spending mix.",
		};
		const compiled = applyPolicies(baseInputs(), policies, {
			primaryWageTaxRate: 0,
			spouseWageTaxRate: 0,
		});
		assert.equal(compiled.retirementMonthlySpending, 7_200);
		assert.equal(compiled.preRetirementAnnualSpending, 144_000);
	});
});

describe("SpendingPolicySchema", () => {
	it("parses stored JSON that omits currentLifestyleMonthly", () => {
		const parsed = SpendingPolicySchema.safeParse({
			retirementSpendPercentOfCurrent: percentPolicy,
			phaseModel: "flat",
			phases: null,
		});
		assert.equal(parsed.success, true);
		if (!parsed.success) return;
		assert.equal(parsed.data.currentLifestyleMonthly, null);
	});
});
