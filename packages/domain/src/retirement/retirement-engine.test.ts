import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { describe, it } from "node:test";
import type { RetirementScenarioLever } from "@moat/contracts";
import {
	DEFAULT_LIQUID_TYPE_MIX,
	emptyRetirementPolicies,
	overlayRetirementMonteCarlo,
} from "@moat/contracts";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import { buildRetirementProjection } from "./build-projection";
import {
	ASSUMED_PROPERTY_EXPENSE_RATE,
	ASSUMED_VACANCY_RATE,
	contributionLimitsForYear,
	DEFAULT_WITHDRAWAL_ORDER,
} from "./constants";

const CONTRIBUTION_LIMITS_2026 = contributionLimitsForYear(2026, 0);

import { RetirementComputeAbortedError } from "./compute-options";
import { solveEarliestRetirementAge } from "./earliest-retirement";
import { solveRetirementGoal } from "./goal-seek";
import {
	buildRankedCandidates,
	findOpportunities,
	rankLeverCandidates,
} from "./improve-plan";
import { runMonteCarlo, runMonteCarloAsync } from "./monte-carlo";
import { projectRetirement } from "./project";
import { requiredMinimumDistribution } from "./rmd";
import { solveDeterministicSustainableSpending } from "./safe-spending";
import { runStressTests } from "./stress-test";
import { suggestLevers } from "./suggest-levers";
import type { ProjectedProperty, RetirementPlanInputs } from "./types";

function baseInputs(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return {
		currentYear: 2026,
		currentAge: 45,
		primaryBirthYear: 1981,
		spouseCurrentAge: null,
		retirementAge: 65,
		spouseRetirementAge: null,
		longevityAge: 95,
		balances: { taxable: 200_000, taxDeferred: 500_000, taxFree: 100_000 },
		contributions: { taxable: 6_000, taxDeferred: 20_000, taxFree: 7_000 },
		contributionsStopAge: 65,
		annualEmploymentIncome: 200_000,
		annualSpouseEmploymentIncome: 0,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: null,
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
		properties: [],
		monthlyRentAfterHomeSale: 0,
		rentFromAge: null,
		socialSecurity: {
			monthlyAtFra: 3_400,
			claimAge: 67,
			haircut: 0,
			isEstimated: false,
		},
		spouseSocialSecurity: null,
		filingStatus: "single",
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
		...overrides,
	};
}

function baseline(
	overrides: Partial<RetirementBaseline> = {},
): RetirementBaseline {
	const inputs = overrides.inputs ?? baseInputs();
	return {
		baselineVersion: "test-baseline",
		refreshedAt: "2026-01-01T00:00:00.000Z",
		plan: {
			primaryBirthYear: inputs.primaryBirthYear,
			primaryCurrentAge: inputs.currentAge,
			targetRetirementAge: inputs.retirementAge,
			longevityAge: inputs.longevityAge,
			socialSecurityClaimAge: inputs.socialSecurity.claimAge,
			socialSecurityMonthlyAtFra: inputs.socialSecurity.monthlyAtFra,
			hasSpouse: inputs.spouseCurrentAge !== null,
			spouseBirthYear: null,
			spouseCurrentAge: inputs.spouseCurrentAge,
			spouseRetirementAge: inputs.spouseRetirementAge,
			spouseLongevityAge: null,
			spouseSocialSecurityClaimAge: null,
			spouseSocialSecurityMonthlyAtFra: null,
			annualEmploymentIncome: null,
			annualSpouseEmploymentIncome: null,
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
		inputs,
		summary: {
			baselineVersion: "test-baseline",
			refreshedAt: "2026-01-01T00:00:00.000Z",
			currentAge: inputs.currentAge,
			balanceTaxable: inputs.balances.taxable,
			balanceTaxDeferred: inputs.balances.taxDeferred,
			balanceTaxFree: inputs.balances.taxFree,
			realEstateEquity: 0,
			debtBalance: 0,
			netWorth: 800_000,
			monthlyIncome: 16_666,
			monthlyExpenses: 8_500,
			monthlyContributions: 2_750,
			trailingMonthCount: 12,
			expectedRetirementMonthlySpending: 7_500,
			annualEmploymentIncome: inputs.annualEmploymentIncome,
			annualSpouseEmploymentIncome: inputs.annualSpouseEmploymentIncome,
			employmentEndsAtAge: inputs.employmentEndsAtAge,
			spouseEmploymentEndsAtAge: inputs.spouseEmploymentEndsAtAge,
			investmentAccountCount: 3,
			propertyCount: 0,
			insurancePolicyCount: 1,
			localOnlyPolicyCount: 0,
		},
		accounts: [],
		properties: [],
		context: {
			filingStatus: "single",
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
			savingsRate: 98_000 / 200_000,
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
		mortgagePayoffAge: null,
		primaryResidenceEquity: 0,
		scenarioRatesSource: "ForecastAssumptions",
		spendingExclusions: {
			healthcareMonthly: 500,
			housingDebtServiceMonthly: 0,
			propertyOperatingMonthly: 0,
			insurancePremiumsMonthly: 0,
			otherDebtServiceMonthly: 0,
		},
		disabilityMonthlyBenefit: 5_000,
		standingRules: [],
		standingRuleSuggestions: [],
		policyDefaults: emptyRetirementPolicies(),
		...overrides,
	};
}

function lever(
	entry: RetirementScenarioLever["lever"],
	sortOrder = 0,
	enabled = true,
): RetirementScenarioLever {
	return { id: `l${sortOrder}`, enabled, sortOrder, lever: entry };
}

const ZERO_CONTRIBUTIONS = {
	taxable: 0,
	taxDeferred: 0,
	taxFree: 0,
};

function dualEarnerHousehold(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return baseInputs({
		currentAge: 28,
		spouseCurrentAge: 28,
		filingStatus: "marriedJoint",
		retirementAge: 65,
		spouseRetirementAge: 65,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: 65,
		contributionsStopAge: 65,
		annualEmploymentIncome: 10_000,
		annualSpouseEmploymentIncome: 246_025,
		preRetirementAnnualNetIncome: 80_000,
		contributions: { ...ZERO_CONTRIBUTIONS },
		incomeGrowthRate: 0,
		cashYield: 0,
		returnRate: 0,
		...overrides,
	});
}

function coreInOf(year: {
	employmentIncome: number;
	spouseEmploymentIncome: number;
	socialSecurityIncome: number;
	spouseSocialSecurityIncome: number;
	rentalIncome: number;
	otherIncome: number;
	insuranceIncome: number;
	oneTimeInflows: number;
}): number {
	return (
		year.employmentIncome +
		year.spouseEmploymentIncome +
		year.socialSecurityIncome +
		year.spouseSocialSecurityIncome +
		year.rentalIncome +
		year.otherIncome +
		year.insuranceIncome +
		year.oneTimeInflows
	);
}

function assertCashFlowLeftover(
	year: { age: number; cashFlowLeftover: number },
	expected: number,
	tolerance = 5,
): void {
	assert.ok(
		Math.abs(year.cashFlowLeftover - expected) < tolerance,
		`age ${year.age}: cashFlowLeftover ${year.cashFlowLeftover} vs ${expected}`,
	);
}

const HEADLINE_MONTHLY_SPEND = 13_024;
const MORTGAGE_PI_MONTHLY = 2_400;
const PROPERTY_OPEX_MONTHLY = 400;
const HEALTHCARE_MONTHLY = 500;
const WORKED_LIVING_ANNUAL =
	(HEADLINE_MONTHLY_SPEND -
		MORTGAGE_PI_MONTHLY -
		PROPERTY_OPEX_MONTHLY -
		HEALTHCARE_MONTHLY) *
	12;

function workedExampleHousehold(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return dualEarnerHousehold({
		inflationRate: 0,
		expenseGrowthRate: 0,
		incomeGrowthRate: 0,
		cashYield: 0,
		returnRate: 0,
		preRetirementAnnualSpending: WORKED_LIVING_ANNUAL,
		preRetirementAnnualHealthcare: HEALTHCARE_MONTHLY * 12,
		preRetirementAnnualNetIncome: 0,
		insurancePremiums: [],
		balances: {
			cash: 500_000,
			taxable: 200_000,
			taxDeferred: 100_000,
			taxFree: 50_000,
		},
		properties: [
			primaryHome({
				loanBalance: 80_000,
				annualInterestRate: 0.06,
				remainingTermMonths: 36,
				monthlyPayment: MORTGAGE_PI_MONTHLY,
				monthlyExpenses: PROPERTY_OPEX_MONTHLY,
				appreciationRate: 0,
				expenseGrowthRate: 0,
			}),
		],
		...overrides,
	});
}

function primaryHome(
	overrides: Partial<ProjectedProperty> = {},
): ProjectedProperty {
	return {
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
		...overrides,
	};
}

describe("projectRetirement", () => {
	it("covers every year from today through longevity", () => {
		const result = projectRetirement(baseInputs());
		assert.equal(result.years.length, 51);
		assert.equal(result.years[0]?.age, 45);
		assert.equal(result.years.at(-1)?.age, 95);
	});

	it("reports today's balances separately from the first year-end", () => {
		const result = projectRetirement(
			baseInputs({
				balances: {
					cash: 36_767,
					taxable: 183_044,
					taxDeferred: 0,
					taxFree: 29_527,
				},
				otherDebt: 861,
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 100_000,
				preRetirementAnnualSpending: 27_000,
				preRetirementAnnualHealthcare: 0,
				cashYield: 0.04,
			}),
		);
		assert.equal(result.opening.age, 45);
		assert.equal(result.opening.year, 2026);
		assert.ok(Math.abs(result.opening.cashBalance - 36_767) < 1);
		assert.ok(Math.abs(result.opening.balanceTaxable - 183_044) < 1);
		assert.ok(Math.abs(result.opening.balanceTaxFree - 29_527) < 1);
		assert.ok(Math.abs(result.opening.otherDebt - 861) < 1);
		assert.ok(
			Math.abs(result.opening.netWorth - (36_767 + 183_044 + 29_527 - 861)) < 1,
		);
		assert.equal(result.opening.cashFlowLeftover, 0);
		assert.equal(result.opening.inflationFactor, 1);
		const year0 = result.years[0];
		assert.ok(year0);
		assert.ok(year0.cashBalance > result.opening.cashBalance);
		assert.ok(year0.netWorth > result.opening.netWorth);
		assert.equal(
			result.years.find((year) => year === result.opening),
			undefined,
		);
	});

	it("excludes a property acquired this year from the opening snapshot", () => {
		const result = projectRetirement(
			baseInputs({
				balances: { cash: 80_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 0,
				preRetirementAnnualSpending: 0,
				preRetirementAnnualHealthcare: 0,
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				returnRate: 0,
				cashYield: 0,
				inflationRate: 0,
				properties: [
					{
						id: "future-home",
						name: "Future home",
						isPrimaryResidence: true,
						value: 400_000,
						loanBalance: 320_000,
						annualInterestRate: 0,
						remainingTermMonths: 360,
						monthlyPayment: 0,
						monthlyRent: 0,
						monthlyExpenses: 0,
						vacancyRate: 0,
						appreciationRate: 0,
						expenseGrowthRate: 0,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: 45,
						downPayment: 80_000,
						costBasis: 400_000,
					},
				],
			}),
		);
		assert.equal(result.opening.realEstateEquity, 0);
		assert.ok(result.opening.cashBalance >= 80_000);
		const year0 = result.years[0];
		assert.ok(year0);
		assert.ok(year0.realEstateEquity > result.opening.realEstateEquity);
	});

	it("reconciles gross income minus taxes to spendable income", () => {
		for (const year of projectRetirement(baseInputs()).years) {
			if (year.isRetired) {
				assert.ok(
					Math.abs(year.grossIncome - year.taxesPaid - year.spendableIncome) <
						0.01,
					`retired year ${year.age} does not reconcile`,
				);
				continue;
			}
			// Working-year taxesPaid is display-only; spendable uses cash-flow tax
			// (Insights take-home is not levied again).
			assert.ok(
				Math.abs(year.grossIncome - year.spendableIncome) < 0.01,
				`working year ${year.age} spendable should match gross when cash-flow tax is zero`,
			);
			assert.ok(
				year.taxesPaid > 0,
				`working year ${year.age} should show estimated wage tax`,
			);
			assert.ok(
				year.marginalRate > 0,
				`working year ${year.age} should show a real marginal rate`,
			);
		}
	});

	it("accumulates before retirement and draws down after", () => {
		const years = projectRetirement(baseInputs()).years;
		const atRetirement = years.find((year) => year.age === 65);
		const beforeRetirement = years.find((year) => year.age === 64);
		assert.ok(atRetirement !== undefined && beforeRetirement !== undefined);
		assert.ok(atRetirement.liquidAssets > beforeRetirement.liquidAssets);
		assert.ok(atRetirement.liquidAssets > 2_000_000);
	});

	it("grows liquid assets through mid-40s when Insights net is positive", () => {
		const startingLiquid = 180_297 + 29_371;
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				balances: {
					taxable: 180_297 + 38_637,
					taxDeferred: 0,
					taxFree: 29_371,
				},
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 268_437,
				preRetirementAnnualSpending: 150_000,
				preRetirementAnnualNetIncome: 72_878,
				preRetirementAnnualHealthcare: 8_000,
				properties: [
					{
						id: "home",
						name: "Home",
						isPrimaryResidence: true,
						value: 600_000,
						loanBalance: 400_000,
						annualInterestRate: 0.065,
						remainingTermMonths: 300,
						monthlyPayment: 2_500,
						monthlyRent: 0,
						monthlyExpenses: 800,
						vacancyRate: 0,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.02,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 450_000,
					},
				],
				insurancePremiums: [
					{
						id: "life",
						label: "life",
						annualPremium: 1_200,
						expiresAtAge: null,
					},
				],
			}),
		).years;
		const start = years.find((year) => year.age === 40);
		const age44 = years.find((year) => year.age === 44);
		assert.ok(start !== undefined && age44 !== undefined);
		assert.ok(start.liquidAssets >= startingLiquid * 0.9);
		assert.ok(age44.liquidAssets > start.liquidAssets);
		assert.equal(start.withdrawalsTaxable, 0);
		assert.ok(start.taxesPaid > 0);
		assert.ok(start.marginalRate > 0);
	});

	it("does not create pre-retirement withdrawals when property costs are already in trailing spend", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				balances: { taxable: 210_000, taxDeferred: 0, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 200_000,
				preRetirementAnnualSpending: 120_000,
				preRetirementAnnualNetIncome: 50_000,
				preRetirementAnnualHealthcare: 5_000,
				properties: [
					{
						id: "home",
						name: "Home",
						isPrimaryResidence: true,
						value: 500_000,
						loanBalance: 300_000,
						annualInterestRate: 0.06,
						remainingTermMonths: 240,
						monthlyPayment: 2_000,
						monthlyRent: 0,
						monthlyExpenses: 600,
						vacancyRate: 0,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.02,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 400_000,
					},
				],
			}),
		).years;
		for (const year of years.filter((entry) => entry.age < 65)) {
			assert.equal(year.withdrawalsTaxable, 0);
			assert.equal(year.withdrawalsTaxDeferred, 0);
			assert.equal(year.withdrawalsTaxFree, 0);
			assert.equal(year.shortfall, 0);
		}
		const age44 = years.find((year) => year.age === 44);
		assert.ok(age44 !== undefined);
		assert.ok(age44.liquidAssets > 210_000);
	});

	it("pays required minimum distributions once RMDs start", () => {
		const years = projectRetirement(baseInputs()).years;
		assert.equal(
			years.find((year) => year.age === 74)?.requiredMinimumDistribution,
			0,
		);
		assert.ok(
			(years.find((year) => year.age === 76)?.requiredMinimumDistribution ??
				0) > 0,
		);
	});

	it("starts Social Security at the claim age and not before", () => {
		const years = projectRetirement(baseInputs()).years;
		assert.equal(
			years.find((year) => year.age === 66)?.socialSecurityIncome,
			0,
		);
		assert.ok(
			(years.find((year) => year.age === 67)?.socialSecurityIncome ?? 0) > 0,
		);
	});

	it("pays a 5-year auto loan off on its remaining term", () => {
		const years = projectRetirement(
			baseInputs({
				liabilities: [
					{
						id: "auto",
						name: "Auto loan",
						balance: 24_000,
						annualInterestRate: 0.06,
						monthlyPayment: 464,
						remainingTermMonths: 60,
					},
				],
			}),
		).years;
		const year0 = years.find((year) => year.age === 45);
		const stillOwed = years.find((year) => year.age === 48);
		const paidOff = years.find((year) => year.age === 49);
		const atLongevity = years.find((year) => year.age === 95);
		assert.ok(year0 && stillOwed && paidOff && atLongevity);
		assert.ok(year0.otherDebt < 24_000);
		assert.ok(year0.otherDebt > 0);
		assert.ok(stillOwed.otherDebt > 0);
		assert.equal(paidOff.otherDebt, 0);
		assert.equal(atLongevity.otherDebt, 0);
		assert.equal(atLongevity.debtBalance, 0);
	});

	it("keeps unmatched otherDebt flat when no liability schedule exists", () => {
		const years = projectRetirement(baseInputs({ otherDebt: 8_000 })).years;
		assert.equal(years[0]?.otherDebt, 8_000);
		assert.equal(years.at(-1)?.otherDebt, 8_000);
	});

	it("runs a mortgage to zero instead of carrying it to longevity", () => {
		const years = projectRetirement(
			baseInputs({
				properties: [
					{
						id: "home",
						name: "Home",
						isPrimaryResidence: true,
						value: 500_000,
						loanBalance: 200_000,
						annualInterestRate: 0.04,
						remainingTermMonths: 24,
						monthlyPayment: 8_700,
						monthlyRent: 0,
						monthlyExpenses: 400,
						vacancyRate: 0,
						appreciationRate: 0,
						expenseGrowthRate: 0,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 500_000,
					},
				],
			}),
		).years;
		const year0 = years.find((year) => year.age === 45);
		const year1 = years.find((year) => year.age === 46);
		const atLongevity = years.find((year) => year.age === 95);
		assert.ok(year0 && year1 && atLongevity);
		assert.ok(year0.debtBalance > 0);
		assert.equal(year1.debtBalance, 0);
		assert.equal(atLongevity.debtBalance, 0);
	});

	it("runs short when spending far outruns the portfolio", () => {
		const result = projectRetirement(
			baseInputs({ retirementMonthlySpending: 40_000 }),
		);
		assert.equal(result.fundedThroughLongevity, false);
		assert.ok(result.firstShortfallAge !== null);
	});
});

