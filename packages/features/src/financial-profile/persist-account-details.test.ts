import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { FinancialProfileData } from "@moat/contracts";
import { QueryClient } from "@tanstack/react-query";
import {
	type AccountDetailPersistApi,
	deleteAccountFromProfile,
} from "./persist-account-details";

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

function createApi(overrides: Partial<AccountDetailPersistApi> = {}) {
	const calls: Array<{
		method: string;
		input: Record<string, unknown>;
	}> = [];
	const api: AccountDetailPersistApi = {
		createInvestment: async () => {
			throw new Error("createInvestment should not run");
		},
		updateInvestment: async () => {
			throw new Error("updateInvestment should not run");
		},
		deleteInvestment: async (input) => {
			calls.push({ method: "deleteInvestment", input });
		},
		setAccountSyncEnabled: async (input) => {
			calls.push({ method: "setAccountSyncEnabled", input });
			return { id: input.accountId, syncEnabled: input.syncEnabled };
		},
		...overrides,
	};
	return { api, calls };
}

describe("deleteAccountFromProfile", () => {
	it("disables sync for a synced account instead of disconnecting the Item", async () => {
		const { api, calls } = createApi();
		const data = emptyProfile({
			accounts: [
				{
					id: "plaid-acct-1",
					name: "Robinhood Credit Card",
					institution: "Robinhood",
					type: "Credit card",
					balance: 100,
					connectionStatus: "Synced",
					lastSynced: "just now",
					includedInNetWorth: true,
					plaidItemId: "item-1",
				},
				{
					id: "plaid-acct-2",
					name: "Robinhood Brokerage",
					institution: "Robinhood",
					type: "Brokerage",
					balance: 200,
					connectionStatus: "Synced",
					lastSynced: "just now",
					includedInNetWorth: true,
					plaidItemId: "item-1",
				},
			],
		});
		let next = data;
		await deleteAccountFromProfile(
			{
				api,
				data,
				onChange: (updated) => {
					next = updated;
				},
				queryClient: new QueryClient(),
			},
			"plaid-acct-1",
		);

		assert.deepEqual(calls, [
			{
				method: "setAccountSyncEnabled",
				input: { accountId: "acct-1", syncEnabled: false },
			},
		]);
		assert.equal(next.accounts.length, 1);
		assert.equal(next.accounts[0]?.id, "plaid-acct-2");
	});

	it("does not call setAccountSyncEnabled for a manual account", async () => {
		const { api, calls } = createApi();
		const data = emptyProfile({
			accounts: [
				{
					id: "manual-1",
					name: "Cash",
					institution: "Wallet",
					type: "Cash",
					balance: 50,
					connectionStatus: "Manual",
					lastSynced: "",
					includedInNetWorth: true,
				},
			],
		});
		await deleteAccountFromProfile(
			{
				api,
				data,
				onChange: () => undefined,
				queryClient: new QueryClient(),
			},
			"manual-1",
		);
		assert.deepEqual(calls, []);
	});
});
