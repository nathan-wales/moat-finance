import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	FinancialProfileData,
	ForecastAssumptions,
	ForecastScenario,
	ProfileAccount,
	ProfileLiability,
	RealEstateInvestment,
} from "@moat/contracts";
import { overlappingRatePercentsEqual } from "../../forecast-rate-cascade";
import {
	growthFormFromSources,
	otherDebtDrafts,
	overlappingPercentsChangedFromSources,
	overlappingPercentsFromHydratedSources,
	type PropertyDraft,
	parseGrowthRatesForm,
	propertyDraftToUpdate,
	propertyToDraft,
	syncedDebtDraftId,
} from "./plan-settings-drafts";

function draft(overrides: Partial<PropertyDraft> = {}): PropertyDraft {
	return {
		appreciationRate: "",
		currentEstimatedValue: "425000",
		currentLoanBalance: "180000",
		id: "wildflower",
		interestRate: "6.5",
		linkedAccountName: null,
		linkedPlaidAccountId: null,
		loanTermYears: "30",
		monthlyMortgagePayment: "1200",
		monthlyRent: "",
		name: "Wildflower condo",
		remainingTermMonths: "",
		totalMonthlyExpenses: "",
		usageType: "PRIMARY_RESIDENCE",
		vacancyRate: "",
		...overrides,
	};
}

function assumptions(
	overrides: Partial<ForecastAssumptions> = {},
): ForecastAssumptions {
	return {
		defaultCashYield: 4.5,
		expenseGrowthRate: 3,
		forecastStyle: "Balanced",
		incomeGrowthRate: 3,
		inflationRate: 3,
		investmentReturnRate: 7,
		lastUpdated: "2026-01-01",
		realEstateAppreciationRate: 3,
		retirementAge: 65,
		...overrides,
	};
}

function scenario(overrides: Partial<ForecastScenario> = {}): ForecastScenario {
	return {
		contributionChange: 0.02,
		expenseGrowth: 0.03,
		id: "scenario-standard",
		inflationRate: 0.03,
		investmentReturn: 0.07,
		isActive: true,
		name: "Standard",
		salaryGrowth: 0.03,
		type: "STANDARD",
		...overrides,
	};
}

function taxProfile(): FinancialProfileData["taxProfile"] {
	return {
		deductionStrategy: "Standard",
		estimatedFederalTaxBracket: "22%",
		estimatedStateTaxRate: "5",
		filingStatus: "Single",
		lastUpdated: "2026-01-01",
		rentalIncome: false,
		selfEmployedIncome: false,
		taxYear: 2026,
		taxableIncomeEstimate: 0,
		totalAnnualIncome: 0,
	};
}

function profile(
	overrides: Partial<FinancialProfileData> = {},
): FinancialProfileData {
	return {
		accounts: [],
		assets: [],
		forecastAssumptions: assumptions(),
		incomeSources: [],
		insurancePolicies: [],
		investments: [],
		liabilities: [],
		planningNotes: [],
		profile: {
			dependentsCount: 0,
			employmentType: "W-2",
			householdType: "Individual",
			housingStatus: "Homeowner",
			id: "profile-1",
			lastUpdated: "2026-01-01",
			lifeStage: "Family",
			location: "Colorado",
			planningHorizon: "20+ years",
			riskTolerance: "Balanced",
			source: "Manual",
		},
		taxProfile: taxProfile(),
		...overrides,
	};
}

function syncedDebtAccount(
	overrides: Partial<ProfileAccount> = {},
): ProfileAccount {
	return {
		balance: 4200,
		connectionStatus: "Synced",
		id: "plaid-cmt933an10009svucf8l0rs6n",
		includedInNetWorth: true,
		institution: "Chase",
		lastSynced: "Synced just now",
		name: "Chase credit",
		type: "Credit Card",
		...overrides,
	};
}

function savedSyncedLiability(
	overrides: Partial<ProfileLiability> = {},
): ProfileLiability {
	const account = syncedDebtAccount();
	return {
		balance: 4200,
		id: syncedDebtDraftId(account.id),
		includeInForecast: true,
		includeInNetWorth: true,
		interestRate: 22,
		monthlyPayment: 150,
		name: account.name,
		type: account.type,
		...overrides,
	};
}

describe("otherDebtDrafts", () => {
	it("does not emit a duplicate synced-debt id when the live Plaid balance diverged", () => {
		const account = syncedDebtAccount({ balance: 6100 });
		const drafts = otherDebtDrafts({
			profile: profile({
				accounts: [account],
				liabilities: [savedSyncedLiability({ balance: 4200 })],
			}),
			properties: [],
		});
		const ids = drafts.map((entry) => entry.id);
		assert.deepEqual(ids, [syncedDebtDraftId(account.id)]);
	});

	it("dedupes stored liabilities that already share a synced-debt id", () => {
		const account = syncedDebtAccount();
		const drafts = otherDebtDrafts({
			profile: profile({
				accounts: [account, { ...account }],
				liabilities: [
					savedSyncedLiability(),
					savedSyncedLiability({ monthlyPayment: 80 }),
				],
			}),
			properties: [],
		});
		assert.equal(drafts.length, 1);
		assert.equal(drafts[0]?.id, syncedDebtDraftId(account.id));
	});
});