describe("applyLevers", () => {
	it("moves the retirement age and the dependent ages with it", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({ type: "retire_at_age", params: { age: 58 } }),
		]);
		assert.equal(inputs.retirementAge, 58);
		assert.equal(inputs.employmentEndsAtAge, 58);
		assert.equal(inputs.contributionsStopAge, 58);
	});

	it("resolves same-field conflicts last-write-wins with badges", () => {
		const { inputs, appliedLevers } = applyLevers(baseline(), [
			lever({ type: "retire_earlier", params: { years: 5 } }, 0),
			lever({ type: "retire_at_age", params: { age: 62 } }, 1),
		]);
		assert.equal(inputs.retirementAge, 62);
		const [first, second] = appliedLevers;
		assert.equal(first?.applied, false);
		assert.equal(first?.overriddenByLeverId, "l1");
		assert.equal(first?.overriddenByLabel, "Retire at 62");
		assert.equal(second?.applied, true);
		assert.deepEqual(second?.overridesLeverIds, ["l0"]);
	});

	it("keeps additive levers composing rather than conflicting", () => {
		const { inputs, appliedLevers } = applyLevers(baseline(), [
			lever({ type: "return_rate_delta", params: { delta: -0.01 } }, 0),
			lever({ type: "return_rate_delta", params: { delta: -0.01 } }, 1),
		]);
		assert.ok(Math.abs(inputs.returnRate - 0.05) < 1e-9);
		assert.ok(appliedLevers.every((entry) => entry.applied));
	});

	it("ignores a disabled lever without dropping its row", () => {
		const { inputs, appliedLevers } = applyLevers(baseline(), [
			lever({ type: "retire_at_age", params: { age: 55 } }, 0, false),
		]);
		assert.equal(inputs.retirementAge, 65);
		assert.equal(appliedLevers.length, 1);
		assert.equal(appliedLevers[0]?.applied, false);
		assert.equal(appliedLevers[0]?.enabled, false);
	});

	it("tops contributions up to the statutory limit", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({ type: "max_401k", params: { includeCatchUp: true } }),
		]);
		assert.equal(
			inputs.contributionPolicy?.primary.employerPlan.mode,
			"maxAllowed",
		);
		assert.equal(inputs.contributionPolicy?.autoApplyCatchUp, true);
		const year = projectRetirement(inputs).years[0];
		assert.ok(year);
		assert.equal(
			year.contributionsTaxDeferred,
			CONTRIBUTION_LIMITS_2026.employee401k,
		);
	});

	it("unlocks the catch-up contribution only at the catch-up age", () => {
		const { inputs } = applyLevers(
			baseline({ inputs: baseInputs({ currentAge: 55 }) }),
			[lever({ type: "max_401k", params: { includeCatchUp: true } })],
		);
		assert.equal(
			inputs.contributionPolicy?.primary.employerPlan.mode,
			"maxAllowed",
		);
		const year = projectRetirement(inputs).years[0];
		assert.ok(year);
		assert.equal(
			year.contributionsTaxDeferred,
			CONTRIBUTION_LIMITS_2026.employee401k +
				CONTRIBUTION_LIMITS_2026.employee401kCatchUp,
		);
	});

	it("reports why a spouse lever could not apply", () => {
		const original = baseline();
		const { inputs, appliedLevers } = applyLevers(original, [
			lever({ type: "spouse_retire_at_age", params: { age: 62 } }),
		]);
		assert.equal(appliedLevers[0]?.applied, false);
		assert.equal(appliedLevers[0]?.note, "This plan has no spouse.");
		assert.equal(
			inputs.preRetirementAnnualNetIncome,
			original.inputs.preRetirementAnnualNetIncome,
		);
	});

	it("ends spouse employment when the spouse stops working", () => {
		const withSpouse = baseline({
			inputs: baseInputs({
				spouseCurrentAge: 43,
				spouseRetirementAge: 65,
				spouseEmploymentEndsAtAge: 65,
				annualSpouseEmploymentIncome: 80_000,
			}),
		});
		const { inputs, appliedLevers } = applyLevers(withSpouse, [
			lever({ type: "spouse_stops_working", params: { atAge: 43 } }),
		]);
		assert.equal(appliedLevers[0]?.applied, true);
		assert.equal(inputs.spouseEmploymentEndsAtAge, 43);
		assert.equal(
			inputs.preRetirementAnnualNetIncome,
			withSpouse.inputs.preRetirementAnnualNetIncome,
		);
		const unlevered = projectRetirement(withSpouse.inputs);
		const levered = projectRetirement(inputs);
		const year = levered.years.find((entry) => entry.age === 45);
		assert.ok(year);
		assert.equal(year.spouseEmploymentIncome, 0);
		const unleveredYear = unlevered.years.find((entry) => entry.age === 45);
		assert.ok(unleveredYear);
		assert.equal(year.livingExpenses, unleveredYear.livingExpenses);
		assert.ok(year.cashFlowLeftover < unleveredYear.cashFlowLeftover - 1);
		assert.ok(levered.netWorthAtRetirement < unlevered.netWorthAtRetirement);
	});

	it("ends spouse employment before age 30", () => {
		const withSpouse = baseline({
			inputs: baseInputs({
				currentAge: 28,
				spouseCurrentAge: 25,
				spouseRetirementAge: 65,
				spouseEmploymentEndsAtAge: 65,
				annualSpouseEmploymentIncome: 80_000,
			}),
		});
		const { inputs, appliedLevers } = applyLevers(withSpouse, [
			lever({ type: "spouse_stops_working", params: { atAge: 25 } }),
		]);
		assert.equal(appliedLevers[0]?.applied, true);
		assert.equal(inputs.spouseEmploymentEndsAtAge, 25);
		const unlevered = projectRetirement(withSpouse.inputs);
		const levered = projectRetirement(inputs);
		const year = levered.years.find((entry) => entry.age === 28);
		assert.ok(year);
		assert.equal(year.spouseEmploymentIncome, 0);
		assert.equal(year.isRetired, false);
		const unleveredYear = unlevered.years.find((entry) => entry.age === 28);
		assert.ok(unleveredYear);
		assert.equal(year.livingExpenses, unleveredYear.livingExpenses);
		assert.ok(year.cashFlowLeftover < unleveredYear.cashFlowLeftover - 1);
		assert.ok(levered.netWorthAtRetirement < unlevered.netWorthAtRetirement);
	});

	it("subtracts the carved-out costs when spending is set outright", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({
				type: "retirement_spending_set",
				params: { monthlyAmount: 9_000 },
			}),
		]);
		assert.equal(inputs.retirementMonthlySpending, 8_500);
	});

	it("zeroes only part of a year for a six-month layoff", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({
				type: "job_loss",
				params: { atAge: 50, monthsOut: 6, severanceAmount: 20_000 },
			}),
		]);
		assert.equal(inputs.incomeGaps.length, 1);
		assert.equal(inputs.incomeGaps[0]?.shareOfYear, 0.5);
		const years = projectRetirement(inputs).years;
		const baseYears = projectRetirement(baseline().inputs).years;
		const affected = years.find((year) => year.age === 50);
		const unaffected = baseYears.find((year) => year.age === 50);
		assert.ok(affected !== undefined && unaffected !== undefined);
		assert.ok(
			Math.abs(affected.employmentIncome - unaffected.employmentIncome / 2) < 1,
		);
		assert.equal(affected.livingExpenses, unaffected.livingExpenses);
		assert.ok(affected.cashFlowLeftover < unaffected.cashFlowLeftover - 1);
		assert.ok(affected.contributionsCash < unaffected.contributionsCash - 1);
	});

	it("does not mutate the baseline it was handed", () => {
		const original = baseline();
		const snapshot = JSON.stringify(original.inputs);
		applyLevers(original, [
			lever({ type: "retire_at_age", params: { age: 55 } }, 0),
			lever(
				{
					type: "market_crash",
					params: { atAge: 60, dropPercent: 0.3, recoveryYears: 2 },
				},
				1,
			),
		]);
		assert.equal(JSON.stringify(original.inputs), snapshot);
	});
});

