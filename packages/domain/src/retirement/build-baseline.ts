// Assembles the live baseline. This runs on every request — there is no
// snapshot of the user's finances anywhere in a saved scenario, which is what
// makes a 60-day-old scenario reflect today's balances with no user action.

import type {
	RetirementBaselineSummary,
	RetirementDataStatus,
	RetirementPlanSettings,
	RetirementPolicies,
	RetirementSpendingPlan,
	RetirementStandingRule,
	RetirementStandingRuleSuggestion,
	RetirementTaxTreatment,
} from "@moat/contracts";
import { emptyRetirementPolicies } from "@moat/contracts";
import type {
	RetirementAccountSource,
	RetirementPlanningContext,
	RetirementPropertySource,
} from "@moat/data-access";
import { startOfMonth, subMonths } from "date-fns";
import type { AppContext } from "../context";
import { getNetIncome } from "../dashboard/get-net-income";
import { trailingCashFlowRange } from "../dashboard/trailing-cash-flow-range";
import { deriveMortgageAdvancedDetails } from "../financial-profile/derive-mortgage-details";
import { detectRecurringExpenses } from "../spending/detect-recurring-expenses";
import { applyPolicies } from "./apply-policies";
import {
	assembleProjectedLiabilities,
	liabilityBalancesTotal,
} from "./assemble-liabilities";
import {
	annualizeWindowTotal,
	monthlyAmountFromWindowTotal,
	type SpendCarveOuts,
	toEngineMonthlySpend,
	toHeadlineMonthlySpend,
} from "./compose-spend";
import {
	ASSUMED_EMPLOYER_MATCH_PERCENT,
	ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY,
	DEFAULT_ESSENTIAL_SHARE,
	DEFAULT_WITHDRAWAL_ORDER,
	getTaxYear,
	MINIMUM_HISTORY_MONTHS,
	normalizeFilingStatus,
	PORTFOLIO_PROFILES,
	PRE_MEDICARE_MONTHLY_PREMIUM,
	portfolioPostureFromStyle,
	rmdStartAgeForBirthYear,
	SPENDING_BASELINE_MONTHS,
} from "./constants";
import { deriveSmartDefaults } from "./defaults";
import { deriveRecurringExpenseSuggestions } from "./defaults/derive-rule-suggestions";
import {
	expenseMonthRowsFromTransactions,
	modalStateCodeFromTransactions,
} from "./defaults/from-transactions";
import { grossUpNetIncome } from "./defaults/gross-up";
import type {
	DefaultSignals,
	DetectedAccountSignal,
	DetectedRetirementAccountKind,
} from "./defaults/signals";
import { liquidTypeMixFromAccounts } from "./liquid-type-mix";
import { retirementSavingsNet } from "./retirement-savings-net";
import { toStandingRule } from "./retirementStandingRules";
import { estimateFraBenefitFromIncome } from "./social-security";
import {
	essentialShareOf,
	mortgagePayoffReductionOf,
	translateSpending,
} from "./spending-translation";
import { applyStandingRules } from "./standing-rules";
import type {
	InsurancePremium,
	LifeCoverage,
	LtcCoverage,
	ProjectedProperty,
	RetirementBucketReturns,
	RetirementPlanInputs,
} from "./types";

export type { SpendCarveOuts };
export { toEngineMonthlySpend, toHeadlineMonthlySpend };

export type DetectedSavings = {
	has401k: boolean;
	hasRothIra: boolean;
	hasHsa: boolean;
	hasTaxableBrokerage: boolean;
	annual401kContribution: number;
	annualRothContribution: number;
	annualHsaContribution: number;
	annualTaxableContribution: number;
	/** True when a 401(k) exists but no employer match is reflected anywhere. */
	employerMatchUnmodeled: boolean;
};

/**
 * Balance-weighted expected return per tax bucket. Empty buckets fall back to
 * the global scenario/profile rate so levers still have a sensible default.
 */
export function weightedBucketReturns(
	accounts: RetirementAccountSource[],
	fallbackRate: number,
): RetirementBucketReturns {
	const weight = { taxable: 0, taxDeferred: 0, taxFree: 0 };
	const weighted = { taxable: 0, taxDeferred: 0, taxFree: 0 };
	for (const account of accounts) {
		if (account.isDebt || account.isCash) continue;
		const balance = Math.max(0, account.balance);
		if (balance <= 0) continue;
		weight[account.taxTreatment] += balance;
		weighted[account.taxTreatment] += balance * account.annualReturnRate;
	}
	return {
		taxable:
			weight.taxable > 0 ? weighted.taxable / weight.taxable : fallbackRate,
		taxDeferred:
			weight.taxDeferred > 0
				? weighted.taxDeferred / weight.taxDeferred
				: fallbackRate,
		taxFree:
			weight.taxFree > 0 ? weighted.taxFree / weight.taxFree : fallbackRate,
	};
}

/**
 * Balance-weighted yield for checking/savings. Only user-set rates count;
 * Plaid's schema default 0.07 is never treated as a cash yield. Empty mix
 * falls back to the household cash yield.
 */
