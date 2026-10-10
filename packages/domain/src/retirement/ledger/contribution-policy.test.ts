import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { emptyPersonContributionPolicy } from "@moat/contracts";
import { getEmployeeDeferralLimit } from "../../federal-rules";
import {
	contributionLimitsForYear,
	DEFAULT_WITHDRAWAL_ORDER,
} from "../constants";
import { projectRetirement } from "../project";
import type {
	EngineContributionPolicy,
	EnginePersonContributionPolicy,
	RetirementPlanInputs,
} from "../types";
import {
	clipResolvedContributions,
	employerMatchAmount,
	resolveContributionPolicy,
} from "./contribution-policy";

const LIMITS_2026 = contributionLimitsForYear(2026, 0);

function person(
	overrides: Partial<EnginePersonContributionPolicy> = {},
): EnginePersonContributionPolicy {
	const empty = emptyPersonContributionPolicy();
	return {
		grossAnnualCompensation: 0,
		wageTaxRate: 0.25,
		employerPlan: empty.employerPlan,
		ira: empty.ira,
		hsa: {
			mode: empty.hsa.mode,
			employeeAmount: empty.hsa.employeeAmount,
			employerAmount: empty.hsa.employerAmount,
			coverage: empty.hsa.coverage,
		},
		taxableMonthly: 0,
		...overrides,
	};
}

describe("employerMatchAmount", () => {
	const tiers = [
		{ matchRate: 1, upToPercent: 0.03 },
		{ matchRate: 0.5, upToPercent: 0.02 },
	];

	it("matches 100% of the first 3% and 50% of the next 1% at a 4% deferral", () => {
		assert.equal(
			employerMatchAmount({
				salary: 200_000,
				deferralPercentOfSalary: 0.04,
				tiers,
			}),
			7_000,
		);
	});

	it("caps at the two-tier total once the deferral clears both tiers", () => {
		assert.equal(
			employerMatchAmount({
				salary: 200_000,
				deferralPercentOfSalary: 0.1,
				tiers,
			}),
			8_000,
		);
	});
});

