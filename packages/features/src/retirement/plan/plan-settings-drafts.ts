import type {
	FinancialProfileData,
	ForecastAssumptions,
	ForecastScenario,
	ProfileAccount,
	ProfileInvestment,
	ProfileLiability,
	RealEstateInvestment,
	TaxProfile,
	UpdateManualInvestmentInput,
	UpdateRealEstateInput,
} from "@moat/contracts";
import {
	MONTE_CARLO_TRIALS_MAX,
	MONTE_CARLO_TRIALS_MIN,
} from "@moat/contracts";
import {
	applyDerivedMortgageDetailsIfEmpty,
	deriveMortgageAdvancedDetails,
	roundMortgageDollars,
} from "@moat/domain/derive-mortgage-details";
import {
	formatRatePercentInput,
	type OverlappingRatePercents,
	overlappingRatePercentsEqual,
	rateDecimalToPercent,
	ratePercentToDecimal,
} from "../../forecast-rate-cascade";

export type ForecastStyle = ForecastAssumptions["forecastStyle"];

export type GrowthRatesForm = {
	inflationRate: string;
	incomeGrowthRate: string;
	investmentReturnRate: string;
	realEstateAppreciationRate: string;
	defaultCashYield: string;
	forecastStyle: ForecastStyle;
	expenseGrowthRate: string;
};

export type TaxDraft = {
	filingStatus: TaxProfile["filingStatus"];
	estimatedStateTaxRate: string;
};

export type SimulationForm = {
	confidenceTarget: string;
	monteCarloTrials: string;
};

export type PropertyDraft = {
	id: string;
	name: string;
	currentEstimatedValue: string;
	currentLoanBalance: string;
	appreciationRate: string;
	interestRate: string;
	loanTermYears: string;
	remainingTermMonths: string;
	monthlyMortgagePayment: string;
	monthlyRent: string;
	vacancyRate: string;
	totalMonthlyExpenses: string;
	usageType: RealEstateInvestment["usageType"];
	linkedPlaidAccountId: string | null;
	linkedAccountName: string | null;
};

export type InvestmentDraft = {
	id: string;
	name: string;
	type: string;
	currentValue: string;
	monthlyContribution: string;
	expectedReturn: string;
	original: ProfileInvestment;
};

export type DebtDraft = {
	id: string;
	source: "liability" | "account";
	name: string;
	type: string;
	balance: string;
	interestRate: string;
	monthlyPayment: string;
	loanStartDate: string;
	loanTermYears: string;
	includeInNetWorth: boolean;
	includeInForecast: boolean;
	original?: ProfileLiability;
};

export const EMPTY_GROWTH_FORM: GrowthRatesForm = {
	defaultCashYield: "4.5",
	expenseGrowthRate: "3",
	forecastStyle: "Balanced",
	incomeGrowthRate: "3",
	inflationRate: "3",
	investmentReturnRate: "7",
	realEstateAppreciationRate: "3",
};

export const EMPTY_SIMULATION_FORM: SimulationForm = {
	confidenceTarget: "85",
	monteCarloTrials: "1000",
};

export const FILING_STATUS_OPTIONS = [
	"Single",
	"Married filing jointly",
	"Married filing separately",
	"Head of household",
] as const;

export const FORECAST_STYLE_OPTIONS = [
	"Conservative",
	"Balanced",
	"Aggressive",
] as const;

function optionalNumberToInput(value: number | null | undefined): string {
	if (value == null) return "";
	return String(value);
}

function optionalPercentToInput(value: number | null | undefined): string {
	if (value == null) return "";
	return formatRatePercentInput(rateDecimalToPercent(value));
}

