import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { applyAccountDisplayName } from "./account-name-overrides";

describe("applyAccountDisplayName", () => {
	it("returns null when there is no fallback name", () => {
		assert.equal(
			applyAccountDisplayName(
				null,
				"acct_1",
				new Map([["acct_1", "Nickname"]]),
			),
			null,
		);
	});

	it("uses the Plaid name when the user has not renamed the account", () => {
		assert.equal(
			applyAccountDisplayName("Chase Credit Card", "acct_1", new Map()),
			"Chase Credit Card",
		);
	});

	it("uses the financial profile nickname when one is stored", () => {
		assert.equal(
			applyAccountDisplayName(
				"Chase Credit Card",
				"acct_1",
				new Map([["acct_1", "Travel card"]]),
			),
			"Travel card",
		);
	});

	it("keeps the fallback name for manual accounts without a Plaid id", () => {
		assert.equal(
			applyAccountDisplayName(
				"Cash",
				null,
				new Map([["acct_1", "Travel card"]]),
			),
			"Cash",
		);
	});
});