describe("accumulation cash-flow leftover", () => {
	it("does not import employmentShareOfSavingsNet in project.ts", () => {
		const source = readFileSync(
			new URL("./project.ts", import.meta.url),
			"utf8",
		);
		assert.equal(source.includes("employmentShareOfSavingsNet"), false);
		assert.equal(source.includes("grownObservedNet"), false);
	});

	it("uses wages minus composed spend when the spouse stops working at 30", () => {
		const household = workedExampleHousehold();
		const { inputs } = applyLevers(baseline({ inputs: household }), [
			lever({ type: "spouse_stops_working", params: { atAge: 30 } }),
		]);
		assert.equal(
			inputs.preRetirementAnnualSpending,
			household.preRetirementAnnualSpending,
		);
		assert.equal(
			inputs.preRetirementAnnualNetIncome,
			household.preRetirementAnnualNetIncome,
		);
		const unlevered = projectRetirement(household);
		const levered = projectRetirement(inputs);
		const at30 = levered.years.find((year) => year.age === 30);
		const unlevered30 = unlevered.years.find((year) => year.age === 30);
		assert.ok(at30 && unlevered30);
		assert.equal(at30.isRetired, false);
		assert.equal(at30.spouseEmploymentIncome, 0);
		assert.ok(Math.abs(at30.employmentIncome - 10_000) < 1);
		assert.equal(at30.livingExpenses, unlevered30.livingExpenses);
		const composedOut =
			at30.livingExpenses +
			at30.housingExpenses +
			at30.healthcareExpenses +
			at30.insurancePremiums;
		assert.ok(Math.abs(composedOut - HEADLINE_MONTHLY_SPEND * 12) < 1);
		assert.ok(Math.abs(coreInOf(at30) - 10_000) < 1);
		assertCashFlowLeftover(at30, coreInOf(at30) - composedOut);
		assertCashFlowLeftover(at30, 10_000 - HEADLINE_MONTHLY_SPEND * 12);
		assert.ok(Math.abs(at30.cashFlowLeftover / 12 - -12_191) < 5);
		assert.ok(
			Math.abs(at30.cashFlowLeftover - -36_288) > 1_000,
			"treating $10,000 as monthly would yield leftover ≈ -$3,024/month",
		);
		assert.equal(at30.contributionsCash, 0);
		assert.equal(at30.contributionsTaxDeferred, 0);
		assert.equal(at30.contributionsTaxFree, 0);
		assert.equal(at30.contributionsTaxable, 0);
		assert.ok(at30.withdrawalsTaxable > 0);
		assert.ok(levered.netWorthAtRetirement < unlevered.netWorthAtRetirement);
	});

	it("improves leftover by P&I not 2x P&I after mortgage payoff", () => {
		const household = workedExampleHousehold();
		const { inputs } = applyLevers(baseline({ inputs: household }), [
			lever({ type: "spouse_stops_working", params: { atAge: 30 } }),
		]);
		const years = projectRetirement(inputs).years;
		const withMortgage = years.find((year) => year.age === 30);
		const paidOff = years.find((year) => year.age === 31);
		assert.ok(withMortgage && paidOff);
		assert.equal(paidOff.livingExpenses, withMortgage.livingExpenses);
		const housingDrop = withMortgage.housingExpenses - paidOff.housingExpenses;
		assert.ok(Math.abs(housingDrop - MORTGAGE_PI_MONTHLY * 12) < 1);
		const leftoverGain =
			paidOff.cashFlowLeftover - withMortgage.cashFlowLeftover;
		assert.ok(Math.abs(leftoverGain - MORTGAGE_PI_MONTHLY * 12) < 5);
		assert.ok(Math.abs(leftoverGain - 2 * MORTGAGE_PI_MONTHLY * 12) > 1_000);
	});

	it("clips planned contributions to 0 when leftover is negative", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 45,
				longevityAge: 46,
				inflationRate: 0,
				incomeGrowthRate: 0,
				cashYield: 0,
				returnRate: 0,
				annualEmploymentIncome: 10_000,
				preRetirementAnnualSpending: 50_000,
				preRetirementAnnualHealthcare: 0,
				contributions: { taxable: 6_000, taxDeferred: 20_000, taxFree: 7_000 },
				balances: {
					cash: 80_000,
					taxable: 40_000,
					taxDeferred: 10_000,
					taxFree: 5_000,
				},
				properties: [],
			}),
		).years;
		const year = years.find((entry) => entry.age === 40);
		assert.ok(year);
		assert.ok(year.cashFlowLeftover < 0);
		assert.equal(year.contributionsTaxDeferred, 0);
		assert.equal(year.contributionsTaxFree, 0);
		assert.equal(year.contributionsTaxable, 0);
		assert.equal(year.contributionsCash, 0);
		assert.ok(year.withdrawalsTaxable > 0);
	});

	it("clips planned contributions to leftover when leftover is between 0 and planned", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 45,
				longevityAge: 46,
				inflationRate: 0,
				incomeGrowthRate: 0,
				cashYield: 0,
				returnRate: 0,
				annualEmploymentIncome: 50_000,
				preRetirementAnnualSpending: 40_000,
				preRetirementAnnualHealthcare: 0,
				contributions: { taxable: 6_000, taxDeferred: 20_000, taxFree: 7_000 },
				balances: { cash: 0, taxable: 0, taxDeferred: 0, taxFree: 0 },
				properties: [],
			}),
		).years;
		const year = years.find((entry) => entry.age === 40);
		assert.ok(year);
		assertCashFlowLeftover(year, 10_000);
		assert.equal(year.contributionsTaxDeferred, 10_000);
		assert.equal(year.contributionsTaxFree, 0);
		assert.equal(year.contributionsTaxable, 0);
		assert.equal(year.contributionsCash, 0);
	});

	it("applies planned in full and parks residual in cash when leftover exceeds planned", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				inflationRate: 0,
				incomeGrowthRate: 0,
				cashYield: 0,
				returnRate: 0,
				annualEmploymentIncome: 100_000,
				preRetirementAnnualSpending: 40_000,
				preRetirementAnnualHealthcare: 0,
				contributions: { taxable: 6_000, taxDeferred: 20_000, taxFree: 7_000 },
				balances: { cash: 0, taxable: 0, taxDeferred: 0, taxFree: 0 },
				properties: [],
			}),
		).years;
		const year = years.find((entry) => entry.age === 40);
		assert.ok(year);
		assertCashFlowLeftover(year, 60_000);
		assert.equal(year.contributionsTaxDeferred, 20_000);
		assert.equal(year.contributionsTaxFree, 7_000);
		assert.equal(year.contributionsTaxable, 6_000);
		assert.equal(year.contributionsCash, 27_000);
		assert.ok(Math.abs(year.cashBalance - 27_000) < 1);
		assert.ok(Math.abs(year.balanceTaxable - 6_000) < 1);
	});

	it("withdraws cash before taxable stocks when leftover is negative", () => {
		const years = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 45,
				longevityAge: 46,
				inflationRate: 0,
				incomeGrowthRate: 0,
				cashYield: 0,
				returnRate: 0,
				annualEmploymentIncome: 0,
				preRetirementAnnualSpending: 50_000,
				preRetirementAnnualHealthcare: 0,
				contributions: { ...ZERO_CONTRIBUTIONS },
				balances: {
					cash: 20_000,
					taxable: 80_000,
					taxDeferred: 50_000,
					taxFree: 50_000,
				},
				properties: [],
			}),
		).years;
		const year = years.find((entry) => entry.age === 40);
		assert.ok(year);
		assert.ok(year.cashFlowLeftover < 0);
		assert.ok(Math.abs(year.withdrawalsTaxable - 50_000) < 1);
		assert.equal(year.withdrawalsTaxDeferred, 0);
		assert.equal(year.withdrawalsTaxFree, 0);
		assert.ok(Math.abs(year.cashBalance) < 1);
		assert.ok(Math.abs(year.balanceTaxable - 50_000) < 1);
	});

	it("leaves leftover unchanged when a spouse lever skips a plan with no spouse", () => {
		const original = baseInputs({
			contributions: { ...ZERO_CONTRIBUTIONS },
			incomeGrowthRate: 0,
			inflationRate: 0,
			expenseGrowthRate: 0,
			preRetirementAnnualHealthcare: 0,
		});
		const { inputs, appliedLevers } = applyLevers(
			baseline({ inputs: original }),
			[lever({ type: "spouse_stops_working", params: { atAge: 30 } })],
		);
		assert.equal(appliedLevers[0]?.applied, false);
		assert.equal(appliedLevers[0]?.note, "This plan has no spouse.");
		assert.equal(
			inputs.preRetirementAnnualNetIncome,
			original.preRetirementAnnualNetIncome,
		);
		const year = projectRetirement(inputs).years.find(
			(entry) => entry.age === original.currentAge,
		);
		const unlevered = projectRetirement(original).years.find(
			(entry) => entry.age === original.currentAge,
		);
		assert.ok(year && unlevered);
		assert.equal(year.cashFlowLeftover, unlevered.cashFlowLeftover);
		assert.equal(year.contributionsCash, unlevered.contributionsCash);
		assert.equal(year.livingExpenses, unlevered.livingExpenses);
	});

	it("uses the same leftover identity on the overview path with no levers", () => {
		const household = workedExampleHousehold({
			spouseEmploymentEndsAtAge: 30,
		});
		const overview = projectRetirement(household);
		const { inputs } = applyLevers(
			baseline({ inputs: workedExampleHousehold() }),
			[lever({ type: "spouse_stops_working", params: { atAge: 30 } })],
		);
		const levered = projectRetirement(inputs);
		const overview30 = overview.years.find((year) => year.age === 30);
		const levered30 = levered.years.find((year) => year.age === 30);
		assert.ok(overview30 && levered30);
		assert.ok(
			Math.abs(overview30.cashFlowLeftover - levered30.cashFlowLeftover) < 1,
		);
		assert.equal(overview30.livingExpenses, levered30.livingExpenses);
		assert.equal(overview30.spouseEmploymentIncome, 0);
	});

	it("does not shrink spend when primary stops working before retirement age", () => {
		const household = workedExampleHousehold();
		const { inputs } = applyLevers(baseline({ inputs: household }), [
			lever({ type: "stop_working_at_age", params: { age: 30 } }),
		]);
		assert.equal(inputs.retirementAge, household.retirementAge);
		assert.equal(
			inputs.preRetirementAnnualSpending,
			household.preRetirementAnnualSpending,
		);
		const at30 = projectRetirement(inputs).years.find(
			(year) => year.age === 30,
		);
		const unlevered = projectRetirement(household).years.find(
			(year) => year.age === 30,
		);
		assert.ok(at30 && unlevered);
		assert.equal(at30.isRetired, false);
		assert.equal(at30.employmentIncome, 0);
		assert.ok(at30.spouseEmploymentIncome > 0);
		assert.equal(at30.livingExpenses, unlevered.livingExpenses);
		assertCashFlowLeftover(
			at30,
			household.annualSpouseEmploymentIncome - HEADLINE_MONTHLY_SPEND * 12,
		);
	});

	it("includes other-debt service in leftover and drops it at payoff", () => {
		const common = {
			currentAge: 40,
			retirementAge: 50,
			longevityAge: 51,
			inflationRate: 0,
			incomeGrowthRate: 0,
			cashYield: 0,
			returnRate: 0,
			annualEmploymentIncome: 100_000,
			preRetirementAnnualSpending: 40_000,
			preRetirementAnnualHealthcare: 0,
			contributions: { ...ZERO_CONTRIBUTIONS },
			properties: [],
		};
		const withDebt = projectRetirement(
			baseInputs({
				...common,
				liabilities: [
					{
						id: "auto",
						name: "Auto loan",
						balance: 10_000,
						annualInterestRate: 0,
						monthlyPayment: 500,
						remainingTermMonths: 24,
					},
				],
			}),
		).years;
		const withoutDebt = projectRetirement(baseInputs({ ...common })).years;
		const year0 = withDebt.find((year) => year.age === 40);
		const paidOff = withDebt.find((year) => year.age === 42);
		const plain = withoutDebt.find((year) => year.age === 40);
		assert.ok(year0 && paidOff && plain);
		assert.ok(
			Math.abs(year0.cashFlowLeftover - (plain.cashFlowLeftover - 6_000)) < 1,
		);
		assert.ok(Math.abs(paidOff.cashFlowLeftover - plain.cashFlowLeftover) < 5);
		const zeroPayment = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				inflationRate: 0,
				incomeGrowthRate: 0,
				cashYield: 0,
				returnRate: 0,
				annualEmploymentIncome: 100_000,
				preRetirementAnnualSpending: 40_000,
				preRetirementAnnualHealthcare: 0,
				contributions: { ...ZERO_CONTRIBUTIONS },
				properties: [],
				liabilities: [
					{
						id: "plaid-card",
						name: "Card",
						balance: 10_000,
						annualInterestRate: 0,
						monthlyPayment: 0,
						remainingTermMonths: 0,
					},
				],
			}),
		).years.find((year) => year.age === 40);
		assert.ok(zeroPayment);
		assert.ok(
			Math.abs(zeroPayment.cashFlowLeftover - plain.cashFlowLeftover) < 1,
		);
	});
});

