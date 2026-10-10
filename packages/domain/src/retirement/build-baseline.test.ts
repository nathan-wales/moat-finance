import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ProfileLiability } from "@moat/contracts";
import { emptyRetirementPolicies } from "@moat/contracts";
import type {
	RetirementAccountSource,
	RetirementPlanningContext,
	RetirementPlanRecord,
	RetirementPropertySource,
} from "@moat/data-access";
import type { AppContext } from "../context";
import {
	buildRetirementBaseline,
	engineModeledSpendingCategoryIds,
} from "./build-baseline";
import { projectRetirement } from "./project";

const NOW = new Date("2026-06-15T00:00:00.000Z");

type SpendRow = {
	categoryId: string | null;
	categoryName: string;
	total: number;
};

type BaselineFixture = {
	plan?: Partial<RetirementPlanRecord>;
	monthCount?: number;
	monthlyExpenses?: number;
	monthlyIncome?: number;
	categorySpend?: SpendRow[];
	properties?: RetirementPropertySource[];
	liabilities?: ProfileLiability[];
	accounts?: RetirementAccountSource[];
};

const PLAN_DEFAULTS: RetirementPlanRecord = {
	id: "plan-1",
	userId: "user-1",
	primaryBirthYear: 1966,
	targetRetirementAge: 66,
	longevityAge: 90,
	socialSecurityClaimAge: 70,
	socialSecurityMonthlyAtFra: 0,
	hasSpouse: false,
	spouseBirthYear: null,
	spouseRetirementAge: null,
	spouseLongevityAge: null,
	spouseSocialSecurityClaimAge: null,
	spouseSocialSecurityMonthlyAtFra: null,
	annualEmploymentIncome: null,
	annualSpouseEmploymentIncome: null,
	confidenceTarget: 0.85,
	monteCarloTrials: 200,
	spendingStages: [],
	spendingOverrides: {},
	timelinePreferences: {},
	withdrawalOrder: ["taxable", "taxDeferred", "taxFree"],
	policies: emptyRetirementPolicies(),
};

/** Flat world: no inflation, no growth, no yield, so every row is exact. */
const PLANNING_CONTEXT: RetirementPlanningContext = {
	filingStatus: "single",
	stateTaxRate: 0,
	federalBracketHint: 0.22,
	inflationRate: 0,
	incomeGrowthRate: 0,
	investmentReturnRate: 0,
	realEstateAppreciationRate: 0,
	cashYield: 0,
	forecastStyle: "balanced",
	retirementAgeHint: 66,
	currentAgeHint: 60,
	insurancePolicies: [],
	excludedLocalPolicyCount: 0,
};

const CASH_ACCOUNT: RetirementAccountSource = {
	id: "cash-1",
	name: "Savings",
	origin: "manual",
	kind: "SAVINGS",
	taxTreatment: "taxable",
	balance: 5_000_000,
	monthlyContribution: 0,
	annualReturnRate: 0,
	isCash: true,
	isDebt: false,
	forecastInputsUserEdited: false,
};

const BROKERAGE_ACCOUNT: RetirementAccountSource = {
	id: "brokerage-1",
	name: "Brokerage",
	origin: "manual",
	kind: "BROKERAGE",
	taxTreatment: "taxable",
	balance: 1_000_000,
	monthlyContribution: 0,
	annualReturnRate: 0,
	isCash: false,
	isDebt: false,
	forecastInputsUserEdited: false,
};

function property(
	overrides: Partial<RetirementPropertySource> = {},
): RetirementPropertySource {
	return {
		id: "home",
		name: "Home",
		usageType: "primary",
		isPrimaryResidence: true,
		currentEstimatedValue: 500_000,
		currentLoanBalance: 200_000,
		interestRate: 0,
		loanTermYears: null,
		purchaseDate: null,
		remainingTermMonths: 100,
		monthlyMortgagePayment: 2_000,
		monthlyRent: null,
		otherMonthlyIncome: null,
		vacancyRate: null,
		totalMonthlyExpenses: 0,
		appreciationRate: 0,
		expenseGrowthRate: 0,
		purchasePrice: 400_000,
		linkedPlaidAccountId: null,
		...overrides,
	};
}

