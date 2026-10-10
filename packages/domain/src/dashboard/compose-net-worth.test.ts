import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	composeNetWorthComponents,
	shouldIncludePlaidAccountInNetWorth,
	sumNetWorthComponents,
} from "./compose-net-worth";

describe("shouldIncludePlaidAccountInNetWorth", () => {
	it("defaults loans and mortgages out and cash in", () => {
		assert.equal(
			shouldIncludePlaidAccountInNetWorth([], {
				id: "checking",
				type: "depository",
				subtype: "checking",
			}),
			true,
		);
		assert.equal(
			shouldIncludePlaidAccountInNetWorth([], {
				id: "mortgage",
				type: "loan",
				subtype: "mortgage",
			}),
			false,
		);
	});

	it("honors profile includedInNetWorth overrides, including plaid- prefixed ids", () => {
		assert.equal(
			shouldIncludePlaidAccountInNetWorth(
				[{ id: "mortgage", includedInNetWorth: true }],
				{ id: "mortgage", type: "loan", subtype: "mortgage" },
			),
			true,
		);
		assert.equal(
			shouldIncludePlaidAccountInNetWorth(
				[{ id: "plaid-checking", includedInNetWorth: false }],
				{ id: "checking", type: "depository", subtype: "checking" },
			),
			false,
		);
	});
});

describe("composeNetWorthComponents", () => {
	it("stores credit cards as negative and skips mortgage loans", () => {
		const components = composeNetWorthComponents({
			plaidAccounts: [
				{
					id: "brokerage",
					type: "investment",
					subtype: "brokerage",
					currentBalance: 181_000,
				},
				{
					id: "card",
					type: "credit",
					subtype: "credit card",
					currentBalance: 1_227,
				},
				{
					id: "mortgage",
					type: "loan",
					subtype: "mortgage",
					currentBalance: 750_000,
				},
			],
		});

		assert.equal(sumNetWorthComponents(components), 181_000 - 1_227);
		assert.equal(
			components.find((row) => row.sourceId === "brokerage")?.balance,
			181_000,
		);
		assert.equal(
			components.find((row) => row.sourceId === "card")?.balance,
			-1_227,
		);
		assert.equal(
			components.find((row) => row.sourceId === "mortgage"),
			undefined,
		);
	});

	it("adds manual investments and real-estate equity", () => {
		const components = composeNetWorthComponents({
			plaidAccounts: [],
			investments: [{ id: "brokerage", startingBalance: 50_000 }],
			realEstate: [
				{
					id: "house",
					currentEstimatedValue: 400_000,
					currentLoanBalance: 250_000,
				},
			],
		});

		assert.deepEqual(components, [
			{ source: "INVESTMENT", sourceId: "brokerage", balance: 50_000 },
			{ source: "REAL_ESTATE", sourceId: "house", balance: 150_000 },
		]);
		assert.equal(sumNetWorthComponents(components), 200_000);
	});

	it("includes opted-in profile assets and skips real estate and excluded assets", () => {
		const components = composeNetWorthComponents({
			plaidAccounts: [],
			profileAssets: [
				{
					id: "car",
					type: "Vehicle",
					estimatedValue: 12_000,
					includeInNetWorth: true,
				},
				{
					id: "house",
					type: "Real estate",
					estimatedValue: 500_000,
					includeInNetWorth: true,
				},
				{
					id: "art",
					type: "Collectible",
					estimatedValue: 8_000,
					includeInNetWorth: false,
				},
			],
		});

		assert.deepEqual(components, [
			{
				source: "REAL_ESTATE",
				sourceId: "profile-asset-car",
				balance: 12_000,
			},
		]);
	});

	it("treats null Plaid balances as zero", () => {
		const components = composeNetWorthComponents({
			plaidAccounts: [
				{
					id: "checking",
					type: "depository",
					subtype: "checking",
					currentBalance: null,
				},
			],
		});

		assert.equal(sumNetWorthComponents(components), 0);
	});
});
