import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	type AdoptableAccount,
	type IncomingAccount,
	matchAdoptableAccounts,
} from "./match-adoptable-accounts";

function candidate(
	overrides: Partial<AdoptableAccount> & { id: string },
): AdoptableAccount {
	return {
		mask: null,
		name: "Total Checking",
		plaidAccountId: `old-${overrides.id}`,
		subtype: "checking",
		type: "depository",
		...overrides,
	};
}

function incoming(
	overrides: Partial<IncomingAccount> & { plaidAccountId: string },
): IncomingAccount {
	return {
		mask: null,
		name: "Total Checking",
		subtype: "checking",
		type: "depository",
		...overrides,
	};
}

describe("matchAdoptableAccounts", () => {
	it("repoints a paused row when mask, type, and subtype match", () => {
		const matches = matchAdoptableAccounts({
			candidates: [candidate({ id: "row-checking", mask: "1234" })],
			incoming: [incoming({ mask: "1234", plaidAccountId: "new-checking" })],
			takenPlaidAccountIds: [],
		});

		assert.deepEqual(matches, [
			{ rowId: "row-checking", plaidAccountId: "new-checking" },
		]);
	});

	it("falls back to normalized name and type when the mask is missing", () => {
		const matches = matchAdoptableAccounts({
			candidates: [
				candidate({
					id: "row-brokerage",
					name: "  Individual   Brokerage ",
					subtype: "brokerage",
					type: "investment",
				}),
			],
			incoming: [
				incoming({
					name: "Individual Brokerage",
					plaidAccountId: "new-brokerage",
					subtype: "brokerage",
					type: "investment",
				}),
			],
			takenPlaidAccountIds: [],
		});

		assert.equal(matches[0]?.rowId, "row-brokerage");
	});

	it("does not match across account types", () => {
		const matches = matchAdoptableAccounts({
			candidates: [candidate({ id: "row-card", mask: "1234", type: "credit" })],
			incoming: [
				incoming({
					mask: "1234",
					plaidAccountId: "new-checking",
					type: "depository",
				}),
			],
			takenPlaidAccountIds: [],
		});

		assert.deepEqual(matches, []);
	});

	it("skips incoming accounts we already store, since the id is unique", () => {
		const matches = matchAdoptableAccounts({
			candidates: [candidate({ id: "row-checking", mask: "1234" })],
			incoming: [incoming({ mask: "1234", plaidAccountId: "same-checking" })],
			takenPlaidAccountIds: ["same-checking"],
		});

		assert.deepEqual(matches, []);
	});

	it("claims each paused row at most once", () => {
		const matches = matchAdoptableAccounts({
			candidates: [candidate({ id: "row-checking", mask: "1234" })],
			incoming: [
				incoming({ mask: "1234", plaidAccountId: "new-checking-a" }),
				incoming({ mask: "1234", plaidAccountId: "new-checking-b" }),
			],
			takenPlaidAccountIds: [],
		});

		assert.equal(matches.length, 1);
	});

	it("matches every incoming account when candidates share a fingerprint", () => {
		const matches = matchAdoptableAccounts({
			candidates: [
				candidate({ id: "row-a", name: "Savings" }),
				candidate({ id: "row-b", name: "Savings" }),
			],
			incoming: [
				incoming({ name: "Savings", plaidAccountId: "new-a" }),
				incoming({ name: "Savings", plaidAccountId: "new-b" }),
			],
			takenPlaidAccountIds: [],
		});

		assert.deepEqual(matches, [
			{ rowId: "row-a", plaidAccountId: "new-a" },
			{ rowId: "row-b", plaidAccountId: "new-b" },
		]);
	});

	it("prefers a mask match over a name match", () => {
		const matches = matchAdoptableAccounts({
			candidates: [
				candidate({ id: "row-by-name", mask: null, name: "Checking" }),
				candidate({ id: "row-by-mask", mask: "9876", name: "Legacy" }),
			],
			incoming: [
				incoming({ mask: "9876", name: "Checking", plaidAccountId: "new-1" }),
			],
			takenPlaidAccountIds: [],
		});

		assert.deepEqual(matches, [
			{ rowId: "row-by-mask", plaidAccountId: "new-1" },
		]);
	});

	it("returns nothing when there is no paused row to adopt", () => {
		assert.deepEqual(
			matchAdoptableAccounts({
				candidates: [],
				incoming: [incoming({ plaidAccountId: "new-1" })],
				takenPlaidAccountIds: [],
			}),
			[],
		);
	});
});