describe("solveEarliestRetirementAge", () => {
	it("finds an age that funds the plan and rejects the one below it", () => {
		const inputs = baseInputs();
		const age = solveEarliestRetirementAge(inputs);
		assert.ok(age !== null);
		assert.equal(
			projectRetirement({
				...inputs,
				retirementAge: age,
				employmentEndsAtAge: age,
				contributionsStopAge: age,
			}).fundedThroughLongevity,
			true,
		);
		assert.equal(
			projectRetirement({
				...inputs,
				retirementAge: age - 1,
				employmentEndsAtAge: age - 1,
				contributionsStopAge: age - 1,
			}).fundedThroughLongevity,
			false,
		);
	});
});

describe("runMonteCarlo", () => {
	it("is reproducible for the same seed", () => {
		const inputs = baseInputs();
		const first = runMonteCarlo(inputs, { trials: 60, seed: 5 });
		const second = runMonteCarlo(inputs, { trials: 60, seed: 5 });
		assert.equal(first.confidence, second.confidence);
		assert.equal(first.medianLegacy, second.medianLegacy);
	});

	it("reports trial counts that agree with the confidence share", () => {
		const outcome = runMonteCarlo(baseInputs(), { trials: 80, seed: 3 });
		assert.equal(outcome.fundedTrials + outcome.depletedTrials, 80);
		assert.equal(outcome.confidence, outcome.fundedTrials / 80);
	});

	it("orders the percentile cone", () => {
		const outcome = runMonteCarlo(baseInputs(), { trials: 80, seed: 3 });
		assert.equal(outcome.cone.length, 51);
		for (const point of outcome.cone) {
			assert.ok(point.p10 <= point.p25);
			assert.ok(point.p25 <= point.p50);
			assert.ok(point.p50 <= point.p75);
			assert.ok(point.p75 <= point.p90);
		}
	});

	it("shocks returns around the glide-path schedule, not the flat rate", () => {
		const schedule = Array.from(
			{ length: 51 },
			(_, index) => 0.09 - index * 0.001,
		);
		const inputs = {
			...baseInputs(),
			returnRate: 0.04,
			volatility: 0,
			returnSchedule: schedule,
		};
		const deterministic = projectRetirement(inputs);
		const outcome = runMonteCarlo(inputs, {
			trials: 1,
			seed: 1,
			includeCone: false,
		});
		assert.ok(
			Math.abs(outcome.medianLegacy - deterministic.legacyAtLongevity) < 1,
		);
	});
});

describe("runMonteCarloAsync", () => {
	it("matches sync results for the same seed when yielding", async () => {
		const inputs = baseInputs();
		const sync = runMonteCarlo(inputs, { trials: 40, seed: 5 });
		const asyncResult = await runMonteCarloAsync(inputs, {
			trials: 40,
			seed: 5,
			yieldEvery: 7,
		});
		assert.deepEqual(asyncResult, sync);
	});

	it("reports progress at batch boundaries and at completion", async () => {
		const progress: Array<{ completed: number; total: number }> = [];
		await runMonteCarloAsync(baseInputs(), {
			trials: 20,
			seed: 2,
			includeCone: false,
			yieldEvery: 8,
			onProgress: (entry) => progress.push(entry),
		});
		assert.deepEqual(progress, [
			{ completed: 8, total: 20 },
			{ completed: 16, total: 20 },
			{ completed: 20, total: 20 },
		]);
	});

	it("stops between batches when aborted", async () => {
		const controller = new AbortController();
		let yields = 0;
		await assert.rejects(
			() =>
				runMonteCarloAsync(baseInputs(), {
					trials: 80,
					seed: 1,
					includeCone: false,
					yieldEvery: 8,
					signal: controller.signal,
					yieldFn: async () => {
						yields += 1;
						if (yields === 1) controller.abort();
					},
				}),
			(error: unknown) => error instanceof RetirementComputeAbortedError,
		);
		assert.equal(yields, 1);
	});
});

describe("buildRetirementProjection", () => {
	it("keys identically for the same stack and differently for another", () => {
		const stack = [lever({ type: "retire_at_age", params: { age: 60 } })];
		const first = buildRetirementProjection({
			baseline: baseline(),
			levers: stack,
		});
		const second = buildRetirementProjection({
			baseline: baseline(),
			levers: stack,
		});
		const other = buildRetirementProjection({
			baseline: baseline(),
			levers: [lever({ type: "retire_at_age", params: { age: 61 } })],
		});
		assert.equal(
			first.projection.projectionKey,
			second.projection.projectionKey,
		);
		assert.notEqual(
			first.projection.projectionKey,
			other.projection.projectionKey,
		);
	});

	it("reports the headline spending figure the user recognizes", () => {
		const built = buildRetirementProjection({
			baseline: baseline(),
			levers: [],
		});
		assert.equal(built.projection.summary.expectedMonthlySpending, 7_500);
		assert.equal(built.projection.taxYear, 2026);
		assert.deepEqual(built.projection.liquidTypeMix, DEFAULT_LIQUID_TYPE_MIX);
		assert.ok(built.projection.summary.safeMonthlySpending !== null);
		assert.ok(built.projection.summary.safeMonthlySpending > 0);
		assert.equal(built.projection.opening.age, built.result.opening.age);
		assert.equal(
			built.projection.opening.netWorth,
			built.result.opening.netWorth,
		);
		const year0NetWorth = built.projection.years[0]?.netWorth;
		assert.ok(year0NetWorth !== undefined);
		assert.ok(built.projection.opening.netWorth < year0NetWorth);
	});

	it("keeps the headline shortfall in the same dollars as Monte Carlo safe spend", () => {
		const built = buildRetirementProjection({
			baseline: baseline(),
			levers: [],
		});
		const expected = built.projection.summary.expectedMonthlySpending;
		const overlaid = overlayRetirementMonteCarlo(built.projection.summary, {
			confidence: 0.7,
			safeMonthlySpending: expected - 500,
		});
		assert.equal(overlaid.confidence, 0.7);
		assert.equal(overlaid.safeMonthlySpending, expected - 500);
		assert.equal(overlaid.monthlyShortfallAtTarget, 500);
	});
});

