import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinancialProfileData } from "@moat/contracts";
import {
	pruneMissingManualInvestmentsFromProfile,
	stripManualInvestmentFromProfile,
} from "./strip-manual-investment-from-profile";

function baseProfile(
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
			lastUpdated: "",
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
			lastUpdated: "",
		},
		forecastAssumptions: {
			inflationRate: 3.0,
			incomeGrowthRate: 3.0,
			expenseGrowthRate: 3.0,
			investmentReturnRate: 7.0,
			realEstateAppreciationRate: 3.0,
			defaultCashYield: 4.5,
			forecastStyle: "Balanced",
			lastUpdated: "",
		},
		planningNotes: [],
		...overrides,
	};
}

describe("stripManualInvestmentFromProfile", () => {
	it("removes the investment and its synthetic account", () => {
		const investmentId = "inv-529";
		const accountId = `investment-acct-${investmentId}`;
		const data = baseProfile({
			accounts: [
				{
					id: "acct-checking",
					name: "Checking",
					institution: "Bank",
					type: "Checking",
					balance: 100,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: true,
				},
				{
					id: accountId,
					name: "529",
					institution: "Manual",
					type: "529",
					balance: 5000,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: true,
				},
			],
			investments: [
				{
					id: investmentId,
					name: "529",
					type: "529",
					currentValue: 5000,
					monthlyContribution: 0,
					expectedReturn: 7,
					accountLink: accountId,
					includeInForecast: true,
				},
			],
		});

		const next = stripManualInvestmentFromProfile(data, investmentId);
		assert.equal(next.investments.length, 0);
		assert.deepEqual(
			next.accounts.map((account) => account.id),
			["acct-checking"],
		);
	});

	it("does not strip plaid investment ids", () => {
		const data = baseProfile({
			investments: [
				{
					id: "plaid_abc",
					name: "Brokerage",
					type: "Brokerage",
					currentValue: 1,
					monthlyContribution: 0,
					expectedReturn: 7,
					includeInForecast: true,
				},
			],
		});
		const next = stripManualInvestmentFromProfile(data, "plaid_abc");
		assert.equal(next.investments.length, 1);
	});
});

describe("pruneMissingManualInvestmentsFromProfile", () => {
	it("removes profile investments that are not in the canonical set", () => {
		const data = baseProfile({
			accounts: [
				{
					id: "investment-acct-keep",
					name: "Keep",
					institution: "Manual",
					type: "529",
					balance: 1,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: true,
				},
				{
					id: "investment-acct-gone",
					name: "Gone",
					institution: "Manual",
					type: "529",
					balance: 2,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: true,
				},
			],
			investments: [
				{
					id: "keep",
					name: "Keep",
					type: "529",
					currentValue: 1,
					monthlyContribution: 0,
					expectedReturn: 7,
					accountLink: "investment-acct-keep",
					includeInForecast: true,
				},
				{
					id: "gone",
					name: "Gone",
					type: "529",
					currentValue: 2,
					monthlyContribution: 0,
					expectedReturn: 7,
					accountLink: "investment-acct-gone",
					includeInForecast: true,
				},
			],
		});

		const next = pruneMissingManualInvestmentsFromProfile(
			data,
			new Set(["keep"]),
		);
		assert.deepEqual(
			next.investments.map((investment) => investment.id),
			["keep"],
		);
		assert.deepEqual(
			next.accounts.map((account) => account.id),
			["investment-acct-keep"],
		);
	});
});
