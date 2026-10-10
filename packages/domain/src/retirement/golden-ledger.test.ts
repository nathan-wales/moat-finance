import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RetirementProjectionYear } from "@moat/contracts";
import { emptyRetirementPolicies } from "@moat/contracts";
import { applyLevers } from "./apply-levers";
import type { RetirementBaseline } from "./build-baseline";
import { DEFAULT_WITHDRAWAL_ORDER } from "./constants";
import { calculateCashFlowLeftover } from "./ledger";
import { projectRetirement } from "./project";
import type { ProjectedProperty, RetirementPlanInputs } from "./types";

const ZERO_CONTRIBUTIONS = { taxable: 0, taxDeferred: 0, taxFree: 0 };

function home(overrides: Partial<ProjectedProperty> = {}): ProjectedProperty {
	return {
		id: "home",
		name: "Home",
		isPrimaryResidence: true,
		value: 500_000,
		loanBalance: 200_000,
		annualInterestRate: 0,
		remainingTermMonths: 240,
		monthlyPayment: 2_400,
		monthlyRent: 0,
		monthlyExpenses: 400,
		vacancyRate: 0,
		appreciationRate: 0,
		expenseGrowthRate: 0,
		extraMonthlyPayment: 0,
		sellAtAge: null,
		acquiredAtAge: null,
		downPayment: 0,
		costBasis: 400_000,
		...overrides,
	};
}