export function growthFormFromSources(input: {
	assumptions?: ForecastAssumptions;
	activeScenario?: ForecastScenario | null;
}): GrowthRatesForm {
	const assumptions = input.assumptions;
	const scenario = input.activeScenario;
	return {
		defaultCashYield: formatRatePercentInput(
			assumptions?.defaultCashYield ?? 4.5,
		),
		expenseGrowthRate: formatRatePercentInput(
			scenario
				? rateDecimalToPercent(scenario.expenseGrowth)
				: (assumptions?.expenseGrowthRate ?? 3),
		),
		forecastStyle: assumptions?.forecastStyle ?? "Balanced",
		incomeGrowthRate: formatRatePercentInput(
			scenario
				? rateDecimalToPercent(scenario.salaryGrowth)
				: (assumptions?.incomeGrowthRate ?? 3),
		),
		inflationRate: formatRatePercentInput(
			scenario
				? rateDecimalToPercent(scenario.inflationRate)
				: (assumptions?.inflationRate ?? 3),
		),
		investmentReturnRate: formatRatePercentInput(
			scenario
				? rateDecimalToPercent(scenario.investmentReturn)
				: (assumptions?.investmentReturnRate ?? 7),
		),
		realEstateAppreciationRate: formatRatePercentInput(
			assumptions?.realEstateAppreciationRate ?? 3,
		),
	};
}

/** Overlapping percents the growth form was hydrated from (scenario decimals preferred). */
export function overlappingPercentsFromHydratedSources(input: {
	assumptions?: ForecastAssumptions;
	activeScenario?: ForecastScenario | null;
}): OverlappingRatePercents | undefined {
	const parsed = parseGrowthRatesForm(growthFormFromSources(input));
	if (!parsed.ok) return undefined;
	return parsed.percents;
}

export function overlappingPercentsChangedFromSources(
	submitted: OverlappingRatePercents,
	input: {
		assumptions?: ForecastAssumptions;
		activeScenario?: ForecastScenario | null;
	},
): boolean {
	const baseline = overlappingPercentsFromHydratedSources(input);
	if (!baseline) return true;
	return !overlappingRatePercentsEqual(submitted, baseline);
}

export function taxDraftFromProfile(tax: TaxProfile | undefined): TaxDraft {
	return {
		estimatedStateTaxRate: tax?.estimatedStateTaxRate ?? "",
		filingStatus: tax?.filingStatus ?? "Single",
	};
}

export function simulationFormFromPlan(plan: {
	confidenceTarget: number;
	monteCarloTrials: number;
}): SimulationForm {
	return {
		confidenceTarget: String(Math.round(plan.confidenceTarget * 100)),
		monteCarloTrials: String(plan.monteCarloTrials),
	};
}

function linkedAccountName(
	property: RealEstateInvestment,
	accounts: ProfileAccount[],
): string | null {
	const linkedId = property.linkedPlaidAccountId;
	if (!linkedId) return null;
	const match = accounts.find(
		(account) =>
			account.id === linkedId ||
			account.id === `plaid_${linkedId}` ||
			account.id === `plaid-${linkedId}`,
	);
	return match?.name ?? "linked account";
}

export function propertyToDraft(
	property: RealEstateInvestment,
	accounts: ProfileAccount[],
): PropertyDraft {
	const derived = deriveMortgageAdvancedDetails({
		annualInterestRate: property.interestRate,
		currentLoanBalance: property.currentLoanBalance,
		loanTermYears: property.loanTermYears,
		purchaseDate: property.purchaseDate,
		purchasePrice: property.purchasePrice,
	});
	const applied = applyDerivedMortgageDetailsIfEmpty(
		{
			monthlyMortgagePayment: property.monthlyMortgagePayment,
			remainingTermMonths: property.remainingTermMonths,
		},
		derived,
	);
	const remainingTermMonths = optionalNumberToInput(
		applied.remainingTermMonths,
	);
	const monthlyMortgagePayment =
		property.monthlyMortgagePayment == null &&
		applied.monthlyMortgagePayment != null
			? String(roundMortgageDollars(applied.monthlyMortgagePayment))
			: optionalNumberToInput(applied.monthlyMortgagePayment);

	return {
		appreciationRate: optionalPercentToInput(property.appreciationRate),
		currentEstimatedValue: String(property.currentEstimatedValue),
		currentLoanBalance: String(property.currentLoanBalance),
		id: property.id,
		interestRate: optionalPercentToInput(property.interestRate),
		linkedAccountName: linkedAccountName(property, accounts),
		linkedPlaidAccountId: property.linkedPlaidAccountId ?? null,
		loanTermYears: optionalNumberToInput(property.loanTermYears),
		monthlyMortgagePayment,
		monthlyRent: optionalNumberToInput(property.monthlyRent),
		name: property.name,
		remainingTermMonths,
		totalMonthlyExpenses: optionalNumberToInput(property.totalMonthlyExpenses),
		usageType: property.usageType,
		vacancyRate: optionalPercentToInput(property.vacancyRate),
	};
}

