import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	emptyRetirementPolicies,
	RETIREMENT_LEVER_TYPES,
	type RetirementLever,
	RetirementLeverSchema,
} from "@moat/contracts";
import { applyLevers } from "../apply-levers";
import type { RetirementBaseline } from "../build-baseline";
import { DEFAULT_WITHDRAWAL_ORDER } from "../constants";
import { type DefaultLeverContext, defaultLeverFor } from "../default-lever";
import { describeLever } from "../describe-lever";
import type { RetirementPlanInputs } from "../types";
import { conflictFieldFor, leverApplyPhase } from "./registry";

const ctx: DefaultLeverContext = {
	currentAge: 45,
	retirementAge: 65,
	spouseCurrentAge: 43,
	spouseRetirementAge: 65,
	hasSpouse: true,
	annualEmploymentIncome: 120_000,
	annualSpouseEmploymentIncome: 80_000,
	expectedRetirementMonthlySpending: 7_500,
	returnRate: 0.07,
	socialSecurityClaimAge: 67,
	spouseSocialSecurityClaimAge: 67,
	rmdStartAge: 75,
	primaryPropertyId: "home",
	rentalPropertyId: "rental",
};

function inputs(): RetirementPlanInputs {
	return {
		currentYear: 2026,
		currentAge: 45,
		primaryBirthYear: 1981,
		spouseCurrentAge: 43,
		retirementAge: 65,
		spouseRetirementAge: 65,
		longevityAge: 90,
		balances: { taxable: 200_000, taxDeferred: 500_000, taxFree: 100_000 },
		contributions: { taxable: 6_000, taxDeferred: 20_000, taxFree: 7_000 },
		contributionsStopAge: 65,
		annualEmploymentIncome: 120_000,
		annualSpouseEmploymentIncome: 80_000,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: 65,
		returnRate: 0.07,
		inflationRate: 0.025,
		incomeGrowthRate: 0.03,
		cashYield: 0.04,
		volatility: 0.13,
		preRetirementAnnualSpending: 96_000,
		preRetirementAnnualNetIncome: 104_000,
		preRetirementAnnualHealthcare: 6_000,
		retirementMonthlySpending: 7_000,
		essentialShare: 0.65,
		spendingStages: [],
		annualHealthcareSpending: 6_000,
		healthcareCostMultiplier: 1,
		preMedicareMonthlyPremium: 950,
		preMedicareWindow: null,
		properties: [
			{
				id: "home",
				name: "Home",
				isPrimaryResidence: true,
				value: 500_000,
				loanBalance: 200_000,
				annualInterestRate: 0.04,
				remainingTermMonths: 240,
				monthlyPayment: 1_500,
				monthlyRent: 0,
				monthlyExpenses: 400,
				vacancyRate: 0,
				appreciationRate: 0.03,
				expenseGrowthRate: 0.025,
				extraMonthlyPayment: 0,
				sellAtAge: null,
				acquiredAtAge: null,
				downPayment: 0,
				costBasis: 400_000,
			},
		],
		monthlyRentAfterHomeSale: 0,
		rentFromAge: null,
		socialSecurity: {
			monthlyAtFra: 3_400,
			claimAge: 67,
			haircut: 0,
			isEstimated: false,
		},
		spouseSocialSecurity: {
			monthlyAtFra: 1_800,
			claimAge: 67,
			haircut: 0,
			isEstimated: false,
		},
		filingStatus: "marriedJoint",
		stateTaxRate: 0.05,
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
	};
}

