import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	itemHasPlaidProduct,
	plaidItemCapabilitiesFromItemGet,
	shouldSyncPlaidInvestmentsHoldings,
} from "./item-capabilities";

describe("plaidItemCapabilitiesFromItemGet", () => {
	it("normalizes product arrays from /item/get", () => {
		assert.deepEqual(
			plaidItemCapabilitiesFromItemGet({
				billed_products: ["Transactions", "Investments"],
				available_products: [" Liabilities "],
				consented_products: null,
			}),
			{
				billedProducts: ["transactions", "investments"],
				availableProducts: ["liabilities"],
				consentedProducts: [],
			},
		);
	});
});

describe("itemHasPlaidProduct", () => {
	it("is true when billed products include the product", () => {
		assert.equal(
			itemHasPlaidProduct(
				{ billedProducts: ["transactions", "investments"] },
				"investments",
			),
			true,
		);
	});

	it("is false when billed products omit the product", () => {
		assert.equal(
			itemHasPlaidProduct({ billedProducts: ["transactions"] }, "investments"),
			false,
		);
	});
});

describe("shouldSyncPlaidInvestmentsHoldings", () => {
	it("attempts holdings when capabilities are unknown", () => {
		assert.equal(
			shouldSyncPlaidInvestmentsHoldings({
				billedProducts: [],
				availableProducts: [],
				consentedProducts: [],
			}),
			true,
		);
	});

	it("syncs when investments is billed", () => {
		assert.equal(
			shouldSyncPlaidInvestmentsHoldings({
				billedProducts: ["transactions", "investments"],
				availableProducts: [],
				consentedProducts: ["investments"],
			}),
			true,
		);
	});

	it("syncs when investments is consented but not yet billed", () => {
		assert.equal(
			shouldSyncPlaidInvestmentsHoldings({
				billedProducts: ["transactions"],
				availableProducts: ["investments"],
				consentedProducts: ["Investments"],
			}),
			true,
		);
	});

	it("skips when investments is available but not consented or billed", () => {
		assert.equal(
			shouldSyncPlaidInvestmentsHoldings({
				billedProducts: ["transactions"],
				availableProducts: ["investments"],
				consentedProducts: ["transactions"],
			}),
			false,
		);
	});
});