function makeCtx(fixture: BaselineFixture): AppContext {
	const monthCount = fixture.monthCount ?? 12;
	const monthlyExpenses = fixture.monthlyExpenses ?? 8_000;
	const monthlyIncome = fixture.monthlyIncome ?? 12_000;
	const categorySpend = fixture.categorySpend ?? [];
	const monthlyTotals = Array.from({ length: monthCount }, (_, index) => ({
		month: `2026-${String(index + 1).padStart(2, "0")}`,
		income: monthlyIncome,
		expenses: monthlyExpenses,
		net: monthlyIncome - monthlyExpenses,
	}));

	return {
		userId: "user-1",
		repositories: {
			retirement: {
				getOrCreatePlan: async () => ({
					...PLAN_DEFAULTS,
					...fixture.plan,
				}),
				listAccountSources: async () =>
					fixture.accounts ?? [CASH_ACCOUNT, BROKERAGE_ACCOUNT],
				listPropertySources: async () => fixture.properties ?? [],
				getPlanningContext: async () => PLANNING_CONTEXT,
				listSpendingCategoryPlans: async () => [],
				getBaselineVersion: async () => "v1",
				listStandingRules: async () => [],
			},
			dashboard: {
				getMonthlyTotals: async () => monthlyTotals,
				getCategoryBreakdown: async () => [],
			},
			forecasts: {
				listScenarios: async () => [],
			},
			budgets: {
				getCategoriesWithBudgets: async () =>
					categorySpend
						.filter((row) => row.categoryId !== null)
						.map((row) => ({
							categoryId: row.categoryId as string,
							categoryName: row.categoryName,
							monthlyGoal: null,
						})),
				getCategorySpendForPeriod: async () => categorySpend,
			},
			financialProfileData: {
				get: async () => ({ liabilities: fixture.liabilities ?? [] }),
			},
		},
	} as unknown as AppContext;
}

