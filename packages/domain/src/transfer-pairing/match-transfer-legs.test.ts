import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	legsFormValidTransferPair,
	legsSatisfyAccountTypeGuard,
	matchTransferLegs,
	resolveAccountTypeKind,
	type TransferMatchLeg,
	transferHideUpdate,
	transferLookbackBounds,
	transferPairStillValid,
} from "./match-transfer-legs";

const DAY_MS = 24 * 60 * 60 * 1000;
const BASE = Date.parse("2026-07-10T00:00:00Z");

function leg(
	overrides: Partial<TransferMatchLeg> & { id: string },
): TransferMatchLeg {
	return {
		type: "EXPENSE",
		amountKey: "10000.00",
		currency: "USD",
		accountKey: "acct-a",
		timeMs: BASE,
		hidden: false,
		autoHiddenAsTransfer: false,
		categoryName: "Transfer",
		accountTypeKind: "unknown",
		...overrides,
	};
}

describe("matchTransferLegs", () => {
	it("pairs a same-day outflow and inflow of equal amount across accounts", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking" }),
			leg({ id: "in", type: "INCOME", accountKey: "brokerage" }),
		]);

		assert.equal(matches.length, 1);
		assert.equal(matches[0]?.expense.id, "out");
		assert.equal(matches[0]?.income.id, "in");
	});

	it("pairs a delayed leg that arrives a day later within the window", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking", timeMs: BASE }),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "brokerage",
				timeMs: BASE + DAY_MS,
			}),
		]);

		assert.equal(matches.length, 1);
	});

	it("does not pair legs outside the time window", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking", timeMs: BASE }),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "brokerage",
				timeMs: BASE + 6 * DAY_MS,
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("leaves a one-sided transfer visible when the other account is not connected", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking" }),
		]);

		assert.equal(matches.length, 0);
	});

	it("does not pair across different currencies", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				currency: "USD",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "brokerage",
				currency: "EUR",
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("does not pair different amounts", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				amountKey: "10000.00",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "brokerage",
				amountKey: "9999.99",
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("pairs Transfer legs on the same account within 5 days", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking" }),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "checking",
				timeMs: BASE + DAY_MS,
			}),
		]);

		assert.equal(matches.length, 1);
		assert.equal(matches[0]?.expense.id, "out");
		assert.equal(matches[0]?.income.id, "in");
	});

	it("skips legs with no resolvable account", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: null }),
			leg({ id: "in", type: "INCOME", accountKey: "brokerage" }),
		]);

		assert.equal(matches.length, 0);
	});

	it("pairs the nearest-in-time inflow when multiple candidates match", () => {
		const matches = matchTransferLegs([
			leg({ id: "out", type: "EXPENSE", accountKey: "checking", timeMs: BASE }),
			leg({
				id: "in-far",
				type: "INCOME",
				accountKey: "brokerage",
				timeMs: BASE + 4 * DAY_MS,
			}),
			leg({
				id: "in-near",
				type: "INCOME",
				accountKey: "savings",
				timeMs: BASE + DAY_MS,
			}),
		]);

		assert.equal(matches.length, 1);
		assert.equal(matches[0]?.income.id, "in-near");
	});

	it("pairs two independent transfers of the same amount by proximity", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out-1",
				type: "EXPENSE",
				accountKey: "checking",
				timeMs: BASE,
			}),
			leg({
				id: "in-1",
				type: "INCOME",
				accountKey: "brokerage",
				timeMs: BASE,
			}),
			leg({
				id: "out-2",
				type: "EXPENSE",
				accountKey: "checking",
				timeMs: BASE + 3 * DAY_MS,
			}),
			leg({
				id: "in-2",
				type: "INCOME",
				accountKey: "brokerage",
				timeMs: BASE + 3 * DAY_MS,
			}),
		]);

		assert.equal(matches.length, 2);
		const pairedIds = new Set(
			matches.flatMap((m) => [m.expense.id, m.income.id]),
		);
		assert.equal(pairedIds.size, 4);
	});

	it("pairs Credit card payment ↔ Credit card payment", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "card",
				categoryName: "Credit card payment",
				accountTypeKind: "credit",
			}),
		]);

		assert.equal(matches.length, 1);
	});

	it("pairs Credit card payment ↔ Transfer (mixed)", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "card",
				categoryName: "Transfer",
				accountTypeKind: "credit",
			}),
		]);

		assert.equal(matches.length, 1);
	});

	it("does not pair non-pairable categories even with equal amount and time", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Shopping",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "card",
				categoryName: "Salary",
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("rejects CC-payment pairs when both accounts are known non-credit", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "savings",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("rejects CC-payment pairs when both accounts are known credit", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "card-a",
				categoryName: "Credit card payment",
				accountTypeKind: "credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "card-b",
				categoryName: "Credit card payment",
				accountTypeKind: "credit",
			}),
		]);

		assert.equal(matches.length, 0);
	});

	it("does not pair Uncategorized with Transfer or Credit card payment", () => {
		const transferMatches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Uncategorized",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "savings",
				categoryName: "Transfer",
			}),
		]);
		assert.equal(transferMatches.length, 0);

		const ccMatches = matchTransferLegs([
			leg({
				id: "out-cc",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Uncategorized",
			}),
			leg({
				id: "in-cc",
				type: "INCOME",
				accountKey: "card",
				categoryName: "Credit card payment",
				accountTypeKind: "credit",
			}),
		]);
		assert.equal(ccMatches.length, 0);
	});

	it("skips the CC account-type guard when both legs share an account", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
		]);

		assert.equal(matches.length, 1);
	});

	it("allows CC-payment pairs when either account type is unknown", () => {
		const matches = matchTransferLegs([
			leg({
				id: "out",
				type: "EXPENSE",
				accountKey: "checking",
				categoryName: "Credit card payment",
				accountTypeKind: "non_credit",
			}),
			leg({
				id: "in",
				type: "INCOME",
				accountKey: "card",
				categoryName: "Credit card payment",
				accountTypeKind: "unknown",
			}),
		]);

		assert.equal(matches.length, 1);
	});
});

