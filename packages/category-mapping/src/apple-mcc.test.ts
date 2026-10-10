import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapAppleFinanceKitCategory } from "./apple";
import {
	buildAppleFinanceKitRawPayload,
	categoryFromMerchantCategoryCode,
	normalizeMcc,
} from "./apple-mcc";

describe("apple-financekit-mcc-mapping", () => {
	it("normalizes MCC values to 4-digit strings", () => {
		assert.equal(normalizeMcc("5812"), "5812");
		assert.equal(normalizeMcc(5812), "5812");
		assert.equal(normalizeMcc("581"), "0581");
		assert.equal(normalizeMcc(null), null);
		assert.equal(normalizeMcc("FOO"), null);
	});

	it("maps representative exact MCC codes", () => {
		assert.equal(categoryFromMerchantCategoryCode("5812"), "Eating Out");
		assert.equal(categoryFromMerchantCategoryCode("5411"), "Groceries");
		assert.equal(categoryFromMerchantCategoryCode("5541"), "Gas");
		assert.equal(categoryFromMerchantCategoryCode("5200"), "Home");
		assert.equal(categoryFromMerchantCategoryCode("7011"), "Travel");
		assert.equal(categoryFromMerchantCategoryCode("6513"), "Mortgage & Rent");
		assert.equal(categoryFromMerchantCategoryCode("5815"), "Subscriptions");
		assert.equal(categoryFromMerchantCategoryCode("8220"), "Education");
		assert.equal(categoryFromMerchantCategoryCode("0742"), "Pets");
		assert.equal(categoryFromMerchantCategoryCode("742"), "Pets");
	});

	it("maps airline range MCC codes to Flights", () => {
		assert.equal(categoryFromMerchantCategoryCode("3001"), "Flights");
		assert.equal(categoryFromMerchantCategoryCode("3200"), "Flights");
	});

	it("returns Uncategorized for null or unmapped numeric MCC", () => {
		assert.equal(categoryFromMerchantCategoryCode(null), "Uncategorized");
		assert.equal(categoryFromMerchantCategoryCode(undefined), "Uncategorized");
	});

	it("delegates numeric MCC through mapAppleFinanceKitCategory", () => {
		assert.equal(mapAppleFinanceKitCategory("5812"), "Eating Out");
		assert.equal(mapAppleFinanceKitCategory("5411"), "Groceries");
	});

	it("preserves legacy string enum fallback", () => {
		assert.equal(mapAppleFinanceKitCategory("RESTAURANTS"), "Eating Out");
		assert.equal(mapAppleFinanceKitCategory("GROCERIES"), "Groceries");
	});

	it("defaults non-numeric garbage to Uncategorized", () => {
		assert.equal(
			mapAppleFinanceKitCategory("NOT_A_REAL_CATEGORY"),
			"Uncategorized",
		);
		assert.equal(mapAppleFinanceKitCategory(null), "Uncategorized");
	});

	it("builds raw payload with normalized merchantCategoryCode", () => {
		assert.deepEqual(buildAppleFinanceKitRawPayload(null, "5812"), {
			merchantCategoryCode: "5812",
		});
		assert.deepEqual(
			buildAppleFinanceKitRawPayload({ source: "wallet" }, "742"),
			{
				source: "wallet",
				merchantCategoryCode: "0742",
			},
		);
		assert.equal(buildAppleFinanceKitRawPayload(null, null), null);
	});

	it("persists non-PII FinanceKit signal fields in raw payload", () => {
		assert.deepEqual(
			buildAppleFinanceKitRawPayload(null, null, {
				transactionType: "transfer",
				foreignCurrencyCode: "EUR",
				creditDebitIndicator: "debit",
			}),
			{
				transactionType: "transfer",
				foreignCurrencyCode: "EUR",
				creditDebitIndicator: "debit",
			},
		);
	});
});