export function weightedCashYield(
	accounts: RetirementAccountSource[],
	fallbackRate: number,
): number {
	let weight = 0;
	let weighted = 0;
	for (const account of accounts) {
		if (!account.isCash || account.isDebt) continue;
		const balance = Math.max(0, account.balance);
		if (balance <= 0) continue;
		if (!account.forecastInputsUserEdited) continue;
		weight += balance;
		weighted += balance * account.annualReturnRate;
	}
	return weight > 0 ? weighted / weight : fallbackRate;
}

export type RetirementBaseline = {
	baselineVersion: string;
	refreshedAt: string;
	plan: RetirementPlanSettings;
	inputs: RetirementPlanInputs;
	summary: RetirementBaselineSummary;
	accounts: RetirementAccountSource[];
	properties: RetirementPropertySource[];
	context: RetirementPlanningContext;
	spendingPlan: RetirementSpendingPlan;
	trailing: {
		avgIncome: number;
		avgExpenses: number;
		avgNetGain: number;
		monthCount: number;
		totalIncome: number;
		totalSpending: number;
		netIncome: number;
		savingsRate: number | null;
	};
	detected: DetectedSavings;
	dataStatus: RetirementDataStatus;
	/** Payoff age of the primary residence mortgage, when there is one. */
	mortgagePayoffAge: number | null;
	primaryResidenceEquity: number;
	scenarioRatesSource: string;
	/**
	 * Housing debt service, other-debt service, property operating costs,
	 * healthcare, and insurance are projected from their own schedules, so they
	 * are carved out of `retirementMonthlySpending` and pre-retirement living
	 * expenses. Levers that set a headline spending figure must subtract the
	 * same amounts.
	 */
	spendingExclusions: SpendCarveOuts;
	/** Monthly benefit an existing disability policy would pay, if any. */
	disabilityMonthlyBenefit: number;
	standingRules: RetirementStandingRule[];
	/** Detected but unadopted. Never compiled into the projection. */
	standingRuleSuggestions: RetirementStandingRuleSuggestion[];
	/** Live derived defaults for the drawer. Never applied until the user saves. */
	policyDefaults: RetirementPolicies;
};

export function isRentalIncomeCategory(name: string): boolean {
	const normalized = name.trim().toLowerCase();
	return normalized === "rent" || normalized.includes("rental");
}

const DEBT_SERVICE_CATEGORY_PATTERN =
	/loan|debt|mortgage|credit card|line of credit|financing/i;
const INSURANCE_PREMIUM_CATEGORY_PATTERN = /insurance|premium/i;

/**
 * Spending categories the ledger projects from its own schedule rather than
 * from the retirement translation. Debt service and insurance premiums are
 * carved out of living expenses as an aggregate, so letting the translation
 * also drop or scale them ("student loan disappears in retirement") removes
 * the same dollars twice.
 */
export function engineModeledSpendingCategoryIds(input: {
	categories: Array<{ categoryId: string; categoryName: string }>;
	modelsDebtService: boolean;
	modelsInsurancePremiums: boolean;
}): string[] {
	const ids: string[] = [];
	for (const category of input.categories) {
		const isDebtService =
			input.modelsDebtService &&
			DEBT_SERVICE_CATEGORY_PATTERN.test(category.categoryName);
		const isInsurancePremium =
			input.modelsInsurancePremiums &&
			INSURANCE_PREMIUM_CATEGORY_PATTERN.test(category.categoryName);
		if (isDebtService || isInsurancePremium) ids.push(category.categoryId);
	}
	return ids;
}

/**
 * Turns Insights income into an annual employment run-rate.
 *
 * Insights cards report the selected period (often one month). The engine
 * needs a yearly salary. Average the months that actually have income so a
 * recently connected account isn't treated as a $0 year.
 *
 * Only rental categories are carved out — those cash flows are projected from
 * properties. Investment-categorized income (Plaid maps dividends, interest,
 * and gains to "Investments") still appears on the Insights total-income card,
 * so dropping it here made employment show $0 while Insights did not.
 */
export function annualizeInsightsEmploymentIncome(input: {
	monthlyTotals: Array<{ income: number }>;
	incomeByCategory: Array<{ category: string; total: number }>;
}): number {
	const monthsWithIncome = input.monthlyTotals.filter((row) => row.income > 0);
	if (monthsWithIncome.length === 0) return 0;

	const trailingIncome = input.monthlyTotals.reduce(
		(sum, row) => sum + row.income,
		0,
	);
	if (trailingIncome <= 0) return 0;

	const rental = input.incomeByCategory.reduce((sum, row) => {
		if (isRentalIncomeCategory(row.category)) {
			return sum + Math.max(0, row.total);
		}
		return sum;
	}, 0);
	const employmentShare = Math.max(0, 1 - rental / trailingIncome);
	const averageMonthlyIncome =
		monthsWithIncome.reduce((sum, row) => sum + row.income, 0) /
		monthsWithIncome.length;
	return averageMonthlyIncome * 12 * employmentShare;
}

