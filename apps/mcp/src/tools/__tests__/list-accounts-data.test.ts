import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyAccountType,
	formatInvestmentAccountType,
	type ListedAccount,
	mergeProfileSectionAccounts,
} from "../list-accounts-data";

function syncedChecking(): ListedAccount {
	return {
		id: "plaid_checking",
		name: "Chase Total Checking",
		mask: "••••1234",
		type: "Checking",
		subtype: "checking",
		accountClass: "depository",
		isInvestmentAccount: false,
		connectionStatus: "Synced",
		providerType: "depository",
		providerSubtype: "checking",
		currentBalance: 8_400,
		availableBalance: 8_400,
		currency: "USD",
		isActive: true,
		institutionName: "Chase",
		requiresReconnect: false,
		lastSuccessfulSyncAt: "2026-08-01T00:00:00.000Z",
		syncStatus: "ok",
	};
}

describe("list accounts data", () => {
	it("formats common investment account types", () => {
		assert.equal(formatInvestmentAccountType("FOUR01K"), "401(k)");
		assert.equal(formatInvestmentAccountType("ROTH_IRA"), "Roth IRA");
		assert.equal(formatInvestmentAccountType("STOCKS"), "Brokerage");
		assert.equal(formatInvestmentAccountType("HSA"), "HSA");
	});

	it("classifies provider and display types for AI distinction", () => {
		assert.deepEqual(
			classifyAccountType({
				type: "depository",
				subtype: "checking",
				providerType: "depository",
			}),
			{
				type: "Checking",
				accountClass: "depository",
				isInvestmentAccount: false,
			},
		);
		assert.deepEqual(
			classifyAccountType({
				type: "investment",
				subtype: "roth",
				providerType: "investment",
			}),
			{
				type: "Roth IRA",
				accountClass: "investment",
				isInvestmentAccount: true,
			},
		);
		assert.deepEqual(
			classifyAccountType({
				type: "Brokerage",
				providerType: null,
			}),
			{
				type: "Brokerage",
				accountClass: "investment",
				isInvestmentAccount: true,
			},
		);
	});

	it("merges synced, stored manual, and investment accounts", () => {
		const accounts = mergeProfileSectionAccounts({
			storedAccounts: [
				{
					id: "mortgage_1",
					name: "Primary Mortgage",
					institution: "Manual",
					type: "Mortgage",
					balance: -384_200,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: false,
				},
				{
					id: "plaid_checking",
					name: "Chase Total Checking",
					institution: "Chase",
					type: "Checking",
					balance: 8_400,
					connectionStatus: "Synced",
					lastSynced: "2 days ago",
					includedInNetWorth: true,
				},
			],
			storedInvestments: [
				{
					id: "inv_401k",
					accountLink: "investment-acct-inv_401k",
				},
			],
			manualInvestments: [
				{
					id: "inv_401k",
					name: "401(k) — Fidelity",
					type: "FOUR01K",
					startingBalance: 78_500,
				},
				{
					id: "inv_brokerage",
					name: "Brokerage — Vanguard",
					type: "STOCKS",
					startingBalance: 35_000,
				},
			],
			plaidAccounts: [syncedChecking()],
			appleAccounts: [],
		});

		assert.deepEqual(
			accounts.map((account) => account.id).sort(),
			[
				"investment-acct-inv_401k",
				"investment-acct-inv_brokerage",
				"mortgage_1",
				"plaid_checking",
			].sort(),
		);

		const brokerage = accounts.find(
			(account) => account.id === "investment-acct-inv_brokerage",
		);
		assert.equal(brokerage?.type, "Brokerage");
		assert.equal(brokerage?.accountClass, "investment");
		assert.equal(brokerage?.isInvestmentAccount, true);
		assert.equal(brokerage?.connectionStatus, "Manual");
		assert.equal(brokerage?.institutionName, "Vanguard");
		assert.equal(brokerage?.currentBalance, 35_000);
		assert.equal(brokerage?.syncStatus, "manual");

		const retirement = accounts.find(
			(account) => account.id === "investment-acct-inv_401k",
		);
		assert.equal(retirement?.type, "401(k)");
		assert.equal(retirement?.isInvestmentAccount, true);

		const checking = accounts.find(
			(account) => account.id === "plaid_checking",
		);
		assert.equal(checking?.type, "Checking");
		assert.equal(checking?.accountClass, "depository");
		assert.equal(checking?.isInvestmentAccount, false);

		const mortgage = accounts.find((account) => account.id === "mortgage_1");
		assert.equal(mortgage?.type, "Mortgage");
		assert.equal(mortgage?.accountClass, "loan");
		assert.equal(mortgage?.currentBalance, -384_200);
		assert.equal(mortgage?.syncStatus, "manual");
	});

	it("skips hidden manual accounts and does not invent real-estate rows", () => {
		const accounts = mergeProfileSectionAccounts({
			storedAccounts: [
				{
					id: "hidden_manual",
					name: "Hidden",
					institution: "Manual",
					type: "Other",
					balance: 1,
					connectionStatus: "Manual",
					lastSynced: "Manual",
					includedInNetWorth: true,
					hidden: true,
				},
			],
			storedInvestments: [],
			manualInvestments: [],
			plaidAccounts: [],
			appleAccounts: [],
		});

		assert.deepEqual(accounts, []);
	});
});
