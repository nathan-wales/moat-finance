import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Transaction as PlaidTransaction } from "plaid";
import {
	mapPlaidCategory,
	mapPlaidLocation,
	mapPlaidTransactionToDbInput,
} from "./mapping";

function plaidTx(
	detailed: string,
	primary = "GENERAL_MERCHANDISE",
): PlaidTransaction {
	return {
		personal_finance_category: { detailed, primary },
	} as PlaidTransaction;
}

describe("plaid category mapping", () => {
	it("maps pet and veterinary detailed categories to Pets", () => {
		assert.equal(
			mapPlaidCategory(plaidTx("GENERAL_MERCHANDISE_PET_SUPPLIES")),
			"Pets",
		);
		assert.equal(
			mapPlaidCategory(plaidTx("MEDICAL_VETERINARY_SERVICES", "MEDICAL")),
			"Pets",
		);
	});
});

describe("plaid location mapping", () => {
	it("returns null when location is missing", () => {
		assert.equal(mapPlaidLocation(null), null);
		assert.equal(mapPlaidLocation(undefined), null);
	});

	it("returns null when every location field is empty", () => {
		assert.equal(
			mapPlaidLocation({
				address: null,
				city: "  ",
				region: null,
				postal_code: null,
				country: null,
				lat: null,
				lon: null,
				store_number: null,
			}),
			null,
		);
	});

	it("persists the full location object when any field is present", () => {
		assert.deepEqual(
			mapPlaidLocation({
				address: "1355 Sandhill Rd",
				city: "Orem",
				region: "UT",
				postal_code: "84058",
				country: "US",
				lat: 40.27,
				lon: -111.72,
				store_number: "5270",
			}),
			{
				address: "1355 Sandhill Rd",
				city: "Orem",
				region: "UT",
				postal_code: "84058",
				country: "US",
				lat: 40.27,
				lon: -111.72,
				store_number: "5270",
			},
		);
	});

	it("keeps store_number-only locations for future analytics", () => {
		assert.deepEqual(
			mapPlaidLocation({
				address: null,
				city: null,
				region: null,
				postal_code: null,
				country: null,
				lat: null,
				lon: null,
				store_number: "5270",
			}),
			{
				address: null,
				city: null,
				region: null,
				postal_code: null,
				country: null,
				lat: null,
				lon: null,
				store_number: "5270",
			},
		);
	});
});

describe("plaid original description mapping", () => {
	function mapNames(input: {
		name: string;
		original_description?: string | null;
	}) {
		return mapPlaidTransactionToDbInput({
			tx: {
				transaction_id: "tx_1",
				account_id: "acc_1",
				amount: 12.34,
				date: "2026-09-01",
				name: input.name,
				merchant_name: "Ticket Office",
				original_description: input.original_description,
				pending: false,
				iso_currency_code: "USD",
				unofficial_currency_code: null,
				payment_channel: "online",
			} as PlaidTransaction,
			userId: "user_1",
			plaidItemDbId: "item_1",
			plaidAccountDbId: "acct_1",
			categoryNameToId: new Map(),
			uncategorizedCategoryId: "cat_uncat",
		});
	}

	it("stores original_description separately from name", () => {
		const { create, update } = mapNames({
			name: "TICKET OFFICE",
			original_description: "TICKET OFFICE WEB UT",
		});
		assert.equal(create.description, "TICKET OFFICE");
		assert.equal(create.originalDescription, "TICKET OFFICE WEB UT");
		assert.equal(update.description, "TICKET OFFICE");
		assert.equal(update.originalDescription, "TICKET OFFICE WEB UT");
	});

	it("does not fall back originalDescription to name when Plaid omits it", () => {
		const { create, update } = mapNames({
			name: "TICKET OFFICE",
			original_description: null,
		});
		assert.equal(create.description, "TICKET OFFICE");
		assert.equal(create.originalDescription, null);
		assert.equal(update.originalDescription, null);
	});
});

describe("plaid split amount mapping", () => {
	it("does not overwrite amount on split parents", () => {
		const mapped = mapPlaidTransactionToDbInput({
			tx: {
				transaction_id: "tx_1",
				account_id: "acc_1",
				amount: 99.99,
				date: "2026-09-01",
				name: "Store",
				pending: false,
				iso_currency_code: "USD",
				unofficial_currency_code: null,
				payment_channel: "in store",
			} as PlaidTransaction,
			userId: "user_1",
			plaidItemDbId: "item_1",
			plaidAccountDbId: "acct_1",
			existingTransaction: {
				categoryId: "cat_uncat",
				category: "Uncategorized",
				splitGroupId: "tx_existing",
			},
			categoryNameToId: new Map(),
			uncategorizedCategoryId: "cat_uncat",
		});
		assert.equal("amount" in mapped.update, false);
	});
});