describe("buildRetirementBaseline spend composition", () => {
	it("subtracts mortgage P&I once when the loan is still alive", async () => {
		const baseline = await buildRetirementBaseline(
			makeCtx({
				monthlyExpenses: 8_000,
				categorySpend: [
					{ categoryId: "housing", categoryName: "Housing", total: 24_000 },
					{ categoryId: "groceries", categoryName: "Groceries", total: 48_000 },
					{ categoryId: "dining", categoryName: "Dining out", total: 24_000 },
				],
				properties: [property()],
			}),
			{ now: NOW },
		);

		// The payoff narrative still shows the mortgage coming off the headline.
		assert.equal(baseline.spendingPlan.estimatedRetirementMonthly, 6_000);
		assert.equal(baseline.spendingExclusions.housingDebtServiceMonthly, 2_000);
		// …but the ledger owns the loan, so living expenses only carve it once.
		assert.equal(baseline.inputs.retirementMonthlySpending, 6_000);

		const years = projectRetirement(baseline.inputs).years;
		const retiredWithMortgage = years.find((year) => year.age === 67);
		const retiredAfterPayoff = years.find((year) => year.age === 70);
		assert.ok(retiredWithMortgage && retiredAfterPayoff);

		assert.equal(retiredWithMortgage.isRetired, true);
		assert.equal(retiredWithMortgage.livingExpenses, 72_000);
		assert.equal(retiredWithMortgage.housingExpenses, 24_000);
		assert.equal(retiredWithMortgage.totalOutflow, 96_000);

		assert.equal(retiredAfterPayoff.housingExpenses, 0);
		assert.equal(retiredAfterPayoff.livingExpenses, 72_000);
		assert.equal(retiredAfterPayoff.totalOutflow, 72_000);
	});

	it("annualizes a partial history by the months actually observed", async () => {
		const baseline = await buildRetirementBaseline(
			makeCtx({
				monthCount: 6,
				monthlyExpenses: 5_000,
				monthlyIncome: 8_000,
				categorySpend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 30_000 },
				],
			}),
			{ now: NOW },
		);

		assert.equal(baseline.trailing.monthCount, 6);
		assert.equal(baseline.spendingPlan.currentMonthlySpending, 5_000);
		assert.equal(baseline.spendingPlan.trailingMonths, 6);
		assert.equal(baseline.inputs.preRetirementAnnualSpending, 60_000);
		assert.equal(baseline.inputs.annualEmploymentIncome, 96_000);
	});

	it("keeps a full-year history reading as a full year", async () => {
		const baseline = await buildRetirementBaseline(
			makeCtx({
				monthCount: 12,
				monthlyExpenses: 5_000,
				categorySpend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 60_000 },
				],
			}),
			{ now: NOW },
		);

		assert.equal(baseline.spendingPlan.currentMonthlySpending, 5_000);
		assert.equal(baseline.inputs.preRetirementAnnualSpending, 60_000);
	});

	it("carves a liability-backed spending category exactly once", async () => {
		const baseline = await buildRetirementBaseline(
			makeCtx({
				monthlyExpenses: 4_500,
				categorySpend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 48_000 },
					{ categoryId: "student", categoryName: "Student loan", total: 6_000 },
				],
				liabilities: [
					{
						id: "student-loan",
						name: "Student loan",
						type: "student",
						balance: 20_000,
						interestRate: 0,
						monthlyPayment: 500,
						includeInNetWorth: true,
						includeInForecast: true,
					},
				],
			}),
			{ now: NOW },
		);

		const studentRow = baseline.spendingPlan.categories.find(
			(row) => row.categoryId === "student",
		);
		assert.ok(studentRow);
		assert.equal(studentRow.treatment, "remains");
		assert.equal(studentRow.retirementMonthlyAmount, 500);
		assert.equal(baseline.spendingPlan.estimatedRetirementMonthly, 4_500);
		assert.equal(baseline.spendingExclusions.otherDebtServiceMonthly, 500);
		assert.equal(baseline.inputs.retirementMonthlySpending, 4_000);

		const years = projectRetirement(baseline.inputs).years;
		const whileRepaying = years.find((year) => year.age === 60);
		const afterPayoff = years.find((year) => year.age === 66);
		assert.ok(whileRepaying && afterPayoff);
		// $4,000 of living plus the $500 payment the ledger schedules itself.
		assert.equal(whileRepaying.livingExpenses, 48_000);
		assert.equal(whileRepaying.totalOutflow, 54_000);
		assert.equal(afterPayoff.livingExpenses, 48_000);
		assert.equal(afterPayoff.totalOutflow, 48_000);
	});

	it("still lets a non-modeled category stop at retirement", async () => {
		const baseline = await buildRetirementBaseline(
			makeCtx({
				monthlyExpenses: 4_500,
				categorySpend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 48_000 },
					{ categoryId: "commute", categoryName: "Commute", total: 6_000 },
				],
			}),
			{ now: NOW },
		);

		const commuteRow = baseline.spendingPlan.categories.find(
			(row) => row.categoryId === "commute",
		);
		assert.ok(commuteRow);
		assert.equal(commuteRow.treatment, "disappears");
		assert.equal(baseline.spendingPlan.estimatedRetirementMonthly, 4_000);
	});
});

describe("engineModeledSpendingCategoryIds", () => {
	const categories = [
		{ categoryId: "groceries", categoryName: "Groceries" },
		{ categoryId: "student", categoryName: "Student loan" },
		{ categoryId: "life", categoryName: "Life insurance" },
	];

	it("claims debt and premium categories only when the ledger models them", () => {
		assert.deepEqual(
			engineModeledSpendingCategoryIds({
				categories,
				modelsDebtService: true,
				modelsInsurancePremiums: true,
			}),
			["student", "life"],
		);
	});

	it("claims nothing when there is no matching schedule", () => {
		assert.deepEqual(
			engineModeledSpendingCategoryIds({
				categories,
				modelsDebtService: false,
				modelsInsurancePremiums: false,
			}),
			[],
		);
	});
});
