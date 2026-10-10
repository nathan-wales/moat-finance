import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyRetirementPolicies } from "@moat/contracts";
import type { RetirementBaseline } from "./build-baseline";
import { DEFAULT_WITHDRAWAL_ORDER } from "./constants";
import {
	buildRetirementSetupChecklist,
	hasBirthYearForSetup,
	missingInputsFromChecklist,
} from "./setup-checklist";
import type { RetirementPlanInputs } from "./types";

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
		contributionGrowthRate: 0.03,
		expenseGrowthRate: 0.025,
		cashYield: 0.04,
		volatility: 0.13,
		otherDebt: 0,
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
			isEstimated: true,
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
			socialSecurityMonthlyAtFra: null,
			hasSpouse: false,
			spouseBirthYear: null,
			spouseCurrentAge: null,
			spouseRetirementAge: null,
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

describe("buildRetirementSetupChecklist", () => {
	it("splits unsatisfied items into required and encouraged", () => {
		const checklist = buildRetirementSetupChecklist(
			baseline({
				plan: {
					...baseline().plan,
					primaryBirthYear: null,
					socialSecurityMonthlyAtFra: null,
				},
				context: {
					...baseline().context,
					currentAgeHint: null,
				},
				summary: {
					...baseline().summary,
					investmentAccountCount: 0,
					trailingMonthCount: 0,
					insurancePolicyCount: 0,
					monthlyContributions: 0,
				},
				detected: {
					...baseline().detected,
					has401k: false,
					hasRothIra: false,
					hasHsa: false,
				},
			}),
		);
		const missing = missingInputsFromChecklist(checklist);
		assert.ok(missing.some((item) => item.id === "investment_accounts"));
		assert.ok(
			missing.some((item) => item.id === "transaction_history_minimum"),
		);
		assert.ok(missing.some((item) => item.id === "birth_year"));
		assert.ok(missing.some((item) => item.id === "social_security_estimate"));
		assert.equal(
			missing.find((item) => item.id === "investment_accounts")?.urgency,
			"required",
		);
		assert.equal(
			missing.find((item) => item.id === "social_security_estimate")?.urgency,
			"encouraged",
		);
		assert.equal(
			missing.find((item) => item.id === "transaction_history_minimum")
				?.description,
			"At least one month of transactions is needed to estimate spending.",
		);
		assert.ok(
			!missing.some((item) => item.id === "transaction_history_recommended"),
		);
	});

	it("shows the 12-month encouraged row only after the 1-month gate is met", () => {
		const withOneMonth = missingInputsFromChecklist(
			buildRetirementSetupChecklist(
				baseline({
					summary: {
						...baseline().summary,
						trailingMonthCount: 1,
					},
				}),
			),
		);
		assert.ok(
			withOneMonth.some(
				(item) => item.id === "transaction_history_recommended",
			),
		);
		assert.ok(
			!withOneMonth.some((item) => item.id === "transaction_history_minimum"),
		);

		const withSixMonths = missingInputsFromChecklist(
			buildRetirementSetupChecklist(
				baseline({
					summary: {
						...baseline().summary,
						trailingMonthCount: 6,
					},
				}),
			),
		);
		assert.ok(
			withSixMonths.some(
				(item) => item.id === "transaction_history_recommended",
			),
		);
		assert.ok(
			!withSixMonths.some((item) => item.id === "transaction_history_minimum"),
		);

		const withTwelveMonths = missingInputsFromChecklist(
			buildRetirementSetupChecklist(
				baseline({
					summary: {
						...baseline().summary,
						trailingMonthCount: 12,
					},
				}),
			),
		);
		assert.ok(
			!withTwelveMonths.some(
				(item) => item.id === "transaction_history_recommended",
			),
		);
	});

	it("treats onboarding age hint as satisfying birth year", () => {
		const withHint = baseline({
			plan: {
				...baseline().plan,
				primaryBirthYear: null,
			},
			context: {
				...baseline().context,
				currentAgeHint: 40,
			},
		});
		assert.equal(hasBirthYearForSetup(withHint), true);
		const missing = missingInputsFromChecklist(
			buildRetirementSetupChecklist(withHint),
		);
		assert.ok(!missing.some((item) => item.id === "birth_year"));

		const withoutHint = baseline({
			plan: {
				...baseline().plan,
				primaryBirthYear: null,
			},
			context: {
				...baseline().context,
				currentAgeHint: null,
			},
		});
		assert.equal(hasBirthYearForSetup(withoutHint), false);
		assert.ok(
			missingInputsFromChecklist(
				buildRetirementSetupChecklist(withoutHint),
			).some((item) => item.id === "birth_year"),
		);
	});

	it("describes estimated Social Security from income", () => {
		const missing = missingInputsFromChecklist(
			buildRetirementSetupChecklist(
				baseline({
					plan: {
						...baseline().plan,
						socialSecurityMonthlyAtFra: null,
					},
					inputs: baseInputs({
						socialSecurity: {
							monthlyAtFra: 2_400,
							claimAge: 67,
							haircut: 0,
							isEstimated: true,
						},
					}),
				}),
			),
		);
		const ss = missing.find((item) => item.id === "social_security_estimate");
		assert.ok(ss);
		assert.match(ss.description, /estimating \$2,400\/mo/);
		assert.equal(ss.actionKind, "social_security");
	});
});