function baseline(): RetirementBaseline {
	const planInputs = inputs();
	return {
		baselineVersion: "test",
		refreshedAt: "2026-01-01T00:00:00.000Z",
		plan: {
			primaryBirthYear: 1981,
			primaryCurrentAge: 45,
			targetRetirementAge: 65,
			longevityAge: 90,
			socialSecurityClaimAge: 67,
			socialSecurityMonthlyAtFra: 3_400,
			hasSpouse: true,
			spouseBirthYear: 1983,
			spouseCurrentAge: 43,
			spouseRetirementAge: 65,
			spouseLongevityAge: null,
			spouseSocialSecurityClaimAge: 67,
			spouseSocialSecurityMonthlyAtFra: 1_800,
			annualEmploymentIncome: 120_000,
			annualSpouseEmploymentIncome: 80_000,
			confidenceTarget: 0.85,
			monteCarloTrials: 200,
			spendingStages: [],
			withdrawalOrder: [...DEFAULT_WITHDRAWAL_ORDER],
			contributionPolicy: emptyRetirementPolicies().contribution,
			spendingPolicy: emptyRetirementPolicies().spending,
			healthcarePolicy: emptyRetirementPolicies().healthcare,
			taxPolicy: emptyRetirementPolicies().tax,
			cashPolicy: emptyRetirementPolicies().cash,
			allocationPolicy: emptyRetirementPolicies().allocation,
		},
		inputs: planInputs,
		summary: {
			baselineVersion: "test",
			refreshedAt: "2026-01-01T00:00:00.000Z",
			currentAge: 45,
			balanceTaxable: 200_000,
			balanceTaxDeferred: 500_000,
			balanceTaxFree: 100_000,
			realEstateEquity: 300_000,
			debtBalance: 200_000,
			netWorth: 900_000,
			monthlyIncome: 16_666,
			monthlyExpenses: 8_500,
			monthlyContributions: 2_750,
			trailingMonthCount: 12,
			expectedRetirementMonthlySpending: 7_500,
			annualEmploymentIncome: 120_000,
			annualSpouseEmploymentIncome: 80_000,
			employmentEndsAtAge: 65,
			spouseEmploymentEndsAtAge: 65,
			investmentAccountCount: 3,
			propertyCount: 1,
			insurancePolicyCount: 0,
			localOnlyPolicyCount: 0,
		},
		accounts: [],
		properties: [],
		context: {
			filingStatus: "marriedJoint",
			stateTaxRate: 0.05,
			federalBracketHint: 0.24,
			inflationRate: 0.025,
			incomeGrowthRate: 0.03,
			investmentReturnRate: 0.07,
			realEstateAppreciationRate: 0.03,
			cashYield: 0.04,
			forecastStyle: "balanced",
			retirementAgeHint: 65,
			currentAgeHint: 45,
			insurancePolicies: [],
			excludedLocalPolicyCount: 0,
		},
		spendingPlan: {
			trailingMonths: 12,
			currentMonthlySpending: 8_500,
			remainsMonthly: 7_000,
			disappearsMonthly: 1_000,
			changesMonthly: 500,
			essentialMonthly: 5_000,
			flexibleMonthly: 2_500,
			adjustments: [],
			estimatedRetirementMonthly: 7_500,
			categories: [],
			stages: [],
		},
		trailing: {
			avgIncome: 16_666,
			avgExpenses: 8_500,
			avgNetGain: 8_166,
			monthCount: 12,
			totalIncome: 200_000,
			totalSpending: 102_000,
			netIncome: 98_000,
			savingsRate: 0.49,
		},
		detected: {
			has401k: true,
			hasRothIra: true,
			hasHsa: false,
			hasTaxableBrokerage: true,
			annual401kContribution: 20_000,
			annualRothContribution: 7_000,
			annualHsaContribution: 0,
			annualTaxableContribution: 6_000,
			employerMatchUnmodeled: true,
		},
		dataStatus: "ready",
		mortgagePayoffAge: 65,
		primaryResidenceEquity: 300_000,
		scenarioRatesSource: "ForecastAssumptions",
		spendingExclusions: {
			healthcareMonthly: 500,
			housingDebtServiceMonthly: 1_500,
			propertyOperatingMonthly: 400,
			insurancePremiumsMonthly: 0,
			otherDebtServiceMonthly: 0,
		},
		disabilityMonthlyBenefit: 0,
		standingRules: [],
		standingRuleSuggestions: [],
		policyDefaults: emptyRetirementPolicies(),
	};
}