describe("stress tests, suggestions, opportunities and goal seek", () => {
	it("returns the baseline plus the adverse catalog", async () => {
		const response = await runStressTests({
			baseline: baseline(),
			levers: [],
			trials: 40,
		});
		assert.equal(response.results[0]?.isBaseline, true);
		assert.ok(response.results.length >= 9);
		for (const result of response.results.slice(1)) {
			assert.ok(result.confidenceDelta <= 0.5);
		}
	});

	it("suggests only levers that apply to this plan", () => {
		const suggestions = suggestLevers({
			baseline: baseline(),
			earliestSustainableAge: 60,
		});
		const ids = suggestions.map((entry) => entry.id);
		assert.ok(ids.includes("retire_earlier"));
		assert.ok(ids.includes("max_401k"));
		assert.ok(!ids.includes("downsize_home"));
		assert.ok(!ids.includes("mortgage_payoff_early"));
		assert.ok(!ids.includes("spouse_stops_working"));
	});

	it("suggests stopping spouse work when a spouse is still earning", () => {
		const suggestions = suggestLevers({
			baseline: baseline({
				inputs: baseInputs({
					spouseCurrentAge: 43,
					spouseRetirementAge: 65,
					spouseEmploymentEndsAtAge: 65,
					annualSpouseEmploymentIncome: 80_000,
				}),
			}),
			earliestSustainableAge: 60,
		});
		const spouseStop = suggestions.find(
			(entry) => entry.id === "spouse_stops_working",
		);
		assert.ok(spouseStop);
		assert.equal(spouseStop.lever.type, "spouse_stops_working");
		assert.equal(spouseStop.estimatedImpactScore, 50);
		assert.ok(spouseStop.estimatedImpactScore < 65);
		assert.ok(!spouseStop.detail.startsWith("Removes"));
		assert.ok(spouseStop.detail.includes("wages end"));
		assert.ok(spouseStop.detail.includes("spend"));
		assert.equal(spouseStop.detail.includes("wage share"), false);
		assert.equal(spouseStop.detail.includes("savings net"), false);
	});

	it("suggests stopping spouse work at a current age under 30", () => {
		const suggestions = suggestLevers({
			baseline: baseline({
				inputs: baseInputs({
					currentAge: 28,
					spouseCurrentAge: 25,
					spouseRetirementAge: 65,
					spouseEmploymentEndsAtAge: 65,
					annualSpouseEmploymentIncome: 80_000,
				}),
			}),
			earliestSustainableAge: 60,
		});
		const spouseStop = suggestions.find(
			(entry) => entry.id === "spouse_stops_working",
		);
		assert.ok(spouseStop);
		assert.equal(spouseStop.lever.type, "spouse_stops_working");
		if (spouseStop.lever.type !== "spouse_stops_working") return;
		assert.equal(spouseStop.lever.params.atAge, 25);
	});

	it("claims impacts that match a real projection of the same lever", async () => {
		const opportunities = await findOpportunities({
			baseline: baseline(),
			levers: [],
			trials: 40,
		});
		assert.ok(opportunities.length > 0);
		for (const opportunity of opportunities) {
			const { inputs } = applyLevers(baseline(), [lever(opportunity.lever)]);
			const replayed = runMonteCarlo(inputs, {
				trials: 40,
				seed: 13,
				includeCone: false,
			});
			assert.equal(replayed.confidence, opportunity.confidenceAfter);
		}
	});

	it("replays claimed confidenceAfter on a longer ranked list", async () => {
		const ranked = await rankLeverCandidates({
			baseline: baseline(),
			levers: [],
			trials: 40,
			limit: 12,
		});
		assert.ok(ranked.length > 0);
		for (const entry of ranked) {
			const { inputs } = applyLevers(baseline(), [lever(entry.lever)]);
			const replayed = runMonteCarlo(inputs, {
				trials: 40,
				seed: 13,
				includeCone: false,
			});
			assert.equal(replayed.confidence, entry.confidenceAfter);
		}
	});

	it("can rank retiring later among the measured opportunities", async () => {
		const underfunded = baseline({
			inputs: baseInputs({
				balances: { taxable: 20_000, taxDeferred: 40_000, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 8_000, taxFree: 0 },
				annualEmploymentIncome: 90_000,
				retirementMonthlySpending: 9_000,
				retirementAge: 62,
			}),
			detected: {
				has401k: true,
				hasRothIra: false,
				hasHsa: false,
				hasTaxableBrokerage: true,
				annual401kContribution: 8_000,
				annualRothContribution: 0,
				annualHsaContribution: 0,
				annualTaxableContribution: 0,
				employerMatchUnmodeled: false,
			},
		});
		const opportunities = await findOpportunities({
			baseline: underfunded,
			levers: [],
			trials: 40,
			limit: 12,
		});
		assert.ok(
			opportunities.some((entry) => entry.lever.type === "retire_later"),
			`retire_later missing: ${opportunities.map((entry) => entry.id).join(",")}`,
		);
		assert.equal(
			opportunities.filter((entry) => entry.lever.type === "retire_later")
				.length,
			1,
		);
		assert.ok(!opportunities.some((entry) => entry.id === "spend_more"));
		assert.ok(!opportunities.some((entry) => entry.id === "returns_lower"));
		assert.ok(
			!opportunities.some((entry) => entry.id === "spouse_stops_working"),
		);
	});

	it("lets retiring later beat max Roth when the plan is underfunded", async () => {
		const underfunded = baseline({
			inputs: baseInputs({
				balances: { taxable: 15_000, taxDeferred: 25_000, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 5_000, taxFree: 1_000 },
				annualEmploymentIncome: 120_000,
				preRetirementAnnualNetIncome: 6_000,
				preRetirementAnnualSpending: 108_000,
				retirementMonthlySpending: 10_000,
			}),
			detected: {
				has401k: true,
				hasRothIra: true,
				hasHsa: false,
				hasTaxableBrokerage: true,
				annual401kContribution: 5_000,
				annualRothContribution: 1_000,
				annualHsaContribution: 0,
				annualTaxableContribution: 0,
				employerMatchUnmodeled: false,
			},
		});
		const headToHead = buildRankedCandidates(underfunded).filter(
			(candidate) =>
				candidate.id === "retire_later_3" || candidate.id === "max_roth_ira",
		);
		assert.equal(headToHead.length, 2);
		const ranked = await rankLeverCandidates({
			baseline: underfunded,
			levers: [],
			candidates: headToHead,
			trials: 40,
		});
		assert.equal(ranked[0]?.id, "retire_later_3");
		assert.ok(ranked.some((entry) => entry.id === "max_roth_ira"));
		assert.ok((ranked[0]?.confidenceBefore ?? 1) < 0.98);
	});

	it("omits max Roth when contributions are already at the IRA limit", async () => {
		const atLimit = baseline({
			detected: {
				has401k: true,
				hasRothIra: true,
				hasHsa: false,
				hasTaxableBrokerage: true,
				annual401kContribution: 20_000,
				annualRothContribution: CONTRIBUTION_LIMITS_2026.ira,
				annualHsaContribution: 0,
				annualTaxableContribution: 6_000,
				employerMatchUnmodeled: true,
			},
			inputs: baseInputs({
				contributions: {
					taxable: 6_000,
					taxDeferred: 20_000,
					taxFree: CONTRIBUTION_LIMITS_2026.ira,
				},
			}),
		});
		const opportunities = await findOpportunities({
			baseline: atLimit,
			levers: [],
			trials: 40,
			limit: 12,
		});
		assert.ok(
			!opportunities.some((entry) => entry.lever.type === "max_roth_ira"),
		);
		const suggestions = suggestLevers({
			baseline: atLimit,
			earliestSustainableAge: 60,
		});
		assert.ok(!suggestions.some((entry) => entry.id === "max_roth_ira"));
	});

	it("orders overfunded opportunities by sweep impact instead of tied confidence", async () => {
		const overfunded = baseline({
			inputs: baseInputs({
				balances: {
					taxable: 2_000_000,
					taxDeferred: 3_000_000,
					taxFree: 1_000_000,
				},
				contributions: { taxable: 10_000, taxDeferred: 10_000, taxFree: 0 },
				retirementMonthlySpending: 4_000,
			}),
			detected: {
				has401k: true,
				hasRothIra: true,
				hasHsa: false,
				hasTaxableBrokerage: true,
				annual401kContribution: 10_000,
				annualRothContribution: 0,
				annualHsaContribution: 0,
				annualTaxableContribution: 10_000,
				employerMatchUnmodeled: false,
			},
		});
		const ranked = await rankLeverCandidates({
			baseline: overfunded,
			levers: [],
			trials: 40,
			limit: 8,
		});
		assert.ok(ranked.length > 1);
		const winner = ranked[0];
		assert.ok(winner);
		assert.ok(winner.confidenceBefore >= 0.98);
		for (let i = 1; i < ranked.length; i += 1) {
			const previous = ranked[i - 1];
			const current = ranked[i];
			assert.ok(previous && current);
			assert.ok(
				previous.deterministicScore >= current.deterministicScore,
				`rank ${i} sweep ${current.deterministicScore} exceeded rank ${i} predecessor ${previous.deterministicScore}`,
			);
		}
	});

	it("says the plan is already there when no change is needed", async () => {
		const response = await solveRetirementGoal({
			baseline: baseline(),
			objective: { kind: "retire_by_age", age: 60 },
			levers: [],
			trials: 40,
		});
		assert.equal(response.reachable, true);
		assert.equal(response.options[0]?.id, "already_there");
	});

	it("solves a reachable goal with real lever stacks", async () => {
		const response = await solveRetirementGoal({
			baseline: baseline(),
			objective: { kind: "retire_by_age", age: 50 },
			levers: [],
			trials: 40,
		});
		assert.equal(response.reachable, true);
		assert.ok(
			response.options.length >= 3,
			`only ${response.options.length} options: ${response.options.map((o) => o.id).join(",")}`,
		);
		for (const option of response.options) {
			assert.ok(option.levers.length > 0);
			const { inputs } = applyLevers(
				baseline(),
				option.levers.map((entry, index) => lever(entry, index)),
			);
			assert.equal(
				projectRetirement(inputs).fundedThroughLongevity,
				true,
				`option ${option.id} does not actually reach the goal`,
			);
		}
	});

	it("says so plainly when a goal is out of reach", async () => {
		const response = await solveRetirementGoal({
			baseline: baseline({
				inputs: baseInputs({
					balances: { taxable: 0, taxDeferred: 0, taxFree: 0 },
					contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
					annualEmploymentIncome: 30_000,
					retirementMonthlySpending: 12_000,
				}),
			}),
			objective: { kind: "retire_by_age", age: 46 },
			levers: [],
			trials: 40,
		});
		assert.equal(response.reachable, false);
		assert.equal(
			response.unreachableMessage,
			"This goal isn't reachable with the levers we model.",
		);
	});
});

