import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildHoldingRowsByAccount,
	type PlaidHoldingLike,
	type PlaidSecurityLike,
} from "./holding-rows";

function holding(overrides: Partial<PlaidHoldingLike> = {}): PlaidHoldingLike {
	return {
		account_id: "acct-1",
		security_id: "sec-1",
		quantity: 10,
		institution_price: 5,
		institution_value: 50,
		cost_basis: 40,
		institution_price_as_of: null,
		iso_currency_code: "USD",
		...overrides,
	};
}

function security(
	overrides: Partial<PlaidSecurityLike> = {},
): PlaidSecurityLike {
	return {
		security_id: "sec-1",
		name: "Vanguard Total Market",
		ticker_symbol: "VTI",
		type: "etf",
		close_price: 4,
		iso_currency_code: "USD",
		...overrides,
	};
}

const securities = new Map([["sec-1", security()]]);

describe("buildHoldingRowsByAccount", () => {
	it("groups holdings by plaid account id", () => {
		const result = buildHoldingRowsByAccount(
			[
				holding({ account_id: "acct-1" }),
				holding({ account_id: "acct-2", security_id: "sec-1" }),
			],
			securities,
		);

		assert.deepEqual([...result.keys()], ["acct-1", "acct-2"]);
		assert.equal(result.get("acct-1")?.length, 1);
		assert.equal(result.get("acct-2")?.length, 1);
	});

	it("carries security metadata onto the row", () => {
		const rows = buildHoldingRowsByAccount([holding()], securities);
		const row = rows.get("acct-1")?.[0];

		assert.equal(row?.tickerSymbol, "VTI");
		assert.equal(row?.name, "Vanguard Total Market");
		assert.equal(row?.securityType, "etf");
	});

	it("collapses repeats of one security into a single summed position", () => {
		const rows = buildHoldingRowsByAccount(
			[
				holding({ quantity: 10, institution_value: 50, cost_basis: 40 }),
				holding({ quantity: 4, institution_value: 20, cost_basis: 18 }),
			],
			securities,
		);
		const merged = rows.get("acct-1");

		assert.equal(merged?.length, 1);
		assert.equal(merged?.[0]?.quantity, 14);
		assert.equal(merged?.[0]?.value, 70);
		assert.equal(merged?.[0]?.costBasis, 58);
	});

	it("drops cost basis when any lot of a security is unknown", () => {
		const rows = buildHoldingRowsByAccount(
			[holding({ cost_basis: 40 }), holding({ cost_basis: null })],
			securities,
		);

		assert.equal(rows.get("acct-1")?.[0]?.costBasis, null);
	});

	it("keeps the most recent price timestamp when merging", () => {
		const rows = buildHoldingRowsByAccount(
			[
				holding({ institution_price_as_of: "2026-01-10" }),
				holding({ institution_price_as_of: "2026-02-20" }),
			],
			securities,
		);

		assert.equal(
			rows.get("acct-1")?.[0]?.priceAsOf?.toISOString(),
			new Date("2026-02-20").toISOString(),
		);
	});

	it("falls back to the security close price when the institution omits one", () => {
		const rows = buildHoldingRowsByAccount(
			[
				holding({
					institution_price: null,
					institution_value: null,
					quantity: 3,
				}),
			],
			securities,
		);
		const row = rows.get("acct-1")?.[0];

		assert.equal(row?.price, 4);
		assert.equal(row?.value, 12);
	});

	it("returns nothing for an empty holdings response", () => {
		assert.equal(buildHoldingRowsByAccount([], securities).size, 0);
	});
});
