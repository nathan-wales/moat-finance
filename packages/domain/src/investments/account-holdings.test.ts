import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	EMPTY_ACCOUNT_HOLDINGS_RESULT,
	plaidAccountIdsForHoldingsLookup,
	toAccountHoldingsResult,
} from "./account-holdings";

describe("plaidAccountIdsForHoldingsLookup", () => {
	it("extracts the id from a plaid- prefix", () => {
		assert.deepEqual(plaidAccountIdsForHoldingsLookup("plaid-abc"), ["abc"]);
	});

	it("tries the raw id as Plaid when unprefixed", () => {
		assert.deepEqual(plaidAccountIdsForHoldingsLookup("abc"), ["abc"]);
	});

	it("ignores investment-acct ids", () => {
		assert.deepEqual(
			plaidAccountIdsForHoldingsLookup("investment-acct-abc"),
			[],
		);
	});
});

describe("toAccountHoldingsResult", () => {
	it("returns empty when there are no rows", () => {
		assert.deepEqual(
			toAccountHoldingsResult([]),
			EMPTY_ACCOUNT_HOLDINGS_RESULT,
		);
	});

	it("sums value and uses the latest syncedAt", () => {
		const result = toAccountHoldingsResult([
			{
				securityId: "sec-1",
				name: "VTI",
				tickerSymbol: "VTI",
				securityType: "etf",
				quantity: 2,
				price: 10,
				value: 20,
				costBasis: 18,
				currency: "USD",
				syncedAt: new Date("2026-01-01T00:00:00.000Z"),
			},
			{
				securityId: "sec-2",
				name: "VOO",
				tickerSymbol: "VOO",
				securityType: "etf",
				quantity: 1,
				price: 30,
				value: 30,
				costBasis: 25,
				currency: "USD",
				syncedAt: new Date("2026-02-01T00:00:00.000Z"),
			},
		]);

		assert.equal(result.totalValue, 50);
		assert.equal(result.lastSyncedAt, "2026-02-01T00:00:00.000Z");
		assert.equal(result.holdings.length, 2);
		assert.equal(result.holdings[0] && "syncedAt" in result.holdings[0], false);
	});
});