describe("corrected engine invariants", () => {
	it("does not inflate crash recovery with extra return", () => {
		const crashed = projectRetirement(
			baseInputs({
				marketShocks: [{ atAge: 50, dropPercent: 0.4, recoveryYears: 2 }],
			}),
		);
		const baselineYears = projectRetirement(baseInputs()).years;
		const crashYear = crashed.years.find((year) => year.age === 50);
		const baseYear = baselineYears.find((year) => year.age === 50);
		assert.ok(crashYear !== undefined && baseYear !== undefined);
		assert.ok(crashYear.liquidAssets < baseYear.liquidAssets * 0.75);
		const recovered = crashed.years.find((year) => year.age === 53);
		const baseRecovered = baselineYears.find((year) => year.age === 53);
		assert.ok(recovered !== undefined && baseRecovered !== undefined);
		assert.ok(recovered.liquidAssets < baseRecovered.liquidAssets);
	});

	it("counts pre-retirement depletion as an unfunded Monte Carlo trial", () => {
		const outcome = runMonteCarlo(
			baseInputs({
				balances: { taxable: 1_000, taxDeferred: 1_000, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 20_000,
				preRetirementAnnualSpending: 80_000,
				preRetirementAnnualNetIncome: -60_000,
				retirementMonthlySpending: 1_000,
				returnRate: 0.02,
				volatility: 0.01,
			}),
			{ trials: 40, seed: 9, includeCone: false },
		);
		assert.ok(outcome.depletedTrials > 0);
		assert.ok(
			outcome.earliestDepletionAge !== null &&
				outcome.earliestDepletionAge < 65,
		);
	});

	it("applies a spending change on top of a spending set regardless of order", () => {
		const setThenChange = applyLevers(baseline(), [
			lever(
				{ type: "retirement_spending_set", params: { monthlyAmount: 6_000 } },
				0,
			),
			lever(
				{ type: "retirement_spending_change", params: { monthlyDelta: 500 } },
				1,
			),
		]);
		const changeThenSet = applyLevers(baseline(), [
			lever(
				{ type: "retirement_spending_change", params: { monthlyDelta: 500 } },
				0,
			),
			lever(
				{ type: "retirement_spending_set", params: { monthlyAmount: 6_000 } },
				1,
			),
		]);
		assert.equal(setThenChange.inputs.retirementMonthlySpending, 6_000);
		assert.equal(changeThenSet.inputs.retirementMonthlySpending, 6_000);
		assert.ok(setThenChange.appliedLevers.every((entry) => entry.applied));
		assert.ok(changeThenSet.appliedLevers.every((entry) => entry.applied));
	});

	it("pays only spouse-insured life policies on spouse death", () => {
		const years = projectRetirement(
			baseInputs({
				spouseCurrentAge: 45,
				spouseRetirementAge: 65,
				spouseEmploymentEndsAtAge: 65,
				annualSpouseEmploymentIncome: 80_000,
				filingStatus: "marriedJoint",
				spouseDeathAtAge: 60,
				lifeCoverage: [
					{
						id: "primary-term",
						deathBenefit: 500_000,
						annualPremium: 0,
						expiresAtAge: null,
						insured: "primary",
					},
					{
						id: "spouse-term",
						deathBenefit: 250_000,
						annualPremium: 0,
						expiresAtAge: null,
						insured: "spouse",
					},
				],
			}),
		).years;
		const deathYear = years.find((year) => year.age === 60);
		assert.ok(deathYear !== undefined);
		assert.ok(deathYear.oneTimeInflows >= 250_000);
		assert.ok(deathYear.oneTimeInflows < 500_000);
	});

	it("taxes a primary-home sale on gain above basis, not net proceeds", () => {
		const withGain = projectRetirement(
			baseInputs({
				properties: [
					{
						id: "home",
						name: "Home",
						isPrimaryResidence: true,
						value: 900_000,
						loanBalance: 100_000,
						annualInterestRate: 0.04,
						remainingTermMonths: 120,
						monthlyPayment: 1_000,
						monthlyRent: 0,
						monthlyExpenses: 400,
						vacancyRate: 0,
						appreciationRate: 0,
						expenseGrowthRate: 0,
						extraMonthlyPayment: 0,
						sellAtAge: 50,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 800_000,
					},
				],
			}),
		);
		const saleYear = withGain.years.find((year) => year.age === 50);
		assert.ok(saleYear !== undefined);
		assert.ok(saleYear.oneTimeInflows > 700_000);
	});

	it("uses an exact Uniform Lifetime divisor rather than interpolating", () => {
		const at115 = requiredMinimumDistribution({
			age: 115,
			balance: 100_000,
			rmdStartAge: 75,
		});
		const at117 = requiredMinimumDistribution({
			age: 117,
			balance: 100_000,
			rmdStartAge: 75,
		});
		assert.ok(Math.abs(at115 - 100_000 / 2.9) < 0.01);
		assert.ok(Math.abs(at117 - 100_000 / 2.9) < 0.01);
	});

	it("includes the Roth conversion that actually moves in taxable income", () => {
		const retired = {
			retirementAge: 45,
			employmentEndsAtAge: 45,
			contributionsStopAge: 45,
			annualEmploymentIncome: 0,
			contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
			preRetirementAnnualSpending: 0,
			preRetirementAnnualNetIncome: 0,
			retirementMonthlySpending: 2_000,
		};
		const without = projectRetirement(baseInputs(retired)).years[0];
		const withConversion = projectRetirement(
			baseInputs({
				...retired,
				rothConversion: {
					fromAge: 45,
					toAge: 45,
					annualAmount: 50_000,
					fillToBracket: null,
				},
			}),
		).years[0];
		assert.ok(without !== undefined);
		assert.ok(withConversion !== undefined);
		assert.equal(withConversion.rothConversion, 50_000);
		assert.ok(withConversion.taxableIncome - without.taxableIncome > 40_000);
		assert.ok(withConversion.taxesPaid > without.taxesPaid);
	});

	it("does not treat employer match as employee 401(k) deferral", () => {
		const { inputs } = applyLevers(baseline(), [
			lever(
				{
					type: "employer_match",
					params: { matchPercent: 0.5, upToPercentOfSalary: 0.06 },
				},
				0,
			),
			lever({ type: "max_401k", params: { includeCatchUp: false } }, 1),
		]);
		assert.equal(
			inputs.contributionPolicy?.primary.employerPlan.mode,
			"maxAllowed",
		);
		assert.deepEqual(inputs.contributionPolicy?.primary.employerPlan.match, [
			{ matchRate: 0.5, upToPercent: 0.06 },
		]);
		const year = projectRetirement(inputs).years[0];
		assert.ok(year);
		assert.equal(
			year.contributionsTaxDeferred,
			CONTRIBUTION_LIMITS_2026.employee401k,
		);
		const gross =
			inputs.contributionPolicy?.primary.grossAnnualCompensation ?? 0;
		assert.ok(gross > 200_000);
		assert.ok(Math.abs(year.employerContributions - gross * 0.06 * 0.5) < 1);
	});
});

describe("lever stack calculations", () => {
	it("removing a lever matches never having added it", () => {
		const retire = lever({ type: "retire_at_age", params: { age: 60 } }, 0);
		const max401k = lever(
			{ type: "max_401k", params: { includeCatchUp: false } },
			1,
		);
		const onlyRetire = applyLevers(baseline(), [retire]);
		const bothThenDisabled = applyLevers(baseline(), [
			retire,
			{ ...max401k, enabled: false },
		]);
		assert.equal(
			onlyRetire.inputs.retirementAge,
			bothThenDisabled.inputs.retirementAge,
		);
		assert.equal(
			onlyRetire.inputs.contributions.taxDeferred,
			bothThenDisabled.inputs.contributions.taxDeferred,
		);
	});

	it("applies return-rate deltas after a set so order does not change the result", () => {
		const setThenDelta = applyLevers(baseline(), [
			lever({ type: "return_rate_set", params: { rate: 0.05 } }, 0),
			lever({ type: "return_rate_delta", params: { delta: -0.01 } }, 1),
		]);
		const deltaThenSet = applyLevers(baseline(), [
			lever({ type: "return_rate_delta", params: { delta: -0.01 } }, 0),
			lever({ type: "return_rate_set", params: { rate: 0.05 } }, 1),
		]);
		assert.ok(Math.abs(setThenDelta.inputs.returnRate - 0.04) < 1e-9);
		assert.ok(Math.abs(deltaThenSet.inputs.returnRate - 0.04) < 1e-9);
	});

	it("lets a later spending-stages lever replace a spending set", () => {
		const { inputs, appliedLevers } = applyLevers(baseline(), [
			lever(
				{ type: "retirement_spending_set", params: { monthlyAmount: 6_000 } },
				0,
			),
			lever(
				{
					type: "retirement_spending_stages",
					params: {
						stages: [
							{ ageFrom: 65, ageTo: 75, monthlyAmount: 8_000 },
							{ ageFrom: 76, ageTo: null, monthlyAmount: 5_000 },
						],
					},
				},
				1,
			),
		]);
		assert.equal(appliedLevers[0]?.applied, false);
		assert.equal(appliedLevers[1]?.applied, true);
		assert.equal(inputs.spendingStages[0]?.monthlyAmount, 7_500);
		assert.equal(inputs.spendingStages[1]?.monthlyAmount, 4_500);
	});

	it("grows a future home purchase to the acquisition year", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({
				type: "buy_home",
				params: {
					atAge: 55,
					price: 400_000,
					downPayment: 80_000,
					rate: 0.065,
					termYears: 30,
					usage: "PRIMARY_RESIDENCE",
				},
			}),
		]);
		const home = inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.ok(home !== undefined);
		const grow = 1.03 ** 10;
		assert.ok(Math.abs(home.value - 400_000 * grow) < 1);
		assert.ok(Math.abs(home.downPayment - 80_000 * grow) < 1);
	});

	it("inflates a stated part-time salary with inflation, not career growth", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({
				type: "part_time_before_retirement",
				params: { fromAge: 45, toAge: 50, annualIncome: 40_000 },
			}),
		]);
		const year = projectRetirement(inputs).years.find(
			(entry) => entry.age === 46,
		);
		assert.ok(year !== undefined);
		assert.ok(Math.abs(year.employmentIncome - 40_000 * 1.025) < 1);
		assert.ok(year.cashFlowLeftover !== undefined);
		assert.equal(year.isRetired, false);
	});

	it("reports the monthly shortfall in headline dollars", () => {
		const thin = baseline({
			inputs: baseInputs({
				balances: { taxable: 2_000, taxDeferred: 2_000, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 0,
				preRetirementAnnualSpending: 12_000,
				preRetirementAnnualNetIncome: -12_000,
				retirementMonthlySpending: 7_000,
			}),
		});
		const built = buildRetirementProjection({ baseline: thin, levers: [] });
		const engineGap = Math.max(
			0,
			7_000 - solveDeterministicSustainableSpending(thin.inputs),
		);
		assert.equal(built.projection.summary.monthlyShortfallAtTarget, engineGap);
	});

	it("computes employer match from the final 401(k) deferral in either order", () => {
		const seeded = baseline();
		const lowDeferral = baseline({
			inputs: baseInputs({
				contributions: { taxable: 6_000, taxDeferred: 4_000, taxFree: 7_000 },
			}),
			detected: { ...seeded.detected, annual401kContribution: 4_000 },
		});
		const matchParams = {
			type: "employer_match" as const,
			params: { matchPercent: 0.5, upToPercentOfSalary: 0.06 },
		};
		const maxParams = {
			type: "max_401k" as const,
			params: { includeCatchUp: false },
		};
		const matchThenMax = applyLevers(lowDeferral, [
			lever(matchParams, 0),
			lever(maxParams, 1),
		]);
		const maxThenMatch = applyLevers(lowDeferral, [
			lever(maxParams, 0),
			lever(matchParams, 1),
		]);
		assert.equal(
			matchThenMax.inputs.contributionPolicy?.primary.employerPlan.mode,
			"maxAllowed",
		);
		assert.equal(
			maxThenMatch.inputs.contributionPolicy?.primary.employerPlan.mode,
			"maxAllowed",
		);
		assert.deepEqual(
			matchThenMax.inputs.contributionPolicy?.primary.employerPlan.match,
			[{ matchRate: 0.5, upToPercent: 0.06 }],
		);
		assert.deepEqual(
			maxThenMatch.inputs.contributionPolicy?.primary.employerPlan.match,
			[{ matchRate: 0.5, upToPercent: 0.06 }],
		);
	});

	it("does not charge rent on top of the replacement mortgage after an upsize", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever({
				type: "upsize_home",
				params: { atAge: 55, priceDelta: 200_000 },
			}),
		]);
		assert.equal(inputs.rentFromAge, null);
		const replacement = inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.ok(replacement !== undefined);
		const saleYear = projectRetirement(inputs).years.find(
			(year) => year.age === 55,
		);
		assert.ok(saleYear !== undefined);
		const yearIndex = 10;
		const expectedHousing =
			replacement.monthlyExpenses *
				12 *
				(1 + replacement.expenseGrowthRate) ** yearIndex +
			replacement.monthlyPayment * 12;
		assert.ok(Math.abs(saleYear.housingExpenses - expectedHousing) < 1);
	});

	it("honors thenRent false when selling the primary home", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const sold = applyLevers(withHome, [
			lever({
				type: "sell_primary_home",
				params: { atAge: 50, thenRent: false },
			}),
		]);
		assert.equal(sold.inputs.rentFromAge, null);
		const saleYear = projectRetirement(sold.inputs).years.find(
			(year) => year.age === 50,
		);
		assert.ok(saleYear !== undefined);
		assert.equal(saleYear.housingExpenses, 0);

		const rented = applyLevers(withHome, [
			lever({
				type: "sell_primary_home",
				params: { atAge: 50, thenRent: true },
			}),
		]);
		assert.equal(rented.inputs.rentFromAge, 50);
		const rentedYear = projectRetirement(rented.inputs).years.find(
			(year) => year.age === 50,
		);
		assert.ok(rentedYear !== undefined);
		assert.ok(rentedYear.housingExpenses > 0);
	});

	it("grows a downsize purchase price to the move year", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever({
				type: "downsize_home",
				params: { atAge: 70, newHomePrice: 300_000 },
			}),
		]);
		const smaller = inputs.properties.find(
			(property) => property.acquiredAtAge === 70,
		);
		assert.ok(smaller !== undefined);
		assert.ok(Math.abs(smaller.value - 300_000 * 1.03 ** 25) < 1);
		assert.ok(
			Math.abs(
				smaller.monthlyExpenses -
					(300_000 * ASSUMED_PROPERTY_EXPENSE_RATE) / 12,
			) < 0.01,
		);
	});

	it("replaces the current primary when buying another primary residence", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever({
				type: "buy_home",
				params: {
					atAge: 55,
					price: 600_000,
					downPayment: 120_000,
					rate: 0.065,
					termYears: 30,
					usage: "PRIMARY_RESIDENCE",
				},
			}),
		]);
		const current = inputs.properties.find(
			(property) => property.id === "home",
		);
		const next = inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.equal(current?.sellAtAge, 55);
		assert.equal(next?.isPrimaryResidence, true);
		const saleYear = projectRetirement(inputs).years.find(
			(year) => year.age === 55,
		);
		assert.ok(saleYear !== undefined);
		assert.ok(saleYear.oneTimeInflows > 0);
		assert.ok(saleYear.oneTimeExpenses > 0);
	});

	it("does not charge rent after selling then buying a replacement primary", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const soldThenBought = applyLevers(withHome, [
			lever(
				{
					type: "sell_primary_home",
					params: { atAge: 55, thenRent: true, monthlyRent: 2_500 },
				},
				0,
			),
			lever(
				{
					type: "buy_home",
					params: {
						atAge: 55,
						price: 600_000,
						downPayment: 120_000,
						rate: 0.065,
						termYears: 30,
						usage: "PRIMARY_RESIDENCE",
					},
				},
				1,
			),
		]);
		assert.equal(soldThenBought.inputs.rentFromAge, 55);
		const replacement = soldThenBought.inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.ok(replacement !== undefined);
		const saleYear = projectRetirement(soldThenBought.inputs).years.find(
			(year) => year.age === 55,
		);
		assert.ok(saleYear !== undefined);
		const yearIndex = 10;
		const expectedHousing =
			replacement.monthlyExpenses *
				12 *
				(1 + replacement.expenseGrowthRate) ** yearIndex +
			replacement.monthlyPayment * 12;
		assert.ok(Math.abs(saleYear.housingExpenses - expectedHousing) < 1);
	});

	it("charges rent only in the gap between selling and buying a primary", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever(
				{
					type: "sell_primary_home",
					params: { atAge: 50, thenRent: true, monthlyRent: 2_000 },
				},
				0,
			),
			lever(
				{
					type: "buy_home",
					params: {
						atAge: 60,
						price: 500_000,
						downPayment: 100_000,
						rate: 0.065,
						termYears: 30,
						usage: "PRIMARY_RESIDENCE",
					},
				},
				1,
			),
		]);
		const years = projectRetirement(inputs).years;
		const gapYear = years.find((year) => year.age === 55);
		const ownedYear = years.find((year) => year.age === 60);
		assert.ok(gapYear !== undefined);
		assert.ok(ownedYear !== undefined);
		const expectedRent = 2_000 * 12 * 1.025 ** 10;
		assert.ok(Math.abs(gapYear.housingExpenses - expectedRent) < 1);
		const replacement = inputs.properties.find(
			(property) => property.acquiredAtAge === 60,
		);
		assert.ok(replacement !== undefined);
		const ownedIndex = 15;
		const expectedOwned =
			replacement.monthlyExpenses *
				12 *
				(1 + replacement.expenseGrowthRate) ** ownedIndex +
			replacement.monthlyPayment * 12;
		assert.ok(Math.abs(ownedYear.housingExpenses - expectedOwned) < 1);
	});

	it("keeps renting after a vacation-home purchase", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever(
				{
					type: "sell_primary_home",
					params: { atAge: 55, thenRent: true, monthlyRent: 2_000 },
				},
				0,
			),
			lever(
				{
					type: "buy_home",
					params: {
						atAge: 55,
						price: 400_000,
						downPayment: 80_000,
						rate: 0.065,
						termYears: 30,
						usage: "VACATION_HOME",
					},
				},
				1,
			),
		]);
		const vacation = inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.ok(vacation !== undefined);
		assert.equal(vacation.isPrimaryResidence, false);
		const saleYear = projectRetirement(inputs).years.find(
			(year) => year.age === 55,
		);
		assert.ok(saleYear !== undefined);
		const yearIndex = 10;
		const vacationHousing =
			vacation.monthlyExpenses *
				12 *
				(1 + vacation.expenseGrowthRate) ** yearIndex +
			vacation.monthlyPayment * 12;
		const rent = 2_000 * 12 * 1.025 ** yearIndex;
		assert.ok(
			Math.abs(saleYear.housingExpenses - (vacationHousing + rent)) < 1,
		);
	});

	it("pulls a later primary sale forward when buying another primary first", () => {
		const withHome = baseline({
			inputs: baseInputs({ properties: [primaryHome()] }),
		});
		const { inputs } = applyLevers(withHome, [
			lever(
				{
					type: "sell_primary_home",
					params: { atAge: 70, thenRent: true },
				},
				0,
			),
			lever(
				{
					type: "buy_home",
					params: {
						atAge: 55,
						price: 600_000,
						downPayment: 120_000,
						rate: 0.065,
						termYears: 30,
						usage: "PRIMARY_RESIDENCE",
					},
				},
				1,
			),
		]);
		const current = inputs.properties.find(
			(property) => property.id === "home",
		);
		assert.equal(current?.sellAtAge, 55);
	});

	it("inflates stated rental rent from today rather than from a grown purchase price", () => {
		const { inputs } = applyLevers(baseline(), [
			lever({
				type: "add_rental_property",
				params: {
					atAge: 55,
					price: 400_000,
					downPayment: 80_000,
					monthlyRent: 2_000,
					monthlyExpenses: 500,
				},
			}),
		]);
		const rental = inputs.properties.find(
			(property) => property.acquiredAtAge === 55,
		);
		assert.ok(rental !== undefined);
		assert.equal(rental.monthlyRent, 2_000);
		const year = projectRetirement(inputs).years.find(
			(year) => year.age === 55,
		);
		assert.ok(year !== undefined);
		const expectedRent = 2_000 * 12 * (1 - ASSUMED_VACANCY_RATE) * 1.025 ** 10;
		assert.ok(Math.abs(year.rentalIncome - expectedRent) < 1);
	});

	it("reports staged spending at retirement in the headline expected figure", () => {
		const built = buildRetirementProjection({
			baseline: baseline(),
			levers: [
				lever(
					{
						type: "retirement_spending_stages",
						params: {
							stages: [
								{ ageFrom: 65, ageTo: 75, monthlyAmount: 8_000 },
								{ ageFrom: 76, ageTo: null, monthlyAmount: 5_000 },
							],
						},
					},
					0,
				),
			],
		});
		assert.equal(built.projection.summary.expectedMonthlySpending, 8_000);
	});
});

