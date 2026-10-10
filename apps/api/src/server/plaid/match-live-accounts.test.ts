import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	classifyIncomingAccounts,
	matchLiveAccounts,
} from "./match-live-accounts";

function live(overrides: {
	id: string;
	plaidAccountId?: string;
	plaidItemId?: string;
	name?: string;
	mask?: string | null;
	type?: string;
	subtype?: string | null;
}) {
	return {
		plaidAccountId: overrides.plaidAccountId ?? `plaid-${overrides.id}`,
		plaidItemId: overrides.plaidItemId ?? "item-live",
		name: "Total Checking",
		mask: "1234" as string | null,
		type: "depository",
		subtype: "checking" as string | null,
		...overrides,
	};
}

function incoming(overrides: {
	plaidAccountId: string;
	name?: string;
	mask?: string | null;
	type?: string;
	subtype?: string | null;
}) {
	return {
		name: "Total Checking",
		mask: "1234" as string | null,
		type: "depository",
		subtype: "checking" as string | null,
		...overrides,
	};
}

describe("matchLiveAccounts", () => {
	it("matches a unique mask, type, and subtype", () => {
		const matches = matchLiveAccounts({
			live: [live({ id: "row-checking" })],
			incoming: [incoming({ plaidAccountId: "new-checking" })],
		});

		assert.deepEqual(matches, [
			{
				incomingPlaidAccountId: "new-checking",
				liveAccountId: "row-checking",
				livePlaidAccountId: "plaid-row-checking",
				liveItemId: "item-live",
			},
		]);
	});

	it("falls back to name and type when the mask is missing", () => {
		const matches = matchLiveAccounts({
			live: [
				live({
					id: "row-brokerage",
					name: "  Individual   Brokerage ",
					mask: null,
					type: "investment",
					subtype: "brokerage",
				}),
			],
			incoming: [
				incoming({
					plaidAccountId: "new-brokerage",
					name: "Individual Brokerage",
					mask: null,
					type: "investment",
					subtype: "brokerage",
				}),
			],
		});

		assert.equal(matches[0]?.liveAccountId, "row-brokerage");
	});

	it("does not match when two live rows share the same fingerprint", () => {
		const matches = matchLiveAccounts({
			live: [
				live({ id: "row-a", name: "Checking A" }),
				live({ id: "row-b", name: "Checking B" }),
			],
			incoming: [incoming({ plaidAccountId: "new-checking" })],
		});

		assert.deepEqual(matches, []);
	});

	it("does not match a savings account to a checking account that shares a mask", () => {
		const matches = matchLiveAccounts({
			live: [live({ id: "row-checking", subtype: "checking" })],
			incoming: [
				incoming({
					plaidAccountId: "new-savings",
					name: "Savings",
					mask: "1234",
					type: "depository",
					subtype: "savings",
				}),
			],
		});

		assert.deepEqual(matches, []);
	});

	it("does not fall through to a unique name when mask and subtype are ambiguous", () => {
		const matches = matchLiveAccounts({
			live: [
				live({ id: "row-a", name: "Total Checking" }),
				live({ id: "row-b", name: "Other Checking" }),
			],
			incoming: [incoming({ plaidAccountId: "new-checking" })],
		});

		assert.deepEqual(matches, []);
	});

	it("matches by name when the mask is shared but names are unique", () => {
		const matches = matchLiveAccounts({
			live: [
				live({ id: "row-card", name: "Credit Card", type: "credit" }),
				live({
					id: "row-ira",
					name: "Roth IRA",
					type: "investment",
					subtype: "ira",
				}),
			],
			incoming: [
				incoming({
					plaidAccountId: "new-ira",
					name: "Roth IRA",
					mask: "1234",
					type: "investment",
					subtype: "ira",
				}),
			],
		});

		assert.equal(matches[0]?.liveAccountId, "row-ira");
	});
});

describe("classifyIncomingAccounts", () => {
	it("splits already-linked and new accounts", () => {
		const result = classifyIncomingAccounts({
			live: [live({ id: "row-checking", name: "Checking" })],
			incoming: [
				incoming({ plaidAccountId: "dup-checking", name: "Checking" }),
				incoming({
					plaidAccountId: "new-savings",
					name: "Savings",
					mask: "9999",
					type: "depository",
					subtype: "savings",
				}),
			],
		});

		assert.equal(result.alreadyLinked.length, 1);
		assert.equal(
			result.alreadyLinked[0]?.incomingPlaidAccountId,
			"dup-checking",
		);
		assert.deepEqual(
			result.newAccounts.map((account) => account.plaidAccountId),
			["new-savings"],
		);
	});
});