export function resolveEmploymentIncome(input: {
	hasSpouse: boolean;
	trailingAnnualIncome: number;
	storedPrimary?: number | null;
	storedSpouse?: number | null;
}): { primary: number; spouse: number } {
	const total = Math.max(0, input.trailingAnnualIncome);
	if (!input.hasSpouse || total <= 0) {
		return { primary: total, spouse: 0 };
	}
	const storedPrimary = input.storedPrimary;
	const storedSpouse = input.storedSpouse;
	if (storedPrimary == null && storedSpouse == null) {
		return { primary: total, spouse: 0 };
	}
	const primaryStored = Math.max(0, storedPrimary ?? 0);
	const spouseStored = Math.max(0, storedSpouse ?? 0);
	const storedTotal = primaryStored + spouseStored;
	if (storedTotal <= 0) {
		return { primary: total, spouse: 0 };
	}
	const primary = (total * primaryStored) / storedTotal;
	return { primary, spouse: total - primary };
}

export type BuildRetirementBaselineInput = {
	now?: Date;
};

function toWithdrawalOrder(value: unknown): RetirementTaxTreatment[] {
	if (!Array.isArray(value) || value.length !== 3) {
		return [...DEFAULT_WITHDRAWAL_ORDER];
	}
	const allowed: RetirementTaxTreatment[] = [
		"taxable",
		"taxDeferred",
		"taxFree",
	];
	const filtered = value.filter((entry): entry is RetirementTaxTreatment =>
		allowed.includes(entry as RetirementTaxTreatment),
	);
	if (filtered.length !== 3) return [...DEFAULT_WITHDRAWAL_ORDER];
	return filtered;
}

/** Remaining months on a loan, derived when the stored term is missing. */
function remainingTermMonths(
	property: RetirementPropertySource,
	now: Date,
): number {
	if (
		property.remainingTermMonths !== null &&
		property.remainingTermMonths > 0
	) {
		return property.remainingTermMonths;
	}
	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: property.interestRate,
		currentLoanBalance: property.currentLoanBalance,
		loanTermYears: property.loanTermYears,
		now,
		purchaseDate: property.purchaseDate,
	});
	if (derived.remainingTermMonths != null && derived.remainingTermMonths > 0) {
		return derived.remainingTermMonths;
	}
	if (property.currentLoanBalance <= 0) return 0;
	const payment = property.monthlyMortgagePayment ?? 0;
	const rate = (property.interestRate ?? 0) / 12;
	if (payment <= 0) return 0;
	if (rate <= 0) return Math.ceil(property.currentLoanBalance / payment);
	const interestOnly = property.currentLoanBalance * rate;
	if (payment <= interestOnly) return 480;
	const months =
		-Math.log(1 - (rate * property.currentLoanBalance) / payment) /
		Math.log(1 + rate);
	return Math.min(480, Math.max(1, Math.ceil(months)));
}

function monthlyMortgagePayment(
	property: RetirementPropertySource,
	now: Date,
): number {
	if (
		property.monthlyMortgagePayment !== null &&
		property.monthlyMortgagePayment > 0
	) {
		return property.monthlyMortgagePayment;
	}
	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: property.interestRate,
		currentLoanBalance: property.currentLoanBalance,
		loanTermYears: property.loanTermYears,
		now,
		purchaseDate: property.purchaseDate,
	});
	return derived.monthlyMortgagePayment ?? 0;
}

function toProjectedProperty(
	property: RetirementPropertySource,
	fallbackAppreciation: number,
	fallbackExpenseGrowth: number,
	now: Date,
): ProjectedProperty {
	const monthlyExpenses = property.totalMonthlyExpenses ?? 0;
	return {
		id: property.id,
		name: property.name,
		isPrimaryResidence: property.isPrimaryResidence,
		value: property.currentEstimatedValue,
		loanBalance: property.currentLoanBalance,
		annualInterestRate: property.interestRate ?? 0,
		remainingTermMonths: remainingTermMonths(property, now),
		monthlyPayment: monthlyMortgagePayment(property, now),
		monthlyRent:
			(property.monthlyRent ?? 0) + (property.otherMonthlyIncome ?? 0),
		monthlyExpenses,
		vacancyRate: property.vacancyRate ?? 0,
		appreciationRate: property.appreciationRate ?? fallbackAppreciation,
		expenseGrowthRate: property.expenseGrowthRate ?? fallbackExpenseGrowth,
		extraMonthlyPayment: 0,
		sellAtAge: null,
		acquiredAtAge: null,
		downPayment: 0,
		costBasis: property.purchasePrice ?? property.currentEstimatedValue,
	};
}

function detectSavings(accounts: RetirementAccountSource[]): DetectedSavings {
	let annual401kContribution = 0;
	let annualRothContribution = 0;
	let annualHsaContribution = 0;
	let annualTaxableContribution = 0;
	let has401k = false;
	let hasRothIra = false;
	let hasHsa = false;
	let hasTaxableBrokerage = false;

	for (const account of accounts) {
		const kind = account.kind.toUpperCase();
		const annual = account.monthlyContribution * 12;
		if (kind.includes("401") || kind.includes("403")) {
			has401k = true;
			annual401kContribution += annual;
		} else if (kind.includes("ROTH")) {
			hasRothIra = true;
			annualRothContribution += annual;
		} else if (kind.includes("HSA")) {
			hasHsa = true;
			annualHsaContribution += annual;
		} else if (account.taxTreatment === "taxable" && !account.isCash) {
			hasTaxableBrokerage = true;
			annualTaxableContribution += annual;
		}
	}

	return {
		has401k,
		hasRothIra,
		hasHsa,
		hasTaxableBrokerage,
		annual401kContribution,
		annualRothContribution,
		annualHsaContribution,
		annualTaxableContribution,
		employerMatchUnmodeled: has401k,
	};
}