describe("transferHideUpdate", () => {
	it("hides a visible leg and marks it as auto-hidden", () => {
		assert.deepEqual(transferHideUpdate({ hidden: false }), {
			hidden: true,
			autoHiddenAsTransfer: true,
		});
	});

	it("preserves a leg the user already hid", () => {
		assert.equal(transferHideUpdate({ hidden: true }), null);
	});
});

describe("legsFormValidTransferPair", () => {
	it("validates a still-matching pair", () => {
		const a = leg({ id: "a", type: "EXPENSE", accountKey: "checking" });
		const b = leg({
			id: "b",
			type: "INCOME",
			accountKey: "brokerage",
			timeMs: BASE + DAY_MS,
		});
		assert.equal(legsFormValidTransferPair(a, b), true);
	});

	it("invalidates a pair whose amount no longer matches (reconcile case)", () => {
		const a = leg({ id: "a", type: "EXPENSE", accountKey: "checking" });
		const b = leg({
			id: "b",
			type: "INCOME",
			accountKey: "brokerage",
			amountKey: "500.00",
		});
		assert.equal(legsFormValidTransferPair(a, b), false);
	});

	it("validates a same-account Transfer pair within the window", () => {
		const a = leg({ id: "a", type: "EXPENSE", accountKey: "checking" });
		const b = leg({
			id: "b",
			type: "INCOME",
			accountKey: "checking",
			timeMs: BASE + DAY_MS,
		});
		assert.equal(legsFormValidTransferPair(a, b), true);
	});

	it("invalidates a pair that drifted outside the window", () => {
		const a = leg({
			id: "a",
			type: "EXPENSE",
			accountKey: "checking",
			timeMs: BASE,
		});
		const b = leg({
			id: "b",
			type: "INCOME",
			accountKey: "brokerage",
			timeMs: BASE + 10 * DAY_MS,
		});
		assert.equal(legsFormValidTransferPair(a, b), false);
	});
});

describe("transferPairStillValid", () => {
	it("requires exactly two still-present matching legs", () => {
		const a = leg({ id: "a", type: "EXPENSE", accountKey: "checking" });
		const b = leg({ id: "b", type: "INCOME", accountKey: "brokerage" });
		assert.equal(transferPairStillValid([a, b]), true);
		assert.equal(transferPairStillValid([a]), false);
		assert.equal(
			transferPairStillValid([
				{ ...a, removedAt: new Date() },
				{ ...b, removedAt: null },
			]),
			false,
		);
	});
});

describe("transferLookbackBounds", () => {
	it("expands min/max times by the match window", () => {
		const bounds = transferLookbackBounds([BASE, BASE + DAY_MS]);
		assert.ok(bounds);
		assert.equal(bounds.gte.getTime(), BASE - 5 * DAY_MS);
		assert.equal(bounds.lte.getTime(), BASE + DAY_MS + 5 * DAY_MS);
	});

	it("returns null for an empty set", () => {
		assert.equal(transferLookbackBounds([]), null);
	});

	it("ignores non-finite times and returns null when none are valid", () => {
		const bounds = transferLookbackBounds([BASE, Number.NaN]);
		assert.ok(bounds);
		assert.equal(bounds.gte.getTime(), BASE - 5 * DAY_MS);
		assert.equal(bounds.lte.getTime(), BASE + 5 * DAY_MS);
		assert.equal(
			transferLookbackBounds([Number.NaN, Number.POSITIVE_INFINITY]),
			null,
		);
	});
});

describe("legsSatisfyAccountTypeGuard", () => {
	it("skips the guard for Transfer-only pairs", () => {
		assert.equal(
			legsSatisfyAccountTypeGuard(
				{ categoryName: "Transfer", accountTypeKind: "non_credit" },
				{ categoryName: "Transfer", accountTypeKind: "non_credit" },
			),
			true,
		);
	});

	it("requires credit ↔ non-credit when both types are known for CC payment", () => {
		assert.equal(
			legsSatisfyAccountTypeGuard(
				{
					categoryName: "Credit card payment",
					accountTypeKind: "non_credit",
				},
				{ categoryName: "Transfer", accountTypeKind: "credit" },
			),
			true,
		);
		assert.equal(
			legsSatisfyAccountTypeGuard(
				{
					categoryName: "Credit card payment",
					accountTypeKind: "non_credit",
				},
				{ categoryName: "Transfer", accountTypeKind: "non_credit" },
			),
			false,
		);
	});
});

describe("resolveAccountTypeKind", () => {
	it("maps Plaid credit types", () => {
		assert.equal(resolveAccountTypeKind("credit", "credit card"), "credit");
		assert.equal(
			resolveAccountTypeKind("depository", "checking"),
			"non_credit",
		);
		assert.equal(resolveAccountTypeKind(null, null), "unknown");
	});
});
