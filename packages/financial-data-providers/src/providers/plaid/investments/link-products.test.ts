import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	PLAID_TRANSACTIONS_DAYS_REQUESTED,
	plaidTransactionsHistoryRequest,
	resolveAdditionalConsentedProducts,
	resolvePlaidLinkProducts,
} from "./link-products";

describe("resolvePlaidLinkProducts", () => {
	it("always requires transactions only", () => {
		assert.deepEqual(resolvePlaidLinkProducts().products, ["transactions"]);
	});

	it("always requests investments as optional", () => {
		assert.deepEqual(resolvePlaidLinkProducts().optionalProducts, [
			"investments",
		]);
	});

	it("never overlaps products with optional products", () => {
		const { products, optionalProducts } = resolvePlaidLinkProducts();
		assert.equal(
			products.some((product) => optionalProducts.includes(product)),
			false,
		);
	});
});

describe("plaidTransactionsHistoryRequest", () => {
	it("always requests a full year of transaction history", () => {
		assert.equal(PLAID_TRANSACTIONS_DAYS_REQUESTED, 365);
		assert.deepEqual(plaidTransactionsHistoryRequest(), {
			days_requested: 365,
		});
	});
});

describe("resolveAdditionalConsentedProducts", () => {
	it("always requests investments on reconnect", () => {
		assert.deepEqual(resolveAdditionalConsentedProducts(), ["investments"]);
	});
});