function accountKind(
	account: RetirementAccountSource,
): DetectedRetirementAccountKind {
	const kind = account.kind.toUpperCase();
	if (kind.includes("401") || kind.includes("403") || kind.includes("457")) {
		return "employerPlan";
	}
	if (kind.includes("HSA")) return "hsa";
	if (kind.includes("ROTH")) return "rothIra";
	if (kind.includes("IRA")) return "traditionalIra";
	return "brokerage";
}

function accountSignals(
	accounts: RetirementAccountSource[],
): DetectedAccountSignal[] {
	return accounts
		.filter((account) => !account.isDebt)
		.map((account) => ({
			kind: accountKind(account),
			balance: Math.max(0, account.balance),
			annualContribution:
				account.monthlyContribution > 0
					? account.monthlyContribution * 12
					: null,
			institutionLabel: account.name,
		}));
}

export async function buildRetirementBaseline(
	ctx: AppContext,
	input: BuildRetirementBaselineInput = {},
): Promise<RetirementBaseline> {
	const repo = ctx.repositories.retirement;
	if (!repo) {
		throw new Error("Retirement repository is not configured");
	}
	const now = input.now ?? new Date();
	const currentYear = now.getFullYear();

	const cashFlowRange = trailingCashFlowRange(SPENDING_BASELINE_MONTHS, now);
	const spendingStart = cashFlowRange.startDate;

	const [
		planRecord,
		accounts,
		propertySources,
		planningContext,
		spendingOverrides,
		baselineVersion,
		netIncomeSummary,
		activeScenarios,
		categoryBudgets,
		categorySpend,
		incomeByCategory,
		profileData,
		standingRuleRecords,
		recentTransactions,
	] = await Promise.all([
		repo.getOrCreatePlan({ userId: ctx.userId }),
		repo.listAccountSources({ userId: ctx.userId }),
		repo.listPropertySources({ userId: ctx.userId }),
		repo.getPlanningContext({ userId: ctx.userId }),
		repo.listSpendingCategoryPlans({ userId: ctx.userId }),
		repo.getBaselineVersion({ userId: ctx.userId }),
		getNetIncome(ctx, {
			startDate: cashFlowRange.startDate,
			endDate: cashFlowRange.endDate,
			now,
		}),
		ctx.repositories.forecasts.listScenarios({ userId: ctx.userId }),
		ctx.repositories.budgets.getCategoriesWithBudgets({ userId: ctx.userId }),
		ctx.repositories.budgets.getCategorySpendForPeriod({
			userId: ctx.userId,
			startDate: spendingStart,
			endDate: cashFlowRange.endDate,
		}),
		ctx.repositories.dashboard.getCategoryBreakdown({
			userId: ctx.userId,
			startDate: spendingStart,
			endDate: cashFlowRange.endDate,
			type: "INCOME",
		}),
		ctx.repositories.financialProfileData?.get({ userId: ctx.userId }) ??
			Promise.resolve(null),
		repo.listStandingRules({ userId: ctx.userId }),
		ctx.repositories.transactions?.listRecent
			? ctx.repositories.transactions.listRecent({
					userId: ctx.userId,
					limit: 4000,
					startDate: startOfMonth(subMonths(now, 5)),
				})
			: Promise.resolve([]),
	]);

	const trailing = {
		avgIncome:
			netIncomeSummary.totalIncome / Math.max(1, netIncomeSummary.monthCount),
		avgExpenses:
			netIncomeSummary.totalSpending / Math.max(1, netIncomeSummary.monthCount),
		avgNetGain:
			netIncomeSummary.netIncome / Math.max(1, netIncomeSummary.monthCount),
		monthCount: netIncomeSummary.monthCount,
		totalIncome: netIncomeSummary.totalIncome,
		totalSpending: netIncomeSummary.totalSpending,
		netIncome: netIncomeSummary.netIncome,
		savingsRate: netIncomeSummary.savingsRate,
	};

	const activeScenario =
		activeScenarios.find((scenario) => scenario.isActive) ?? null;
	const scenarioRatesSource = activeScenario
		? `ForecastScenario:${activeScenario.name}`
		: "ForecastAssumptions";

	const posture = portfolioPostureFromStyle(planningContext.forecastStyle);
	const profile = PORTFOLIO_PROFILES[posture];

	const returnRate =
		activeScenario?.investmentReturn ??
		planningContext.investmentReturnRate ??
		profile.returnRate;
	const inflationRate =
		activeScenario?.inflationRate ?? planningContext.inflationRate;
	const incomeGrowthRate =
		activeScenario?.salaryGrowth ?? planningContext.incomeGrowthRate;
	const contributionGrowthRate =
		activeScenario?.contributionChange ?? incomeGrowthRate;
	const expenseGrowthRate = activeScenario?.expenseGrowth ?? inflationRate;

	// ─── Ages ────────────────────────────────────────────────────────────────
	const derivedAge =
		planRecord.primaryBirthYear !== null
			? currentYear - planRecord.primaryBirthYear
			: (planningContext.currentAgeHint ?? 40);
	const currentAge = Math.max(18, Math.min(100, derivedAge));
	const targetRetirementAge = Math.max(
		currentAge + 1,
		planRecord.targetRetirementAge,
	);
	const longevityAge = Math.max(
		targetRetirementAge + 1,
		planRecord.longevityAge,
	);
	const spouseCurrentAge =
		planRecord.hasSpouse && planRecord.spouseBirthYear !== null
			? currentYear - planRecord.spouseBirthYear
			: planRecord.hasSpouse
				? currentAge
				: null;

	// ─── Balances by tax treatment ───────────────────────────────────────────
	const balances = { cash: 0, taxable: 0, taxDeferred: 0, taxFree: 0 };
	const contributions = { taxable: 0, taxDeferred: 0, taxFree: 0 };
	for (const account of accounts) {
		if (account.isDebt) continue;
		if (account.isCash) {
			balances.cash += Math.max(0, account.balance);
			continue;
		}
		balances[account.taxTreatment] += Math.max(0, account.balance);
		contributions[account.taxTreatment] += account.monthlyContribution * 12;
	}

	const detected = detectSavings(accounts);
	const liquidTypeMix = liquidTypeMixFromAccounts(accounts);
	const bucketReturns = weightedBucketReturns(accounts, returnRate);

	// ─── Properties ──────────────────────────────────────────────────────────
	const properties = propertySources.map((property) =>
		toProjectedProperty(
			property,
			planningContext.realEstateAppreciationRate,
			planningContext.inflationRate,
			now,
		),
	);
	const liabilities = assembleProjectedLiabilities({
		profileLiabilities: profileData?.liabilities ?? [],
		debtAccounts: accounts,
		properties: propertySources,
		now,
	});
	const otherDebt = liabilityBalancesTotal(liabilities);
	const primaryResidence =
		properties.find((property) => property.isPrimaryResidence) ?? null;
	const mortgagePayoffAge =
		primaryResidence !== null && primaryResidence.loanBalance > 0
			? currentAge + Math.ceil(primaryResidence.remainingTermMonths / 12)
			: null;
	const primaryResidenceEquity = primaryResidence
		? Math.max(0, primaryResidence.value - primaryResidence.loanBalance)
		: 0;

	// ─── Spending ────────────────────────────────────────────────────────────
	// The window can be shorter than SPENDING_BASELINE_MONTHS for a recently
	// connected account. Divide by the months we actually observed so a
	// six-month history is not read as a full year of spending.
	const observedSpendingMonths = Math.max(1, trailing.monthCount);
	const categoryNameById = new Map(
		categoryBudgets.map((entry) => [entry.categoryId, entry.categoryName]),
	);
	const spendingCategories = categorySpend
		.filter((row) => row.categoryId !== null && row.total > 0)
		.map((row) => ({
			categoryId: row.categoryId as string,
			categoryName:
				categoryNameById.get(row.categoryId as string) ?? row.categoryName,
			monthlyAmount: monthlyAmountFromWindowTotal(
				row.total,
				observedSpendingMonths,
			),
		}));

	const propertyMonthlyDebtService = properties.reduce(
		(sum, property) =>
			property.loanBalance > 0 ? sum + property.monthlyPayment : sum,
		0,
	);
	const propertyOperatingMonthly = properties.reduce(
		(sum, property) => sum + property.monthlyExpenses,
		0,
	);

	// Profile insurance premiums and property cash flows are projected from
	// their own schedules, so they must not be double counted inside living
	// expenses that already include the same transactions.
	const insurancePremiumsAnnualPreview = planningContext.insurancePolicies
		.filter(
			(policy) =>
				!policy.isLocalOnly &&
				policy.status !== "cancelled" &&
				policy.status !== "expired",
		)
		.reduce((sum, policy) => sum + policy.annualPremium, 0);

	const otherDebtServiceMonthly = liabilities.reduce(
		(sum, liability) =>
			liability.monthlyPayment > 0 ? sum + liability.monthlyPayment : sum,
		0,
	);

	const spendingPlan = translateSpending({
		trailingMonths: observedSpendingMonths,
		categories: spendingCategories,
		overrides: spendingOverrides,
		stages: planRecord.spendingStages,
		mortgagePaidOffMonthly:
			primaryResidence !== null &&
			primaryResidence.loanBalance > 0 &&
			mortgagePayoffAge !== null &&
			mortgagePayoffAge <= longevityAge
				? primaryResidence.monthlyPayment
				: 0,
		mortgagePayoffAge,
		fallbackMonthlySpending:
			trailing.totalSpending > 0
				? monthlyAmountFromWindowTotal(
						trailing.totalSpending,
						observedSpendingMonths,
					)
				: trailing.avgExpenses,
		engineModeledCategoryIds: engineModeledSpendingCategoryIds({
			categories: spendingCategories,
			modelsDebtService:
				otherDebtServiceMonthly > 0 || propertyMonthlyDebtService > 0,
			modelsInsurancePremiums: insurancePremiumsAnnualPreview > 0,
		}),
	});

	const healthcareMonthlyCurrent = spendingPlan.categories
		.filter((row) =>
			/health|medical|dental|vision|pharmacy|prescription/i.test(
				row.categoryName,
			),
		)
		.reduce((sum, row) => sum + row.currentMonthlyAmount, 0);

	const healthcareMonthly = spendingPlan.categories
		.filter((row) =>
			/health|medical|dental|vision|pharmacy|prescription/i.test(
				row.categoryName,
			),
		)
		.reduce((sum, row) => sum + row.retirementMonthlyAmount, 0);

	const spendingExclusions: SpendCarveOuts = {
		healthcareMonthly,
		housingDebtServiceMonthly: propertyMonthlyDebtService,
		propertyOperatingMonthly,
		insurancePremiumsMonthly: insurancePremiumsAnnualPreview / 12,
		otherDebtServiceMonthly,
	};
	// `translateSpending` already removed P&I from the headline for the payoff
	// narrative. Put it back before the housing carve so the mortgage is
	// subtracted exactly once; the ledger amortizes the loan and drops the
	// payment itself at payoff.
	const retirementMonthlySpending = toEngineMonthlySpend(
		spendingPlan.estimatedRetirementMonthly +
			mortgagePayoffReductionOf(spendingPlan),
		spendingExclusions,
	);

	// Insights total spending, partitioned so housing/healthcare/insurance can
	// be shown separately without changing the net.
	const trailingAnnualSpending =
		trailing.totalSpending > 0
			? annualizeWindowTotal(trailing.totalSpending, observedSpendingMonths)
			: spendingPlan.currentMonthlySpending * 12;
	const preRetirementAnnualSpending =
		toEngineMonthlySpend(trailingAnnualSpending / 12, {
			healthcareMonthly: healthcareMonthlyCurrent,
			housingDebtServiceMonthly: propertyMonthlyDebtService,
			propertyOperatingMonthly,
			insurancePremiumsMonthly: insurancePremiumsAnnualPreview / 12,
			otherDebtServiceMonthly,
		}) * 12;
	const preRetirementAnnualHealthcare = healthcareMonthlyCurrent * 12;
	const { savingsNet: preRetirementAnnualNetIncome } = retirementSavingsNet({
		netIncome: trailing.netIncome,
		incomeByCategory,
	});

	// ─── Social Security ─────────────────────────────────────────────────────
	const annualIncome = annualizeInsightsEmploymentIncome({
		monthlyTotals: netIncomeSummary.monthlyTotals,
		incomeByCategory,
	});
	const employmentIncome = resolveEmploymentIncome({
		hasSpouse: planRecord.hasSpouse,
		trailingAnnualIncome: annualIncome,
		storedPrimary: planRecord.annualEmploymentIncome,
		storedSpouse: planRecord.annualSpouseEmploymentIncome,
	});
	const primaryMonthlyAtFra =
		planRecord.socialSecurityMonthlyAtFra ??
		estimateFraBenefitFromIncome(employmentIncome.primary);
	const spouseMonthlyAtFra = planRecord.hasSpouse
		? (planRecord.spouseSocialSecurityMonthlyAtFra ??
			estimateFraBenefitFromIncome(employmentIncome.spouse))
		: null;

	// ─── Insurance ───────────────────────────────────────────────────────────
	const lifeCoverage: LifeCoverage[] = [];
	const insurancePremiums: InsurancePremium[] = [];
	let ltcCoverage: LtcCoverage | null = null;
	let disabilityMonthlyBenefit = 0;
	for (const policy of planningContext.insurancePolicies) {
		if (policy.isLocalOnly) continue;
		if (policy.status === "cancelled" || policy.status === "expired") continue;
		const expiresAtAge =
			policy.effectiveEndDate !== null
				? currentAge +
					(new Date(policy.effectiveEndDate).getFullYear() - currentYear)
				: null;
		insurancePremiums.push({
			id: policy.id,
			label: policy.type,
			annualPremium: policy.annualPremium,
			expiresAtAge,
		});
		if (policy.type === "life" && policy.deathBenefit !== null) {
			lifeCoverage.push({
				id: policy.id,
				deathBenefit: policy.deathBenefit,
				annualPremium: 0,
				expiresAtAge,
				insured: policy.insured,
			});
		}
		if (
			policy.type === "longTermCare" &&
			policy.monthlyBenefit !== null &&
			ltcCoverage === null
		) {
			ltcCoverage = {
				id: policy.id,
				monthlyBenefit: policy.monthlyBenefit,
				benefitYears: policy.benefitYears ?? 3,
				eliminationDays: policy.eliminationDays ?? 90,
				hasInflationProtection: policy.hasInflationProtection,
				expiresAtAge,
			};
		}
		if (policy.type === "disability" && policy.monthlyBenefit !== null) {
			disabilityMonthlyBenefit = Math.max(
				disabilityMonthlyBenefit,
				policy.monthlyBenefit,
			);
		}
	}

	// ─── Data status ─────────────────────────────────────────────────────────
	const investableAccounts = accounts.filter(
		(account) => !account.isDebt && !account.isCash,
	);
	const hasBirthYearForGate =
		planRecord.primaryBirthYear !== null ||
		planningContext.currentAgeHint !== null;
	let dataStatus: RetirementDataStatus = "ready";
	if (trailing.monthCount === 0 && investableAccounts.length === 0) {
		dataStatus = "no_data";
	} else if (investableAccounts.length === 0) {
		dataStatus = "no_investment_accounts";
	} else if (trailing.monthCount < MINIMUM_HISTORY_MONTHS) {
		dataStatus = "insufficient_history";
	} else if (!hasBirthYearForGate) {
		dataStatus = "missing_birth_year";
	}

	const policies = planRecord.policies ?? emptyRetirementPolicies();
	const plan: RetirementPlanSettings = {
		primaryBirthYear: planRecord.primaryBirthYear,
		primaryCurrentAge: currentAge,
		targetRetirementAge,
		longevityAge,
		socialSecurityClaimAge: planRecord.socialSecurityClaimAge,
		socialSecurityMonthlyAtFra: planRecord.socialSecurityMonthlyAtFra,
		hasSpouse: planRecord.hasSpouse,
		spouseBirthYear: planRecord.spouseBirthYear,
		spouseCurrentAge,
		spouseRetirementAge: planRecord.spouseRetirementAge,
		spouseLongevityAge: planRecord.spouseLongevityAge,
		spouseSocialSecurityClaimAge: planRecord.spouseSocialSecurityClaimAge,
		spouseSocialSecurityMonthlyAtFra:
			planRecord.spouseSocialSecurityMonthlyAtFra,
		annualEmploymentIncome: planRecord.annualEmploymentIncome,
		annualSpouseEmploymentIncome: planRecord.annualSpouseEmploymentIncome,
		confidenceTarget: planRecord.confidenceTarget,
		monteCarloTrials: planRecord.monteCarloTrials,
		spendingStages: planRecord.spendingStages,
		withdrawalOrder: toWithdrawalOrder(planRecord.withdrawalOrder),
		contributionPolicy: policies.contribution,
		spendingPolicy: policies.spending,
		healthcarePolicy: policies.healthcare,
		taxPolicy: policies.tax,
		cashPolicy: policies.cash,
		allocationPolicy: policies.allocation,
	};

	const spouseRetirementAge =
		planRecord.hasSpouse && spouseCurrentAge !== null
			? (planRecord.spouseRetirementAge ?? targetRetirementAge)
			: null;

	const inputs: RetirementPlanInputs = {
		currentYear,
		currentAge,
		primaryBirthYear: planRecord.primaryBirthYear,
		spouseCurrentAge,
		retirementAge: targetRetirementAge,
		spouseRetirementAge,
		longevityAge,
		balances,
		contributions,
		liquidTypeMix,
		contributionsStopAge: targetRetirementAge,
		annualEmploymentIncome: employmentIncome.primary,
		annualSpouseEmploymentIncome: employmentIncome.spouse,
		employmentEndsAtAge: targetRetirementAge,
		spouseEmploymentEndsAtAge: spouseRetirementAge,
		returnRate,
		bucketReturns,
		inflationRate,
		incomeGrowthRate,
		contributionGrowthRate,
		expenseGrowthRate,
		cashYield: weightedCashYield(accounts, planningContext.cashYield),
		volatility: profile.volatility,
		otherDebt,
		liabilities,
		preRetirementAnnualSpending,
		preRetirementAnnualNetIncome,
		preRetirementAnnualHealthcare,
		retirementMonthlySpending,
		essentialShare: essentialShareOf(spendingPlan) || DEFAULT_ESSENTIAL_SHARE,
		spendingStages: planRecord.spendingStages.map((stage) => ({
			...stage,
			monthlyAmount: toEngineMonthlySpend(
				stage.monthlyAmount,
				spendingExclusions,
			),
		})),
		annualHealthcareSpending: healthcareMonthly * 12,
		healthcareCostMultiplier: 1,
		preMedicareMonthlyPremium: PRE_MEDICARE_MONTHLY_PREMIUM,
		preMedicareWindow: null,
		properties,
		monthlyRentAfterHomeSale: 0,
		rentFromAge: primaryResidence === null ? currentAge : null,
		socialSecurity: {
			monthlyAtFra: primaryMonthlyAtFra,
			claimAge: planRecord.socialSecurityClaimAge,
			haircut: 0,
			isEstimated: planRecord.socialSecurityMonthlyAtFra === null,
		},
		spouseSocialSecurity:
			planRecord.hasSpouse && spouseMonthlyAtFra !== null
				? {
						monthlyAtFra: spouseMonthlyAtFra,
						claimAge:
							planRecord.spouseSocialSecurityClaimAge ??
							planRecord.socialSecurityClaimAge,
						haircut: 0,
						isEstimated: planRecord.spouseSocialSecurityMonthlyAtFra === null,
					}
				: null,
		filingStatus: normalizeFilingStatus(planningContext.filingStatus),
		stateTaxRate: planningContext.stateTaxRate,
		stateTaxChange: null,
		withdrawalOrder: plan.withdrawalOrder,
		rmdStartAge: rmdStartAgeForBirthYear(planRecord.primaryBirthYear),
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
		ltcCoverage,
		lifeCoverage,
		disabilityEvents: [],
		spouseDeathAtAge: null,
		insurancePremiums,
		taxYear: getTaxYear(),
	};

	const standingRules = standingRuleRecords.map(toStandingRule);
	const withRules = applyStandingRules(inputs, standingRules);
	const filingStatus = normalizeFilingStatus(planningContext.filingStatus);
	const primaryGrossed = grossUpNetIncome({
		netIncome: employmentIncome.primary,
		filingStatus,
		stateTaxRate: planningContext.stateTaxRate,
	});
	const spouseGrossed = grossUpNetIncome({
		netIncome: employmentIncome.spouse,
		filingStatus,
		stateTaxRate: planningContext.stateTaxRate,
	});
	const compiledInputs = applyPolicies(withRules, policies, {
		primaryWageTaxRate: primaryGrossed.wageTaxRate,
		spouseWageTaxRate: spouseGrossed.wageTaxRate,
	});

	const netWorth =
		balances.cash +
		balances.taxable +
		balances.taxDeferred +
		balances.taxFree +
		properties.reduce(
			(sum, property) =>
				sum + Math.max(0, property.value - property.loanBalance),
			0,
		) -
		otherDebt;

	const summary: RetirementBaselineSummary = {
		baselineVersion,
		refreshedAt: now.toISOString(),
		currentAge,
		balanceTaxable: balances.cash + balances.taxable,
		balanceTaxDeferred: balances.taxDeferred,
		balanceTaxFree: balances.taxFree,
		realEstateEquity: properties.reduce(
			(sum, property) =>
				sum + Math.max(0, property.value - property.loanBalance),
			0,
		),
		debtBalance:
			otherDebt +
			properties.reduce((sum, property) => sum + property.loanBalance, 0),
		netWorth,
		monthlyIncome:
			trailing.totalIncome / Math.max(1, trailing.monthCount || 12),
		monthlyExpenses:
			trailing.totalSpending / Math.max(1, trailing.monthCount || 12),
		monthlyContributions:
			(contributions.taxable +
				contributions.taxDeferred +
				contributions.taxFree) /
			12,
		trailingMonthCount: trailing.monthCount,
		expectedRetirementMonthlySpending: spendingPlan.estimatedRetirementMonthly,
		annualEmploymentIncome: employmentIncome.primary,
		annualSpouseEmploymentIncome: employmentIncome.spouse,
		employmentEndsAtAge: targetRetirementAge,
		spouseEmploymentEndsAtAge: spouseRetirementAge,
		investmentAccountCount: investableAccounts.length,
		propertyCount: properties.length,
		insurancePolicyCount: planningContext.insurancePolicies.length,
		localOnlyPolicyCount: planningContext.excludedLocalPolicyCount,
	};

	const detectedRecurring = detectRecurringExpenses(
		expenseMonthRowsFromTransactions(recentTransactions),
	);
	const recurringSignals = detectedRecurring.map((expense) => ({
		key: expense.description,
		label: expense.merchantName ?? expense.description,
		monthlyAmount: expense.monthlyAmount,
		observedMonths: expense.occurrences,
	}));
	const standingRuleSuggestions = deriveRecurringExpenseSuggestions(
		recurringSignals,
		{ retirementAge: targetRetirementAge },
	);
	const profileLocation = profileData?.profile?.location ?? null;
	const policyDefaults = deriveSmartDefaults({
		currentAge,
		retirementAge: targetRetirementAge,
		longevityAge,
		filingStatus: normalizeFilingStatus(planningContext.filingStatus),
		hasSpouse: planRecord.hasSpouse,
		netEmploymentIncome: employmentIncome.primary,
		netSpouseEmploymentIncome: employmentIncome.spouse,
		stateTaxRate: planningContext.stateTaxRate,
		accounts: accountSignals(accounts),
		holdingMix: null,
		hsaEligible: detected.hasHsa ? true : null,
		healthCoverageAdults: planRecord.hasSpouse ? 2 : 1,
		transactionStateCode: modalStateCodeFromTransactions(recentTransactions),
		profileLocation,
		recurringExpenses: recurringSignals,
		monthlyHealthcareSpend: healthcareMonthlyCurrent,
	} satisfies DefaultSignals);

	return {
		baselineVersion,
		refreshedAt: now.toISOString(),
		plan,
		inputs: compiledInputs,
		summary,
		accounts,
		properties: propertySources,
		context: planningContext,
		spendingPlan,
		trailing,
		detected: {
			...detected,
			employerMatchUnmodeled:
				detected.has401k &&
				detected.annual401kContribution <
					annualIncome *
						ASSUMED_EMPLOYER_MATCH_UP_TO_PERCENT_OF_SALARY *
						(1 + ASSUMED_EMPLOYER_MATCH_PERCENT),
		},
		dataStatus,
		mortgagePayoffAge,
		primaryResidenceEquity,
		scenarioRatesSource,
		spendingExclusions,
		disabilityMonthlyBenefit,
		standingRules,
		standingRuleSuggestions,
		policyDefaults,
	};
}