describe("resolveContributionPolicy", () => {
	it("applies catch-up at 50 and indexes the max-allowed limit", () => {
		const policy: EngineContributionPolicy = {
			primary: person({
				grossAnnualCompensation: 200_000,
				employerPlan: {
					mode: "maxAllowed",
					amount: null,
					rothShare: 0,
					match: [],
					profitSharingPercentOfSalary: 0,
				},
			}),
			spouse: null,
			autoApplyCatchUp: true,
			contributionsStopAge: null,
		};
		const at49 = resolveContributionPolicy({
			policy,
			age: 49,
			spouseAge: null,
			primaryWorking: true,
			spouseWorking: false,
			taxYear: 2026,
			inflationRate: 0,
		});
		const at50 = resolveContributionPolicy({
			policy,
			age: 50,
			spouseAge: null,
			primaryWorking: true,
			spouseWorking: false,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.equal(at49.taxDeferred.amount, LIMITS_2026.employee401k);
		assert.equal(
			at50.taxDeferred.amount,
			LIMITS_2026.employee401k + LIMITS_2026.employee401kCatchUp,
		);

		const at60 = resolveContributionPolicy({
			policy,
			age: 60,
			spouseAge: null,
			primaryWorking: true,
			spouseWorking: false,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.equal(
			at60.taxDeferred.amount,
			getEmployeeDeferralLimit({ taxYear: 2026, age: 60 }).amount,
		);

		const year20 = contributionLimitsForYear(2046, 0.03);
		assert.ok(year20.employee401k > LIMITS_2026.employee401k);
		const atYear20 = resolveContributionPolicy({
			policy,
			age: 49,
			spouseAge: null,
			primaryWorking: true,
			spouseWorking: false,
			taxYear: 2046,
			inflationRate: 0.03,
		});
		assert.equal(atYear20.taxDeferred.amount, year20.employee401k);
	});

	it("lets the spouse keep contributing after the primary stops working", () => {
		const policy: EngineContributionPolicy = {
			primary: person({
				grossAnnualCompensation: 0,
				employerPlan: {
					mode: "fixedAnnual",
					amount: 20_000,
					rothShare: 0,
					match: [],
					profitSharingPercentOfSalary: 0,
				},
			}),
			spouse: person({
				grossAnnualCompensation: 100_000,
				employerPlan: {
					mode: "fixedAnnual",
					amount: 15_000,
					rothShare: 0,
					match: [],
					profitSharingPercentOfSalary: 0,
				},
			}),
			autoApplyCatchUp: true,
			contributionsStopAge: null,
		};
		const resolved = resolveContributionPolicy({
			policy,
			age: 66,
			spouseAge: 60,
			primaryWorking: false,
			spouseWorking: true,
			taxYear: 2026,
			inflationRate: 0,
		});
		assert.equal(resolved.taxDeferred.amount, 15_000);
	});
});

describe("contribution cash-flow rules", () => {
	function household(
		overrides: Partial<RetirementPlanInputs> = {},
	): RetirementPlanInputs {
		return {
			currentYear: 2026,
			currentAge: 40,
			primaryBirthYear: 1986,
			spouseCurrentAge: null,
			retirementAge: 65,
			spouseRetirementAge: null,
			longevityAge: 70,
			balances: { cash: 50_000, taxable: 0, taxDeferred: 0, taxFree: 0 },
			contributions: { taxable: 0, taxDeferred: 0, taxFree: 0 },
			contributionsStopAge: 65,
			annualEmploymentIncome: 10_000,
			annualSpouseEmploymentIncome: 0,
			employmentEndsAtAge: 65,
			spouseEmploymentEndsAtAge: null,
			returnRate: 0,
			inflationRate: 0,
			incomeGrowthRate: 0,
			cashYield: 0,
			volatility: 0,
			preRetirementAnnualSpending: 13_024 * 12,
			preRetirementAnnualNetIncome: 0,
			preRetirementAnnualHealthcare: 0,
			retirementMonthlySpending: 13_024,
			essentialShare: 1,
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
			filingStatus: "single",
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

	it("does not let employer match move cashFlowLeftover", () => {
		const employeeOnly: EngineContributionPolicy = {
			primary: person({
				grossAnnualCompensation: 200_000,
				employerPlan: {
					mode: "fixedAnnual",
					amount: 8_000,
					rothShare: 0,
					match: [],
					profitSharingPercentOfSalary: 0,
				},
			}),
			spouse: null,
			autoApplyCatchUp: true,
			contributionsStopAge: null,
		};
		const withMatch: EngineContributionPolicy = {
			...employeeOnly,
			primary: person({
				grossAnnualCompensation: 200_000,
				employerPlan: {
					mode: "fixedAnnual",
					amount: 8_000,
					rothShare: 0,
					match: [{ matchRate: 1, upToPercent: 0.03 }],
					profitSharingPercentOfSalary: 0,
				},
			}),
		};
		const without = projectRetirement(
			household({
				annualEmploymentIncome: 80_000,
				preRetirementAnnualSpending: 40_000,
				retirementMonthlySpending: 3_000,
				contributionPolicy: employeeOnly,
			}),
		).years[0];
		const matched = projectRetirement(
			household({
				annualEmploymentIncome: 80_000,
				preRetirementAnnualSpending: 40_000,
				retirementMonthlySpending: 3_000,
				contributionPolicy: withMatch,
			}),
		).years[0];
		assert.ok(without && matched);
		assert.equal(without.employerContributions, 0);
		assert.ok(matched.employerContributions > 0);
		assert.ok(
			Math.abs(matched.cashFlowLeftover - without.cashFlowLeftover) < 0.01,
		);
	});

	it("keeps the locked leftover when the contribution policy is empty", () => {
		const years = projectRetirement(
			household({
				annualEmploymentIncome: 10_000,
				annualSpouseEmploymentIncome: 0,
				spouseCurrentAge: 40,
				spouseEmploymentEndsAtAge: 30,
				preRetirementAnnualSpending: (13_024 - 0) * 12,
				retirementMonthlySpending: 13_024,
			}),
		).years;
		const at40 = years.find((year) => year.age === 40);
		assert.ok(at40);
		assert.equal(at40.contributionsCash, 0);
		assert.equal(at40.contributionsTaxDeferred, 0);
		assert.ok(at40.livingExpenses >= 13_024 * 12 - 1);
		assert.ok(Math.abs(at40.cashFlowLeftover - (10_000 - 13_024 * 12)) < 5);
	});

	it("lets the spouse keep contributing after the primary's job ends", () => {
		const years = projectRetirement(
			household({
				currentAge: 65,
				longevityAge: 68,
				employmentEndsAtAge: 65,
				spouseCurrentAge: 60,
				spouseEmploymentEndsAtAge: 70,
				annualEmploymentIncome: 50_000,
				annualSpouseEmploymentIncome: 80_000,
				contributionsStopAge: 65,
				preRetirementAnnualSpending: 40_000,
				retirementMonthlySpending: 3_000,
				contributionPolicy: {
					primary: person({
						grossAnnualCompensation: 50_000,
						employerPlan: {
							mode: "none",
							amount: null,
							rothShare: 0,
							match: [],
							profitSharingPercentOfSalary: 0,
						},
					}),
					spouse: person({
						grossAnnualCompensation: 80_000,
						employerPlan: {
							mode: "fixedAnnual",
							amount: 15_000,
							rothShare: 0,
							match: [],
							profitSharingPercentOfSalary: 0,
						},
					}),
					autoApplyCatchUp: true,
					contributionsStopAge: null,
				},
			}),
		).years;
		const at65 = years.find((year) => year.age === 65);
		assert.ok(at65);
		assert.equal(at65.contributionsTaxDeferred, 15_000);
	});

	it("grows percent-of-salary contributions with income growth", () => {
		const policy: EngineContributionPolicy = {
			primary: person({
				grossAnnualCompensation: 100_000,
				employerPlan: {
					mode: "percentOfSalary",
					amount: 0.1,
					rothShare: 0,
					match: [],
					profitSharingPercentOfSalary: 0,
				},
			}),
			spouse: null,
			autoApplyCatchUp: true,
			contributionsStopAge: null,
		};
		const years = projectRetirement(
			household({
				currentAge: 40,
				longevityAge: 43,
				annualEmploymentIncome: 80_000,
				incomeGrowthRate: 0.05,
				preRetirementAnnualSpending: 40_000,
				retirementMonthlySpending: 3_000,
				contributionPolicy: policy,
			}),
		).years;
		const year0 = years[0];
		const year1 = years[1];
		assert.ok(year0 && year1);
		assert.ok(Math.abs(year0.contributionsTaxDeferred - 10_000) < 1);
		assert.ok(Math.abs(year1.contributionsTaxDeferred - 10_500) < 1);
	});

	it("does not credit employer match when leftover cannot fund the deferral", () => {
		const withMatch: EngineContributionPolicy = {
			primary: person({
				grossAnnualCompensation: 200_000,
				employerPlan: {
					mode: "fixedAnnual",
					amount: 8_000,
					rothShare: 0,
					match: [{ matchRate: 1, upToPercent: 0.03 }],
					profitSharingPercentOfSalary: 0,
				},
			}),
			spouse: null,
			autoApplyCatchUp: true,
			contributionsStopAge: null,
		};
		const year = projectRetirement(
			household({
				annualEmploymentIncome: 10_000,
				preRetirementAnnualSpending: 13_024 * 12,
				retirementMonthlySpending: 13_024,
				contributionPolicy: withMatch,
			}),
		).years[0];
		assert.ok(year);
		assert.ok(year.cashFlowLeftover < 0);
		assert.equal(year.contributionsTaxDeferred, 0);
		assert.equal(year.employerContributions, 0);
	});

	it("prices a traditional deferral at its after-tax cost, not a full dollar", () => {
		const clipped = clipResolvedContributions({
			leftover: 7_500,
			contributing: true,
			resolved: {
				taxDeferred: { amount: 10_000, cashCost: 7_500 },
				taxFree: { amount: 0, cashCost: 0 },
				taxable: { amount: 0, cashCost: 0 },
				employerTaxDeferred: 5_000,
				employeeDeferral: 10_000,
			},
		});
		assert.equal(clipped.taxDeferred, 10_000);
		assert.equal(clipped.cashSpent, 7_500);
		assert.equal(clipped.residual, 0);
	});
});
