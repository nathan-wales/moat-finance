import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	encodePlaidProductList,
	parseJsonStringArray,
	parseStoredPlaidProductCapabilities,
} from "./product-capabilities";

describe("parseJsonStringArray", () => {
	it("parses a JSON string array", () => {
		assert.deepEqual(parseJsonStringArray('["transactions","investments"]'), [
			"transactions",
			"investments",
		]);
	});

	it("returns empty for invalid JSON", () => {
		assert.deepEqual(parseJsonStringArray("not-json"), []);
		assert.deepEqual(parseJsonStringArray(null), []);
	});
});

describe("parseStoredPlaidProductCapabilities", () => {
	it("decodes SQLite JSON columns into capability arrays", () => {
		assert.deepEqual(
			parseStoredPlaidProductCapabilities({
				billedProductsJson: encodePlaidProductList(["transactions"]),
				availableProductsJson: encodePlaidProductList(["investments"]),
				consentedProductsJson: "[]",
			}),
			{
				billedProducts: ["transactions"],
				availableProducts: ["investments"],
				consentedProducts: [],
			},
		);
	});
});
