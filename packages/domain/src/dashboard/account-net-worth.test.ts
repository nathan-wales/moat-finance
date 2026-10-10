import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	accountNetWorthContribution,
	shouldDefaultAccountInNetWorth,
	signedAccountBalanceForNetWorth,
} from "./account-net-worth";

describe("shouldDefaultAccountInNetWorth", () => {
	it("includes cash, investments, and credit cards", () => {
		assert.equal(
			shouldDefaultAccountInNetWorth({
				type: "depository",
				subtype: "checking",
			}),
			true,
		);
		assert.equal(
			shouldDefaultAccountInNetWorth({
				type: "investment",
				subtype: "brokerage",
			}),
			true,
		);
		assert.equal(
			shouldDefaultAccountInNetWorth({
				type: "credit",
				subtype: "credit card",
			}),
			true,
		);
	});

	it("excludes loans and mortgage subtypes", () => {
		assert.equal(
			shouldDefaultAccountInNetWorth({ type: "loan", subtype: "mortgage" }),
			false,
		);
		assert.equal(
			shouldDefaultAccountInNetWorth({ type: "loan", subtype: "student" }),
			false,
		);
		assert.equal(
			shouldDefaultAccountInNetWorth({
				type: "depository",
				subtype: "mortgage",
			}),
			false,
		);
	});
});

describe("signedAccountBalanceForNetWorth", () => {
	it("keeps asset balances positive and negates credit and loans", () => {
		assert.equal(signedAccountBalanceForNetWorth("investment", 10_000), 10_000);
		assert.equal(signedAccountBalanceForNetWorth("credit", 1_227), -1_227);
		assert.equal(signedAccountBalanceForNetWorth("loan", 750_000), -750_000);
		assert.equal(signedAccountBalanceForNetWorth("Credit", 50), -50);
	});
});

describe("accountNetWorthContribution", () => {
	it("subtracts credit cards and ignores mortgage loans", () => {
		const accounts = [
			{
				type: "depository",
				subtype: "checking",
				currentBalance: 38_000,
			},
			{
				type: "investment",
				subtype: "brokerage",
				currentBalance: 181_000,
			},
			{
				type: "credit",
				subtype: "credit card",
				currentBalance: 1_227,
			},
			{
				type: "loan",
				subtype: "mortgage",
				currentBalance: 750_000,
			},
		];
		const sum = accounts.reduce(
			(total, account) => total + accountNetWorthContribution(account),
			0,
		);
		assert.equal(sum, 38_000 + 181_000 - 1_227);
	});

	it("skips null balances", () => {
		assert.equal(
			accountNetWorthContribution({
				type: "depository",
				subtype: "checking",
				currentBalance: null,
			}),
			0,
		);
	});
});