export function investmentToDraft(
	investment: ProfileInvestment,
): InvestmentDraft {
	return {
		currentValue: String(investment.currentValue),
		expectedReturn: formatRatePercentInput(
			rateDecimalToPercent(investment.expectedReturn),
		),
		id: investment.id,
		monthlyContribution: String(investment.monthlyContribution),
		name: investment.name,
		original: investment,
		type: investment.type,
	};
}

export function investmentDraftToUpdate(draft: InvestmentDraft):
	| {
			ok: true;
			profile: ProfileInvestment;
			investment: Pick<
				UpdateManualInvestmentInput,
				"id" | "monthlyContribution" | "annualReturnRate"
			>;
	  }
	| { ok: false; error: string } {
	const contribution = parseMoneyField(
		draft.monthlyContribution,
		`${draft.name} monthly contribution`,
	);
	if (!contribution.ok) return contribution;
	const expectedReturn = parseRequiredNumber(
		draft.expectedReturn,
		`${draft.name} expected annual return`,
		-100,
		100,
	);
	if (!expectedReturn.ok) return expectedReturn;
	return {
		ok: true,
		investment: {
			annualReturnRate: ratePercentToDecimal(expectedReturn.value),
			id: draft.id,
			monthlyContribution: contribution.value,
		},
		profile: {
			...draft.original,
			expectedReturn: expectedReturn.value,
			monthlyContribution: contribution.value,
		},
	};
}

export function applyInvestmentDrafts(
	existing: ProfileInvestment[],
	drafts: InvestmentDraft[],
):
	| {
			ok: true;
			profile: ProfileInvestment[];
			updates: Array<
				Pick<
					UpdateManualInvestmentInput,
					"id" | "monthlyContribution" | "annualReturnRate"
				>
			>;
	  }
	| { ok: false; error: string } {
	const byId = new Map(
		existing.map((investment) => [investment.id, investment]),
	);
	const profile: ProfileInvestment[] = [];
	const updates = [];
	for (const draft of drafts) {
		const parsed = investmentDraftToUpdate(draft);
		if (!parsed.ok) return parsed;
		profile.push(parsed.profile);
		updates.push(parsed.investment);
		byId.delete(draft.id);
	}
	for (const leftover of byId.values()) {
		profile.push(leftover);
	}
	return { ok: true, profile, updates };
}

export function mortgageLiabilityId(propertyId: string): string {
	return `mortgage-${propertyId}`;
}

function isGeneratedMortgageId(
	liabilityId: string,
	properties: Array<{ id: string }>,
): boolean {
	return properties.some(
		(property) => mortgageLiabilityId(property.id) === liabilityId,
	);
}

function isHousingDebtKind(kind: string): boolean {
	const value = kind.toLowerCase();
	return value.includes("mortgage") || value.includes("home equity");
}

function isDebtAccountType(type: string): boolean {
	const value = type.toLowerCase();
	return (
		value.includes("loan") ||
		value.includes("mortgage") ||
		value.includes("credit") ||
		value.includes("heloc") ||
		value.includes("debt")
	);
}

function plaidAccountMatchesId(accountId: string, plaidId: string): boolean {
	return (
		accountId === plaidId ||
		accountId === `plaid_${plaidId}` ||
		accountId === `plaid-${plaidId}`
	);
}

function balancesMatch(left: number, right: number): boolean {
	const delta = Math.abs(left - right);
	if (delta < 1) return true;
	const scale = Math.max(Math.abs(left), Math.abs(right));
	return scale > 0 && delta / scale < 0.02;
}

export function syncedDebtDraftId(accountId: string): string {
	return `synced-debt-${accountId}`;
}

