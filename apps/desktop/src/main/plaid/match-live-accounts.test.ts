import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchLiveAccounts } from "./match-live-accounts";

describe("desktop matchLiveAccounts", () => {
	it("skips an ambiguous fingerprint instead of taking the first row", () => {
		const matches = matchLiveAccounts({
			live: [
				{
					id: "a",
					plaidAccountId: "old-a",
					plaidItemId: "item-1",
					name: "Checking A",
					mask: "1234",
					type: "depository",
					subtype: "checking",
				},
				{
					id: "b",
					plaidAccountId: "old-b",
					plaidItemId: "item-1",
					name: "Checking B",
					mask: "1234",
					type: "depository",
					subtype: "checking",
				},
			],
			incoming: [
				{
					plaidAccountId: "new",
					name: "Total Checking",
					mask: "1234",
					type: "depository",
					subtype: "checking",
				},
			],
		});

		assert.deepEqual(matches, []);
	});

	it("does not match a savings account to a checking account that shares a mask", () => {
		const matches = matchLiveAccounts({
			live: [
				{
					id: "checking",
					plaidAccountId: "old-checking",
					plaidItemId: "item-1",
					name: "Total Checking",
					mask: "1234",
					type: "depository",
					subtype: "checking",
				},
			],
			incoming: [
				{
					plaidAccountId: "new-savings",
					name: "Savings",
					mask: "1234",
					type: "depository",
					subtype: "savings",
				},
			],
		});

		assert.deepEqual(matches, []);
	});
});