function base(
	overrides: Partial<RetirementPlanInputs> = {},
): RetirementPlanInputs {
	return {
		currentYear: 2026,
		currentAge: 28,
		primaryBirthYear: 1998,
		spouseCurrentAge: 28,
		retirementAge: 65,
		spouseRetirementAge: 65,
		longevityAge: 90,
		balances: {
			cash: 500_000,
			taxable: 200_000,
			taxDeferred: 100_000,
			taxFree: 50_000,
		},
		contributions: { ...ZERO_CONTRIBUTIONS },
		contributionsStopAge: 65,
		annualEmploymentIncome: 10_000,
		annualSpouseEmploymentIncome: 246_025,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: 65,
		returnRate: 0,
		inflationRate: 0,
		incomeGrowthRate: 0,
		cashYield: 0,
		volatility: 0.13,
		preRetirementAnnualSpending: (13_024 - 2_400 - 400 - 500) * 12,
		preRetirementAnnualNetIncome: 0,
		preRetirementAnnualHealthcare: 6_000,
		retirementMonthlySpending: 9_724,
		essentialShare: 0.65,
		spendingStages: [],
		annualHealthcareSpending: 6_000,
		healthcareCostMultiplier: 1,
		preMedicareMonthlyPremium: 0,
		preMedicareWindow: null,
		properties: [
			home({
				loanBalance: 80_000,
				annualInterestRate: 0.06,
				remainingTermMonths: 36,
				monthlyPayment: 2_400,
				monthlyExpenses: 400,
			}),
		],
		monthlyRentAfterHomeSale: 0,
		rentFromAge: null,
		socialSecurity: {
			monthlyAtFra: 0,
			claimAge: 70,
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

function baselineFor(planInputs: RetirementPlanInputs): RetirementBaseline {
	return {
		baselineVersion: "golden",
		refreshedAt: "2026-01-01T00:00:00.000Z",
		plan: {
			primaryBirthYear: planInputs.primaryBirthYear,
			primaryCurrentAge: planInputs.currentAge,
			targetRetirementAge: planInputs.retirementAge,
			longevityAge: planInputs.longevityAge,
			socialSecurityClaimAge: planInputs.socialSecurity.claimAge,
			socialSecurityMonthlyAtFra: planInputs.socialSecurity.monthlyAtFra,
			hasSpouse: planInputs.spouseCurrentAge !== null,
			spouseBirthYear: null,
			spouseCurrentAge: planInputs.spouseCurrentAge,
			spouseRetirementAge: planInputs.spouseRetirementAge,
			spouseLongevityAge: null,
			spouseSocialSecurityClaimAge: null,
			spouseSocialSecurityMonthlyAtFra: null,
			annualEmploymentIncome: planInputs.annualEmploymentIncome,
			annualSpouseEmploymentIncome: planInputs.annualSpouseEmploymentIncome,
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
			baselineVersion: "golden",
			refreshedAt: "2026-01-01T00:00:00.000Z",
			currentAge: planInputs.currentAge,
			balanceTaxable: planInputs.balances.taxable,
			balanceTaxDeferred: planInputs.balances.taxDeferred,
			balanceTaxFree: planInputs.balances.taxFree,
			realEstateEquity: 0,
			debtBalance: 0,
			netWorth: 0,
			monthlyIncome: 0,
			monthlyExpenses: 0,
			monthlyContributions: 0,
			trailingMonthCount: 12,
			expectedRetirementMonthlySpending: 13_024,
			annualEmploymentIncome: planInputs.annualEmploymentIncome,
			annualSpouseEmploymentIncome: planInputs.annualSpouseEmploymentIncome,
			employmentEndsAtAge: planInputs.employmentEndsAtAge,
			spouseEmploymentEndsAtAge: planInputs.spouseEmploymentEndsAtAge,
			investmentAccountCount: 1,
			propertyCount: planInputs.properties.length,
			insurancePolicyCount: 0,
			localOnlyPolicyCount: 0,
		},
		accounts: [],
		properties: [],
		context: {
			filingStatus: planInputs.filingStatus,
			stateTaxRate: planInputs.stateTaxRate,
			federalBracketHint: 0.22,
			inflationRate: planInputs.inflationRate,
			incomeGrowthRate: planInputs.incomeGrowthRate,
			investmentReturnRate: planInputs.returnRate,
			realEstateAppreciationRate: 0,
			cashYield: planInputs.cashYield,
			forecastStyle: "balanced",
			retirementAgeHint: planInputs.retirementAge,
			currentAgeHint: planInputs.currentAge,
			insurancePolicies: [],
			excludedLocalPolicyCount: 0,
		},
		spendingPlan: {
			trailingMonths: 12,
			currentMonthlySpending: 13_024,
			remainsMonthly: 13_024,
			disappearsMonthly: 0,
			changesMonthly: 0,
			essentialMonthly: 13_024,
			flexibleMonthly: 0,
			adjustments: [],
			estimatedRetirementMonthly: 13_024,
			categories: [],
			stages: [],
		},
		trailing: {
			avgIncome: 0,
			avgExpenses: 13_024,
			avgNetGain: 0,
			monthCount: 12,
			totalIncome: 0,
			totalSpending: 156_288,
			netIncome: 0,
			savingsRate: null,
		},
		detected: {
			has401k: true,
			hasRothIra: false,
			hasHsa: false,
			hasTaxableBrokerage: true,
			annual401kContribution: 0,
			annualRothContribution: 0,
			annualHsaContribution: 0,
			annualTaxableContribution: 0,
			employerMatchUnmodeled: false,
		},
		dataStatus: "ready",
		mortgagePayoffAge: 31,
		primaryResidenceEquity: 0,
		scenarioRatesSource: "ForecastAssumptions",
		spendingExclusions: {
			healthcareMonthly: 500,
			housingDebtServiceMonthly: 2_400,
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

function cashInOf(year: RetirementProjectionYear): number {
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

function assertYearIdentities(
	year: RetirementProjectionYear,
	fixture: string,
): void {
	const cashIn = cashInOf(year);
	const leftover = calculateCashFlowLeftover({
		cashIn,
		cashOut: year.totalOutflow,
		cashFlowTax: year.cashFlowTax,
	});
	assert.ok(
		Math.abs(year.cashFlowLeftover - leftover) < 0.01,
		`${fixture} age ${year.age}: leftover ${year.cashFlowLeftover} vs ${leftover}`,
	);
	const partitioned =
		year.essentialExpenses + year.flexibleExpenses + year.oneTimeExpenses;
	assert.ok(
		Math.abs(partitioned - year.totalOutflow) < 0.01,
		`${fixture} age ${year.age}: outflow split ${partitioned} vs ${year.totalOutflow}`,
	);
}

describe("golden ledger fixtures", () => {
	it("locks Tyler's dual-earner leftover after the spouse stops working", () => {
		const household = base();
		const { inputs } = applyLevers(baselineFor(household), [
			{
				id: "spouse-out",
				enabled: true,
				sortOrder: 0,
				lever: { type: "spouse_stops_working", params: { atAge: 30 } },
			},
		]);
		const years = projectRetirement(inputs).years;
		for (const year of years) assertYearIdentities(year, "tyler");

		const at30 = years.find((year) => year.age === 30);
		assert.ok(at30);
		assert.equal(at30.spouseEmploymentIncome, 0);
		assert.ok(Math.abs(at30.employmentIncome - 10_000) < 1);
		assert.ok(Math.abs(at30.cashFlowLeftover - (10_000 - 13_024 * 12)) < 5);
		assert.ok(Math.abs(at30.cashFlowLeftover / 12 - -12_191) < 5);
		assert.equal(at30.contributionsCash, 0);
		assert.ok(at30.withdrawalsTaxable > 0);
	});

	it("locks inflation, planned 401(k), RMD, two mortgages, and other-debt together", () => {
		const years = projectRetirement(
			base({
				currentAge: 60,
				spouseCurrentAge: null,
				filingStatus: "single",
				annualEmploymentIncome: 80_000,
				annualSpouseEmploymentIncome: 0,
				spouseEmploymentEndsAtAge: null,
				retirementAge: 66,
				employmentEndsAtAge: 66,
				contributionsStopAge: 66,
				inflationRate: 0.02,
				incomeGrowthRate: 0.02,
				expenseGrowthRate: 0.02,
				contributionGrowthRate: 0.02,
				returnRate: 0.05,
				cashYield: 0.03,
				rmdStartAge: 73,
				preRetirementAnnualSpending: 40_000,
				preRetirementAnnualHealthcare: 0,
				retirementMonthlySpending: 4_000,
				annualHealthcareSpending: 0,
				contributions: {
					taxable: 0,
					taxDeferred: 23_000,
					taxFree: 0,
				},
				balances: {
					cash: 20_000,
					taxable: 100_000,
					taxDeferred: 800_000,
					taxFree: 50_000,
				},
				properties: [
					home({
						id: "primary",
						loanBalance: 120_000,
						remainingTermMonths: 60,
						monthlyPayment: 2_000,
						monthlyExpenses: 300,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.02,
						annualInterestRate: 0.04,
					}),
					home({
						id: "rental",
						name: "Rental",
						isPrimaryResidence: false,
						value: 300_000,
						loanBalance: 150_000,
						remainingTermMonths: 180,
						monthlyPayment: 1_200,
						monthlyRent: 2_000,
						monthlyExpenses: 500,
						vacancyRate: 0.05,
						appreciationRate: 0.03,
						expenseGrowthRate: 0.02,
						annualInterestRate: 0.05,
					}),
				],
				liabilities: [
					{
						id: "auto",
						name: "Auto",
						balance: 12_000,
						annualInterestRate: 0.06,
						monthlyPayment: 400,
						remainingTermMonths: 30,
					},
				],
			}),
		).years;

		assert.ok(years.length > 20);
		for (const year of years) assertYearIdentities(year, "interaction");

		const working = years.find((year) => year.age === 60);
		const retired = years.find((year) => year.age === 66);
		const rmdYear = years.find((year) => year.age === 73);
		assert.ok(working && retired && rmdYear);
		assert.equal(working.isRetired, false);
		assert.ok(working.contributionsTaxDeferred > 0);
		assert.ok(working.housingExpenses > 0);
		assert.equal(retired.isRetired, true);
		assert.ok(rmdYear.requiredMinimumDistribution > 0);
	});
});