describe("forecast audit corrections", () => {
	it("grows cash at cashYield instead of the portfolio return", () => {
		const { years, opening } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				balances: { cash: 100_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 0,
				annualEmploymentIncome: 0,
				preRetirementAnnualSpending: 0,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				cashYield: 0.04,
				returnRate: 0.07,
				properties: [],
			}),
		);
		assert.ok(Math.abs(opening.cashBalance - 100_000) < 1);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assert.ok(Math.abs(year0.cashBalance - 104_000) < 1);
		assert.ok(Math.abs(year0.liquidAssets - 104_000) < 1);
	});

	it("adds residual leftover to cash before applying cash yield", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				balances: { cash: 100_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 20_000,
				annualEmploymentIncome: 50_000,
				preRetirementAnnualSpending: 30_000,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				cashYield: 0.04,
				returnRate: 0.07,
				incomeGrowthRate: 0,
				inflationRate: 0,
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assertCashFlowLeftover(year0, 20_000);
		assert.equal(year0.contributionsCash, 20_000);
		assert.equal(year0.contributionsTaxable, 0);
		assert.ok(Math.abs(year0.cashBalance - 124_800) < 1);
		assert.ok(Math.abs(year0.balanceTaxable) < 1);
	});

	it("inflates social security and rent at a few percent, not hundreds", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 29,
				retirementAge: 67,
				longevityAge: 95,
				inflationRate: 0.03,
				socialSecurity: {
					monthlyAtFra: 4_000,
					claimAge: 67,
					haircut: 0,
					isEstimated: false,
				},
				properties: [
					{
						id: "rental",
						name: "Rental",
						isPrimaryResidence: false,
						value: 400_000,
						loanBalance: 0,
						annualInterestRate: 0,
						remainingTermMonths: 0,
						monthlyPayment: 0,
						monthlyRent: 2_000,
						monthlyExpenses: 0,
						vacancyRate: 0,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.03,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 400_000,
					},
				],
			}),
		);
		const at95 = years.find((year) => year.age === 95);
		assert.ok(at95);
		const cola = 1.03 ** (95 - 29);
		assert.ok(Math.abs(at95.socialSecurityIncome - 4_000 * 12 * cola) < 1);
		assert.ok(Math.abs(at95.rentalIncome - 2_000 * 12 * cola) < 1);
		assert.ok(at95.socialSecurityIncome < 1_000_000);
		assert.ok(at95.rentalIncome < 1_000_000);
	});

	it("labels today's dollars without changing the nominal ledger", () => {
		const { years } = projectRetirement(
			baseInputs({
				inflationRate: 0.03,
			}),
		);
		const last = years.at(-1);
		assert.ok(last);
		assert.equal(last.inflationFactor, 1.03 ** (last.age - 45));
		assert.ok(last.netWorth > last.netWorthTodayDollars);
		assert.ok(
			Math.abs(
				last.netWorthTodayDollars - last.netWorth / last.inflationFactor,
			) < 1,
		);
	});

	it("percentiles liquid assets so the cone is not pinned to home equity", () => {
		const outcome = runMonteCarlo(
			baseInputs({
				currentAge: 64,
				retirementAge: 65,
				longevityAge: 75,
				balances: { taxable: 20_000, taxDeferred: 0, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 0,
				retirementMonthlySpending: 8_000,
				returnRate: 0.02,
				volatility: 0.2,
				properties: [
					{
						id: "home",
						name: "Home",
						isPrimaryResidence: true,
						value: 500_000,
						loanBalance: 0,
						annualInterestRate: 0,
						remainingTermMonths: 0,
						monthlyPayment: 0,
						monthlyRent: 0,
						monthlyExpenses: 0,
						vacancyRate: 0,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.03,
						extraMonthlyPayment: 0,
						sellAtAge: null,
						acquiredAtAge: null,
						downPayment: 0,
						costBasis: 500_000,
					},
				],
			}),
			{ trials: 80, seed: 11 },
		);
		const last = outcome.cone.at(-1);
		assert.ok(last);
		assert.ok(last.realEstateEquity > 100_000);
		assert.ok(last.p10 < last.realEstateEquity);
	});
});