describe("propertyDraftToUpdate", () => {
	it("sends null appreciationRate when the household-default override is empty", () => {
		const parsed = propertyDraftToUpdate(draft());
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.appreciationRate, null);
		assert.equal(parsed.value.remainingTermMonths, null);
		assert.equal(parsed.value.vacancyRate, null);
		assert.equal(parsed.value.monthlyRent, null);
		assert.equal(parsed.value.totalMonthlyExpenses, null);
		assert.equal(parsed.value.currentEstimatedValue, 425000);
		assert.equal(parsed.value.currentLoanBalance, 180000);
	});

	it("converts a filled appreciation override to a decimal without coercing empty to 0", () => {
		const parsed = propertyDraftToUpdate(draft({ appreciationRate: "4" }));
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.value.appreciationRate, 0.04);
	});
});

describe("growthFormFromSources hydration", () => {
	it("round-trips scenario 0.07 as 7% without treating it as a change", () => {
		const sources = {
			activeScenario: scenario({ investmentReturn: 0.07 }),
			assumptions: assumptions({ investmentReturnRate: 7 }),
		};
		const form = growthFormFromSources(sources);
		assert.equal(form.investmentReturnRate, "7");
		assert.equal(form.inflationRate, "3");
		const parsed = parseGrowthRatesForm(form);
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		const hydrated = overlappingPercentsFromHydratedSources(sources);
		assert.ok(hydrated);
		assert.equal(overlappingRatePercentsEqual(parsed.percents, hydrated), true);
		assert.equal(
			overlappingPercentsChangedFromSources(parsed.percents, sources),
			false,
		);
	});

	it("cash-yield-only extras keep overlapping percents unchanged vs hydration", () => {
		const sources = {
			activeScenario: scenario({ expenseGrowth: 0.04 }),
			assumptions: assumptions({ defaultCashYield: 4.5, expenseGrowthRate: 3 }),
		};
		const form = growthFormFromSources(sources);
		assert.equal(form.defaultCashYield, "4.5");
		assert.equal(form.expenseGrowthRate, "4");
		const parsed = parseGrowthRatesForm({ ...form, defaultCashYield: "3" });
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.extras.defaultCashYield, 3);
		assert.equal(parsed.percents.expenseGrowthRate, 4);
		assert.equal(
			overlappingPercentsChangedFromSources(parsed.percents, sources),
			false,
		);
	});

	it("inflation 3 → 2.5 is an overlapping change", () => {
		const sources = {
			activeScenario: scenario(),
			assumptions: assumptions(),
		};
		const form = growthFormFromSources(sources);
		const parsed = parseGrowthRatesForm({ ...form, inflationRate: "2.5" });
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(parsed.percents.inflationRate, 2.5);
		assert.equal(
			overlappingPercentsChangedFromSources(parsed.percents, sources),
			true,
		);
	});

	it("treats 3 vs 3.0 form strings as the same hydrated overlapping rates", () => {
		const sources = {
			activeScenario: scenario(),
			assumptions: assumptions(),
		};
		const form = growthFormFromSources(sources);
		const parsed = parseGrowthRatesForm({
			...form,
			expenseGrowthRate: "3.0",
			incomeGrowthRate: "3.0",
			inflationRate: "3.0",
			investmentReturnRate: "7.0",
		});
		assert.equal(parsed.ok, true);
		if (!parsed.ok) return;
		assert.equal(
			overlappingPercentsChangedFromSources(parsed.percents, sources),
			false,
		);
	});
});

function propertyRecord(
	overrides: Partial<RealEstateInvestment> = {},
): RealEstateInvestment {
	return {
		currentEstimatedValue: 600_000,
		currentLoanBalance: 300_000,
		forecastScenario: "STANDARD",
		id: "home-1",
		interestRate: 0.065,
		loanTermYears: 30,
		monthlyMortgagePayment: null,
		name: "Orem House",
		propertyType: "SINGLE_FAMILY",
		purchaseDate: "2099-01-01",
		purchasePrice: 380_000,
		remainingTermMonths: null,
		usageType: "PRIMARY_RESIDENCE",
		...overrides,
	};
}

describe("propertyToDraft", () => {
	it("hydrates empty remaining months and monthly payment from mortgage drivers", () => {
		const next = propertyToDraft(propertyRecord(), []);
		assert.equal(next.remainingTermMonths, "360");
		assert.ok(Number(next.monthlyMortgagePayment) > 0);
	});

	it("does not overwrite stored remaining months or payment", () => {
		const next = propertyToDraft(
			propertyRecord({
				monthlyMortgagePayment: 2_500,
				remainingTermMonths: 200,
			}),
			[],
		);
		assert.equal(next.remainingTermMonths, "200");
		assert.equal(next.monthlyMortgagePayment, "2500");
	});
});