export function liabilityToDraft(liability: ProfileLiability): DebtDraft {
	return {
		balance: String(liability.balance),
		id: liability.id,
		includeInForecast: liability.includeInForecast,
		includeInNetWorth: liability.includeInNetWorth,
		interestRate: formatRatePercentInput(liability.interestRate),
		loanStartDate: liability.loanStartDate ?? "",
		loanTermYears: optionalNumberToInput(liability.loanTermYears),
		monthlyPayment: String(liability.monthlyPayment),
		name: liability.name,
		original: liability,
		source: "liability",
		type: liability.type,
	};
}

export function accountToDebtDraft(account: ProfileAccount): DebtDraft {
	return {
		balance: String(Math.abs(account.balance)),
		id: syncedDebtDraftId(account.id),
		includeInForecast: true,
		includeInNetWorth: account.includedInNetWorth,
		interestRate: "",
		loanStartDate: "",
		loanTermYears: "",
		monthlyPayment: "",
		name: account.name,
		source: "account",
		type: account.type,
	};
}

export function otherDebtDrafts(input: {
	profile: FinancialProfileData;
	properties: Array<{
		id: string;
		currentLoanBalance: number;
		linkedPlaidAccountId?: string | null;
	}>;
}): DebtDraft[] {
	const liabilities = input.profile.liabilities.filter(
		(liability) =>
			liability.includeInForecast !== false &&
			!isGeneratedMortgageId(liability.id, input.properties),
	);
	const drafts: DebtDraft[] = [];
	const usedIds = new Set<string>();
	for (const liability of liabilities) {
		if (usedIds.has(liability.id)) continue;
		usedIds.add(liability.id);
		drafts.push(liabilityToDraft(liability));
	}

	for (const account of input.profile.accounts) {
		if (account.connectionStatus !== "Synced") continue;
		if (!isDebtAccountType(account.type)) continue;
		const balance = Math.abs(account.balance);
		if (balance <= 0) continue;
		const linkedToProperty = input.properties.some((property) => {
			if (!property.linkedPlaidAccountId) return false;
			return plaidAccountMatchesId(account.id, property.linkedPlaidAccountId);
		});
		if (linkedToProperty) continue;
		if (
			isHousingDebtKind(account.type) &&
			input.properties.some((property) => property.currentLoanBalance > 0)
		) {
			continue;
		}
		const draftId = syncedDebtDraftId(account.id);
		if (usedIds.has(draftId) || usedIds.has(account.id)) continue;
		const alreadyModeled = liabilities.some((liability) =>
			balancesMatch(liability.balance, balance),
		);
		if (alreadyModeled) continue;
		usedIds.add(draftId);
		drafts.push(accountToDebtDraft(account));
	}

	return drafts;
}

export function parseOptionalNumber(
	value: string,
	label: string,
	min = 0,
	max = 1_000_000_000,
): { ok: true; value: number | null } | { ok: false; error: string } {
	const trimmed = value.trim().replace(/,/g, "").replace(/%/g, "");
	if (trimmed === "") return { ok: true, value: null };
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed) || parsed < min || parsed > max) {
		return { ok: false, error: `${label} must be between ${min} and ${max}.` };
	}
	return { ok: true, value: parsed };
}

export function parseRequiredNumber(
	value: string,
	label: string,
	min: number,
	max: number,
): { ok: true; value: number } | { ok: false; error: string } {
	const parsed = parseOptionalNumber(value, label, min, max);
	if (!parsed.ok) return parsed;
	if (parsed.value === null) return { ok: false, error: `Enter ${label}.` };
	return { ok: true, value: parsed.value };
}