describe("synced account forecast assumptions", () => {
	it("does not apply planned Roth contributions when leftover is negative", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 42,
				longevityAge: 43,
				balances: { cash: 80_000, taxable: 0, taxDeferred: 0, taxFree: 10_000 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 6_000 },
				preRetirementAnnualNetIncome: 0,
				annualEmploymentIncome: 10_000,
				preRetirementAnnualSpending: 40_000,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				returnRate: 0,
				cashYield: 0,
				inflationRate: 0,
				incomeGrowthRate: 0,
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assert.ok(year0.cashFlowLeftover < 0);
		assert.equal(year0.contributionsTaxFree, 0);
		assert.equal(year0.contributionsCash, 0);
		assert.ok(Math.abs(year0.balanceTaxFree - 10_000) < 1);
	});

	it("does not double-count planned contributions on top of leftover", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 42,
				longevityAge: 43,
				balances: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				contributions: { taxable: 0, taxDeferred: 10_000, taxFree: 2_000 },
				preRetirementAnnualNetIncome: 73_000,
				annualEmploymentIncome: 100_000,
				preRetirementAnnualSpending: 27_000,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				returnRate: 0,
				cashYield: 0,
				incomeGrowthRate: 0,
				inflationRate: 0,
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assertCashFlowLeftover(year0, 73_000);
		assert.equal(year0.contributionsTaxDeferred, 10_000);
		assert.equal(year0.contributionsTaxFree, 2_000);
		assert.equal(year0.contributionsTaxable, 0);
		assert.equal(year0.contributionsCash, 61_000);
		const totalNew =
			year0.contributionsTaxable +
			year0.contributionsTaxDeferred +
			year0.contributionsTaxFree +
			year0.contributionsCash;
		assert.equal(totalNew, 73_000);
		assert.ok(Math.abs(year0.cashBalance - 61_000) < 1);
		assert.ok(Math.abs(year0.balanceTaxable) < 1);
	});

	it("compounds only planned taxable contributions at the stock return", () => {
		const residualBeforeYield = 394_306 / 1.07 - 284_513;
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				balances: {
					cash: 38_788,
					taxable: 284_513,
					taxDeferred: 0,
					taxFree: 0,
				},
				contributions: { taxable: 12_000, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 12_000 + residualBeforeYield,
				annualEmploymentIncome: 200_000,
				preRetirementAnnualSpending: 200_000 - 12_000 - residualBeforeYield,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				returnRate: 0.07,
				cashYield: 0.045,
				incomeGrowthRate: 0,
				inflationRate: 0,
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assert.equal(year0.contributionsTaxable, 12_000);
		assert.ok(Math.abs(year0.contributionsCash - residualBeforeYield) < 1);
		// Stocks: (start + planned brokerage) * 1.07 ≈ $317k, not residual-inflated ~$394k.
		assert.ok(Math.abs(year0.balanceTaxable - (284_513 + 12_000) * 1.07) < 1);
		assert.ok(year0.balanceTaxable < 330_000);
		assert.ok(
			Math.abs(year0.cashBalance - (38_788 + residualBeforeYield) * 1.045) < 1,
		);
	});

	it("lands post-retirement surplus in cash not taxable", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 65,
				retirementAge: 65,
				longevityAge: 67,
				balances: {
					cash: 10_000,
					taxable: 100_000,
					taxDeferred: 0,
					taxFree: 0,
				},
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 0,
				annualEmploymentIncome: 0,
				retirementMonthlySpending: 0,
				returnRate: 0,
				cashYield: 0,
				socialSecurity: {
					monthlyAtFra: 4_000,
					claimAge: 65,
					haircut: 0,
					isEstimated: false,
				},
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 65);
		assert.ok(year0);
		assert.ok(year0.contributionsCash > 0);
		assert.equal(year0.contributionsTaxable, 0);
		assert.ok(year0.cashBalance > 10_000);
		assert.ok(Math.abs(year0.balanceTaxable - 100_000) < 1);
	});

	it("stops wages at retirement and starts Social Security only at claim age", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 64,
				retirementAge: 65,
				employmentEndsAtAge: 65,
				contributionsStopAge: 65,
				longevityAge: 68,
				annualEmploymentIncome: 200_000,
				cashYield: 0,
				returnRate: 0,
				socialSecurity: {
					monthlyAtFra: 3_400,
					claimAge: 67,
					haircut: 0,
					isEstimated: false,
				},
			}),
		);
		const age64 = years.find((year) => year.age === 64);
		const age65 = years.find((year) => year.age === 65);
		const age67 = years.find((year) => year.age === 67);
		assert.ok(age64 && age65 && age67);
		assert.ok(age64.employmentIncome > 0);
		assert.equal(age64.socialSecurityIncome, 0);
		assert.equal(age65.employmentIncome, 0);
		assert.equal(age65.socialSecurityIncome, 0);
		assert.equal(age67.employmentIncome, 0);
		assert.ok(age67.socialSecurityIncome > 0);
	});

	it("does not park surplus in cash when spend exceeds income", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 65,
				retirementAge: 65,
				longevityAge: 66,
				balances: {
					cash: 50_000,
					taxable: 100_000,
					taxDeferred: 0,
					taxFree: 0,
				},
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				annualEmploymentIncome: 0,
				retirementMonthlySpending: 20_000,
				cashYield: 0,
				returnRate: 0,
				rmdStartAge: 75,
				socialSecurity: {
					monthlyAtFra: 1_000,
					claimAge: 65,
					haircut: 0,
					isEstimated: false,
				},
				properties: [],
			}),
		);
		const year0 = years.find((year) => year.age === 65);
		assert.ok(year0);
		assert.equal(year0.contributionsCash, 0);
		assert.equal(year0.contributionsTaxable, 0);
		assert.ok(year0.cashBalance < 50_000);
	});

	it("lowers cash and net worth when cash yield is lower", () => {
		const projectAtYield = (cashYield: number) =>
			projectRetirement(
				baseInputs({
					currentAge: 40,
					retirementAge: 41,
					longevityAge: 42,
					balances: {
						cash: 38_788,
						taxable: 284_513,
						taxDeferred: 0,
						taxFree: 0,
					},
					contributions: { taxable: 12_000, taxDeferred: 0, taxFree: 0 },
					preRetirementAnnualNetIncome: 12_000 + 80_000,
					annualEmploymentIncome: 200_000,
					preRetirementAnnualSpending: 200_000 - 12_000 - 80_000,
					preRetirementAnnualHealthcare: 0,
					retirementMonthlySpending: 0,
					returnRate: 0.07,
					cashYield,
					incomeGrowthRate: 0,
					inflationRate: 0,
					properties: [],
				}),
			);
		const higher = projectAtYield(0.045).years.find((year) => year.age === 40);
		const lower = projectAtYield(0.03).years.find((year) => year.age === 40);
		assert.ok(higher && lower);
		assert.ok(lower.cashBalance < higher.cashBalance);
		assert.ok(lower.netWorth < higher.netWorth);
		assert.equal(higher.contributionsTaxable, 12_000);
		assert.equal(lower.contributionsTaxable, 12_000);
		assert.equal(lower.contributionsCash, higher.contributionsCash);
	});

	it("compounds tax-free at a higher per-bucket return than taxable", () => {
		const { years } = projectRetirement(
			baseInputs({
				currentAge: 40,
				retirementAge: 41,
				longevityAge: 42,
				balances: { taxable: 100_000, taxDeferred: 0, taxFree: 100_000 },
				contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
				preRetirementAnnualNetIncome: 0,
				annualEmploymentIncome: 0,
				preRetirementAnnualSpending: 0,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 0,
				returnRate: 0.07,
				bucketReturns: {
					taxable: 0.07,
					taxDeferred: 0.07,
					taxFree: 0.1,
				},
				cashYield: 0,
			}),
		);
		const year0 = years.find((year) => year.age === 40);
		assert.ok(year0);
		assert.ok(Math.abs(year0.balanceTaxable - 107_000) < 1);
		assert.ok(Math.abs(year0.balanceTaxFree - 110_000) < 1);
	});
});

describe("calculation audit corrections", () => {
	function flatWorker(
		overrides: Partial<RetirementPlanInputs> = {},
	): RetirementPlanInputs {
		return baseInputs({
			currentAge: 60,
			retirementAge: 65,
			employmentEndsAtAge: 65,
			contributionsStopAge: 65,
			longevityAge: 72,
			inflationRate: 0,
			incomeGrowthRate: 0,
			expenseGrowthRate: 0,
			cashYield: 0,
			returnRate: 0,
			stateTaxRate: 0,
			annualEmploymentIncome: 100_000,
			preRetirementAnnualSpending: 40_000,
			preRetirementAnnualHealthcare: 0,
			annualHealthcareSpending: 0,
			retirementMonthlySpending: 3_000,
			contributions: { ...ZERO_CONTRIBUTIONS },
			properties: [],
			socialSecurity: {
				monthlyAtFra: 0,
				claimAge: 67,
				haircut: 0,
				isEstimated: false,
			},
			...overrides,
		});
	}

	it("stops a dollar raise when the job it modifies ends", () => {
		const years = projectRetirement(
			flatWorker({
				incomeAdjustments: [
					{
						whom: "primary",
						fromAge: 60,
						toAge: null,
						annualDelta: 10_000,
						percentDelta: 0,
						setTo: null,
					},
				],
			}),
		).years;
		const working = years.find((year) => year.age === 64);
		const retired = years.find((year) => year.age === 66);
		assert.ok(working && retired);
		assert.ok(Math.abs(working.employmentIncome - 110_000) < 1);
		assert.equal(retired.employmentIncome, 0);
	});

	it("stops a stated salary when the job it modifies ends", () => {
		const years = projectRetirement(
			flatWorker({
				incomeAdjustments: [
					{
						whom: "primary",
						fromAge: 60,
						toAge: null,
						annualDelta: 0,
						percentDelta: 0,
						setTo: 40_000,
					},
				],
			}),
		).years;
		const working = years.find((year) => year.age === 64);
		const retired = years.find((year) => year.age === 66);
		assert.ok(working && retired);
		assert.ok(Math.abs(working.employmentIncome - 40_000) < 1);
		assert.equal(retired.employmentIncome, 0);
	});

	it("keeps paying a part-time salary that extends the employment end", () => {
		const { inputs } = applyLevers(baseline({ inputs: flatWorker() }), [
			lever({
				type: "part_time_before_retirement",
				params: { annualIncome: 30_000, fromAge: 65, toAge: 68 },
			}),
		]);
		const years = projectRetirement(inputs).years;
		const partTime = years.find((year) => year.age === 67);
		const afterPartTime = years.find((year) => year.age === 70);
		assert.ok(partTime && afterPartTime);
		assert.ok(Math.abs(partTime.employmentIncome - 30_000) < 1);
		assert.equal(afterPartTime.employmentIncome, 0);
	});

	it("charges only the months a loan is open in its payoff year", () => {
		const years = projectRetirement(
			flatWorker({
				liabilities: [
					{
						id: "auto",
						name: "Auto loan",
						balance: 9_000,
						annualInterestRate: 0,
						monthlyPayment: 500,
						remainingTermMonths: 18,
					},
				],
			}),
		).years;
		const fullYear = years.find((year) => year.age === 60);
		const payoffYear = years.find((year) => year.age === 61);
		const afterPayoff = years.find((year) => year.age === 62);
		const debtFree = projectRetirement(flatWorker()).years;
		const baselineFullYear = debtFree.find((year) => year.age === 60);
		const baselinePayoffYear = debtFree.find((year) => year.age === 61);
		assert.ok(
			fullYear &&
				payoffYear &&
				afterPayoff &&
				baselineFullYear &&
				baselinePayoffYear,
		);
		assert.equal(fullYear.totalOutflow - baselineFullYear.totalOutflow, 6_000);
		// Six payments left, not twelve.
		assert.equal(
			payoffYear.totalOutflow - baselinePayoffYear.totalOutflow,
			3_000,
		);
		assert.equal(afterPayoff.otherDebt, 0);
	});

	it("charges only the months a mortgage is open in its payoff year", () => {
		const years = projectRetirement(
			flatWorker({
				properties: [
					primaryHome({
						loanBalance: 18_000,
						annualInterestRate: 0,
						remainingTermMonths: 18,
						monthlyPayment: 1_000,
						monthlyExpenses: 0,
						appreciationRate: 0,
						expenseGrowthRate: 0,
					}),
				],
			}),
		).years;
		const fullYear = years.find((year) => year.age === 60);
		const payoffYear = years.find((year) => year.age === 61);
		const afterPayoff = years.find((year) => year.age === 62);
		assert.ok(fullYear && payoffYear && afterPayoff);
		assert.equal(fullYear.housingExpenses, 12_000);
		assert.equal(payoffYear.housingExpenses, 6_000);
		assert.equal(afterPayoff.housingExpenses, 0);
	});

	it("splits every year's outflow into essential, flexible and one-time", () => {
		const years = projectRetirement(
			flatWorker({
				longevityAge: 80,
				properties: [primaryHome()],
				insurancePremiums: [
					{
						id: "auto",
						label: "auto",
						annualPremium: 1_800,
						expiresAtAge: null,
					},
				],
				liabilities: [
					{
						id: "auto-loan",
						name: "Auto loan",
						balance: 12_000,
						annualInterestRate: 0.05,
						monthlyPayment: 400,
						remainingTermMonths: 36,
					},
				],
				recurringExpenses: [
					{
						label: "Travel",
						annualAmount: 8_000,
						fromAge: 66,
						toAge: 75,
						essentiality: "flexible",
					},
				],
				oneTimeEvents: [
					{
						label: "Roof",
						direction: "outflow",
						amount: 25_000,
						atAge: 68,
						taxTreatment: "taxFree",
					},
				],
			}),
		).years;
		for (const year of years) {
			const partitioned =
				year.essentialExpenses + year.flexibleExpenses + year.oneTimeExpenses;
			assert.ok(
				Math.abs(partitioned - year.totalOutflow) < 0.01,
				`age ${year.age}: ${partitioned} vs ${year.totalOutflow}`,
			);
		}
	});
});
