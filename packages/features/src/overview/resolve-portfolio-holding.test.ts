import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type {
	FinancialProfileData,
	RealEstateInvestment,
} from "@moat/contracts";
import { resolvePortfolioHolding } from "./resolve-portfolio-holding";

function emptyProfile(
	overrides: Partial<FinancialProfileData> = {},
): FinancialProfileData {
	return {
		profile: {
			id: "profile-default",
			householdType: "Individual",
			location: "",
			lifeStage: "Other",
			employmentType: "Other",
			planningHorizon: "5 years",
			riskTolerance: "Balanced",
			dependentsCount: 0,
			housingStatus: "Other",
			lastUpdated: "2026-01-01",
			source: "Manual",
		},
		accounts: [],
		incomeSources: [],
		assets: [],
		liabilities: [],
		investments: [],
		insurancePolicies: [],
		taxProfile: {
			filingStatus: "Single",
			taxYear: 2026,
			estimatedFederalTaxBracket: "22%",
			estimatedStateTaxRate: "5%",
			totalAnnualIncome: 0,
			taxableIncomeEstimate: 0,
			deductionStrategy: "Standard",
			selfEmployedIncome: false,
			rentalIncome: false,
			lastUpdated: "2026-01-01",
		},
		forecastAssumptions: {
			inflationRate: 3,
			incomeGrowthRate: 3,
			expenseGrowthRate: 3,
			investmentReturnRate: 7,
			realEstateAppreciationRate: 3,
			defaultCashYield: 4.5,
			forecastStyle: "Balanced",
			lastUpdated: "2026-01-01",
		},
		planningNotes: [],
		...overrides,
	};
}

const robinhoodAccount = {
	id: "plaid-acct_robinhood",
	name: "Robinhood individual",
	institution: "Robinhood",
	type: "Brokerage",
	balance: 182230,
	connectionStatus: "Synced" as const,
	lastSynced: "Synced just now",
	includedInNetWorth: true,
};

describe("resolvePortfolioHolding", () => {
	it("matches a Plaid investment item id to the profile account", () => {
		const resolved = resolvePortfolioHolding(
			"plaid_acct_robinhood",
			"stocks",
			emptyProfile({
				accounts: [robinhoodAccount],
				investments: [
					{
						id: "plaid-acct_robinhood",
						name: "Robinhood individual",
						type: "Brokerage",
						currentValue: 182230,
						monthlyContribution: 0,
						expectedReturn: 7,
						accountLink: "plaid-acct_robinhood",
						includeInForecast: true,
					},
				],
			}),
			[],
		);
		assert.deepEqual(resolved, {
			kind: "account",
			account: robinhoodAccount,
		});
	});

	it("matches a bare depository account id to the profile cash account", () => {
		const checking = {
			id: "plaid-acct_checking",
			name: "Checking",
			institution: "Chase",
			type: "Checking",
			balance: 36767,
			connectionStatus: "Synced" as const,
			lastSynced: "Synced just now",
			includedInNetWorth: true,
		};
		const resolved = resolvePortfolioHolding(
			"acct_checking",
			"cash",
			emptyProfile({ accounts: [checking] }),
			[],
		);
		assert.deepEqual(resolved, { kind: "account", account: checking });
	});

	it("matches a manual investment id to the synthetic account", () => {
		const account = {
			id: "investment-acct-inv_401k",
			name: "Fidelity 401(k)",
			institution: "Manual",
			type: "401(k)",
			balance: 80000,
			connectionStatus: "Manual" as const,
			lastSynced: "Manual",
			includedInNetWorth: true,
		};
		const resolved = resolvePortfolioHolding(
			"inv_401k",
			"401k",
			emptyProfile({
				accounts: [account],
				investments: [
					{
						id: "inv_401k",
						name: "Fidelity 401(k)",
						type: "401(k)",
						currentValue: 80000,
						monthlyContribution: 500,
						expectedReturn: 7,
						accountLink: "investment-acct-inv_401k",
						includeInForecast: true,
					},
				],
			}),
			[],
		);
		assert.deepEqual(resolved, { kind: "account", account });
	});

	it("matches a real estate property id", () => {
		const property = {
			id: "prop_home",
			name: "Primary home",
			propertyType: "SINGLE_FAMILY",
			usageType: "PRIMARY_RESIDENCE",
			currentEstimatedValue: 500000,
			currentLoanBalance: 308000,
			forecastScenario: "STANDARD",
		} satisfies RealEstateInvestment;
		const resolved = resolvePortfolioHolding(
			"prop_home",
			"realEstate",
			emptyProfile(),
			[property],
		);
		assert.deepEqual(resolved, { kind: "realEstate", property });
	});

	it("matches a household-prefixed other asset id", () => {
		const asset = {
			id: "asset-car",
			name: "Honda",
			type: "Vehicle" as const,
			estimatedValue: 18000,
			includeInNetWorth: true,
			includeInForecast: true,
		};
		const resolved = resolvePortfolioHolding(
			"childlink123:asset-car",
			"otherAssets",
			emptyProfile({ assets: [asset] }),
			[],
		);
		assert.deepEqual(resolved, { kind: "asset", asset });
	});

	it("returns null when the holding cannot be resolved", () => {
		assert.equal(
			resolvePortfolioHolding("missing", "stocks", emptyProfile(), []),
			null,
		);
	});
});