export function parseGrowthRatesForm(form: GrowthRatesForm):
	| {
			ok: true;
			percents: OverlappingRatePercents;
			extras: {
				realEstateAppreciationRate: number;
				defaultCashYield: number;
				forecastStyle: ForecastStyle;
			};
	  }
	| { ok: false; error: string } {
	const inflationRate = parseRequiredNumber(
		form.inflationRate,
		"Inflation rate",
		0,
		100,
	);
	if (!inflationRate.ok) return inflationRate;
	const incomeGrowthRate = parseRequiredNumber(
		form.incomeGrowthRate,
		"Income growth rate",
		0,
		100,
	);
	if (!incomeGrowthRate.ok) return incomeGrowthRate;
	const investmentReturnRate = parseRequiredNumber(
		form.investmentReturnRate,
		"Investment return rate",
		-100,
		100,
	);
	if (!investmentReturnRate.ok) return investmentReturnRate;
	const realEstateAppreciationRate = parseRequiredNumber(
		form.realEstateAppreciationRate,
		"Real estate growth",
		-100,
		100,
	);
	if (!realEstateAppreciationRate.ok) return realEstateAppreciationRate;
	const defaultCashYield = parseRequiredNumber(
		form.defaultCashYield,
		"Cash yield",
		0,
		100,
	);
	if (!defaultCashYield.ok) return defaultCashYield;
	const expenseGrowthRate = parseOptionalNumber(
		form.expenseGrowthRate,
		"Expense growth rate",
		0,
		100,
	);
	if (!expenseGrowthRate.ok) return expenseGrowthRate;
	const forecastStyle = FORECAST_STYLE_OPTIONS.includes(form.forecastStyle)
		? form.forecastStyle
		: "Balanced";

	return {
		ok: true,
		extras: {
			defaultCashYield: defaultCashYield.value,
			forecastStyle,
			realEstateAppreciationRate: realEstateAppreciationRate.value,
		},
		percents: {
			expenseGrowthRate: expenseGrowthRate.value ?? inflationRate.value,
			incomeGrowthRate: incomeGrowthRate.value,
			inflationRate: inflationRate.value,
			investmentReturnRate: investmentReturnRate.value,
		},
	};
}

export function parseSimulationForm(
	form: SimulationForm,
):
	| { ok: true; value: { confidenceTarget: number; monteCarloTrials: number } }
	| { ok: false; error: string } {
	const confidencePercent = parseRequiredNumber(
		form.confidenceTarget,
		"Confidence target",
		50,
		99,
	);
	if (!confidencePercent.ok) return confidencePercent;
	const trials = parseRequiredNumber(
		form.monteCarloTrials,
		"Monte Carlo trials",
		MONTE_CARLO_TRIALS_MIN,
		MONTE_CARLO_TRIALS_MAX,
	);
	if (!trials.ok) return trials;
	if (!Number.isInteger(trials.value)) {
		return { ok: false, error: "Monte Carlo trials must be a whole number." };
	}
	return {
		ok: true,
		value: {
			confidenceTarget: confidencePercent.value / 100,
			monteCarloTrials: trials.value,
		},
	};
}

export function parseTaxDraft(
	draft: TaxDraft,
	existing: TaxProfile,
): { ok: true; value: TaxProfile } | { ok: false; error: string } {
	const filingStatus = FILING_STATUS_OPTIONS.includes(draft.filingStatus)
		? draft.filingStatus
		: null;
	if (!filingStatus) {
		return { ok: false, error: "Choose a filing status." };
	}
	const rate = parseOptionalNumber(
		draft.estimatedStateTaxRate,
		"State tax rate",
		0,
		100,
	);
	if (!rate.ok) return rate;
	return {
		ok: true,
		value: {
			...existing,
			estimatedStateTaxRate:
				rate.value === null
					? draft.estimatedStateTaxRate.trim()
					: String(rate.value),
			filingStatus,
			lastUpdated: new Date().toISOString().slice(0, 10),
		},
	};
}

function parseMoneyField(
	value: string,
	label: string,
): { ok: true; value: number } | { ok: false; error: string } {
	return parseRequiredNumber(value, label, 0, 1_000_000_000);
}