describe("lever registry", () => {
	it("covers every contract lever type with default, describe, conflict, and apply", () => {
		assert.equal(RETIREMENT_LEVER_TYPES.length, 63);
		const host = baseline();
		for (const type of RETIREMENT_LEVER_TYPES) {
			const lever = defaultLeverFor(type, ctx);
			assert.equal(lever.type, type);
			assert.deepEqual(RetirementLeverSchema.parse(lever), lever);
			const description = describeLever(lever);
			assert.ok(description.length > 0, `${type} has empty describe`);
			const slot = conflictFieldFor(lever);
			assert.ok(slot === null || slot.length > 0, `${type} conflict field`);
			assert.ok(
				leverApplyPhase(type) === "standard" ||
					leverApplyPhase(type) === "relative" ||
					leverApplyPhase(type) === "employerMatch",
			);
			const { appliedLevers } = applyLevers(host, [
				{ id: type, enabled: true, sortOrder: 0, lever },
			]);
			assert.equal(appliedLevers.length, 1);
			assert.equal(appliedLevers[0]?.type, type);
		}
	});
});

function mixLever(
	params: Extract<
		RetirementLever,
		{ type: "spending_category_change" }
	>["params"],
	id = "mix",
) {
	return {
		id,
		enabled: true,
		sortOrder: 0,
		lever: { type: "spending_category_change" as const, params },
	};
}

describe("spending_category_change", () => {
	it("lowers working-year and retirement spend for an expense cut", () => {
		const { inputs, appliedLevers } = applyLevers(baseline(), [
			mixLever({
				label: "Kids",
				lineItemType: "expense",
				monthlyDelta: -2_667,
				matchKey: "expense:Kids",
				isRemoved: true,
				isNew: false,
			}),
		]);
		assert.equal(appliedLevers[0]?.applied, true);
		assert.equal(inputs.preRetirementAnnualSpending, 96_000 - 2_667 * 12);
		assert.equal(inputs.retirementMonthlySpending, 7_000 - 2_667);
	});

	it("composes two expense category levers", () => {
		const { inputs } = applyLevers(baseline(), [
			mixLever(
				{
					label: "Kids",
					lineItemType: "expense",
					monthlyDelta: -2_667,
					matchKey: "expense:Kids",
					isRemoved: true,
					isNew: false,
				},
				"kids",
			),
			{
				id: "groceries",
				enabled: true,
				sortOrder: 1,
				lever: {
					type: "spending_category_change",
					params: {
						label: "Groceries",
						lineItemType: "expense",
						monthlyDelta: -400,
						matchKey: "expense:Groceries",
						isRemoved: false,
						isNew: false,
						newMonthlyAmount: 0,
					},
				},
			},
		]);
		assert.equal(
			inputs.preRetirementAnnualSpending,
			96_000 - (2_667 + 400) * 12,
		);
		assert.equal(inputs.retirementMonthlySpending, 7_000 - 2_667 - 400);
	});

	it("does not change engine spend for income or savings mix diffs", () => {
		const { inputs } = applyLevers(baseline(), [
			mixLever(
				{
					label: "Total Income",
					lineItemType: "income",
					monthlyDelta: -3_000,
					matchKey: "income:Total Income",
					isRemoved: false,
					isNew: false,
					newMonthlyAmount: 711,
				},
				"income",
			),
			{
				id: "savings",
				enabled: true,
				sortOrder: 1,
				lever: {
					type: "spending_category_change",
					params: {
						label: "401k",
						lineItemType: "savings",
						monthlyDelta: 500,
						matchKey: "savings:401k",
						isRemoved: false,
						isNew: true,
						newMonthlyAmount: 500,
					},
				},
			},
		]);
		assert.equal(inputs.preRetirementAnnualSpending, 96_000);
		assert.equal(inputs.retirementMonthlySpending, 7_000);
		assert.equal(inputs.annualEmploymentIncome, 120_000);
	});

	it("clamps retirement spend at zero and shifts spending stages", () => {
		const host = baseline();
		host.inputs.spendingStages = [
			{ ageFrom: 65, ageTo: 75, monthlyAmount: 1_000 },
		];
		const { inputs } = applyLevers(host, [
			mixLever({
				label: "Kids",
				lineItemType: "expense",
				monthlyDelta: -8_000,
				matchKey: "expense:Kids",
				isRemoved: true,
				isNew: false,
			}),
		]);
		assert.equal(inputs.preRetirementAnnualSpending, 0);
		assert.equal(inputs.retirementMonthlySpending, 0);
		assert.equal(inputs.spendingStages[0]?.monthlyAmount, 0);
	});
});