export function propertyDraftToUpdate(
	draft: PropertyDraft,
): { ok: true; value: UpdateRealEstateInput } | { ok: false; error: string } {
	const value = parseMoneyField(
		draft.currentEstimatedValue,
		`${draft.name} value`,
	);
	if (!value.ok) return value;
	const balance = parseMoneyField(
		draft.currentLoanBalance,
		`${draft.name} loan balance`,
	);
	if (!balance.ok) return balance;
	const appreciation = parseOptionalNumber(
		draft.appreciationRate,
		`${draft.name} appreciation`,
		-100,
		100,
	);
	if (!appreciation.ok) return appreciation;
	const interest = parseOptionalNumber(
		draft.interestRate,
		`${draft.name} interest rate`,
		0,
		100,
	);
	if (!interest.ok) return interest;
	const termYears = parseOptionalNumber(
		draft.loanTermYears,
		`${draft.name} loan term`,
		1,
		80,
	);
	if (!termYears.ok) return termYears;
	const remaining = parseOptionalNumber(
		draft.remainingTermMonths,
		`${draft.name} remaining months`,
		0,
		1200,
	);
	if (!remaining.ok) return remaining;
	const payment = parseOptionalNumber(
		draft.monthlyMortgagePayment,
		`${draft.name} monthly payment`,
		0,
		1_000_000,
	);
	if (!payment.ok) return payment;
	const rent = parseOptionalNumber(
		draft.monthlyRent,
		`${draft.name} rent`,
		0,
		1_000_000,
	);
	if (!rent.ok) return rent;
	const vacancy = parseOptionalNumber(
		draft.vacancyRate,
		`${draft.name} vacancy`,
		0,
		100,
	);
	if (!vacancy.ok) return vacancy;
	const expenses = parseOptionalNumber(
		draft.totalMonthlyExpenses,
		`${draft.name} monthly expenses`,
		0,
		1_000_000,
	);
	if (!expenses.ok) return expenses;

	return {
		ok: true,
		value: {
			appreciationRate:
				appreciation.value === null
					? null
					: ratePercentToDecimal(appreciation.value),
			currentEstimatedValue: value.value,
			currentLoanBalance: balance.value,
			id: draft.id,
			interestRate:
				interest.value === null ? null : ratePercentToDecimal(interest.value),
			loanTermYears:
				termYears.value === null ? null : Math.trunc(termYears.value),
			monthlyMortgagePayment: payment.value,
			monthlyRent: rent.value,
			remainingTermMonths:
				remaining.value === null ? null : Math.trunc(remaining.value),
			totalMonthlyExpenses: expenses.value,
			vacancyRate:
				vacancy.value === null ? null : ratePercentToDecimal(vacancy.value),
		},
	};
}

export function debtDraftsToLiabilities(
	drafts: DebtDraft[],
	existing: ProfileLiability[],
): { ok: true; value: ProfileLiability[] } | { ok: false; error: string } {
	const kept = existing.filter(
		(liability) =>
			liability.id.startsWith("mortgage-") ||
			liability.includeInForecast === false,
	);
	const next: ProfileLiability[] = [...kept];

	for (const draft of drafts) {
		const balance = parseMoneyField(draft.balance, `${draft.name} balance`);
		if (!balance.ok) return balance;
		const rate = parseOptionalNumber(
			draft.interestRate,
			`${draft.name} rate`,
			0,
			100,
		);
		if (!rate.ok) return rate;
		const payment = parseOptionalNumber(
			draft.monthlyPayment,
			`${draft.name} payment`,
			0,
			1_000_000,
		);
		if (!payment.ok) return payment;
		const termYears = parseOptionalNumber(
			draft.loanTermYears,
			`${draft.name} term`,
			1,
			80,
		);
		if (!termYears.ok) return termYears;

		const original = draft.original;
		next.push({
			...(original ?? {
				includeInForecast: true,
				includeInNetWorth: draft.includeInNetWorth,
			}),
			balance: balance.value,
			id: draft.id,
			includeInForecast: draft.includeInForecast,
			includeInNetWorth: draft.includeInNetWorth,
			interestRate: rate.value ?? 0,
			loanStartDate: draft.loanStartDate.trim() || undefined,
			loanTermYears:
				termYears.value === null ? undefined : Math.trunc(termYears.value),
			monthlyPayment: payment.value ?? 0,
			name: draft.name,
			type: draft.type || original?.type || "Other",
		});
	}

	return { ok: true, value: next };
}

export function isRentalUsage(
	usageType: RealEstateInvestment["usageType"],
): boolean {
	return usageType === "RENTAL" || usageType === "MIXED_USE";
}

export function forecastStyleValue(value: string): ForecastStyle {
	if (value === "Conservative" || value === "Aggressive") return value;
	return "Balanced";
}

export function filingStatusValue(value: string): TaxProfile["filingStatus"] {
	if (
		value === "Married filing jointly" ||
		value === "Married filing separately" ||
		value === "Head of household"
	) {
		return value;
	}
	return "Single";
}
