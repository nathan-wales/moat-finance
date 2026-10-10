import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { mapPlaidCategory } from "./plaid";

function plaidTx(detailed: string, primary = "GENERAL_MERCHANDISE") {
	return {
		personal_finance_category: { detailed, primary },
	};
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

	it("maps primary categories to canonical Moat names", () => {
		assert.equal(
			mapPlaidCategory({
				personal_finance_category: {
					primary: "FOOD_AND_DRINK",
					detailed: "FOOD_AND_DRINK_RESTAURANT",
				},
			}),
			"Eating Out",
		);
		assert.equal(
			mapPlaidCategory({
				personal_finance_category: { primary: "INCOME" },
			}),
			"Salary",
		);
		assert.equal(
			mapPlaidCategory(plaidTx("INCOME_DIVIDENDS", "INCOME")),
			"Investments",
		);
		assert.equal(
			mapPlaidCategory(plaidTx("INCOME_INTEREST_EARNED", "INCOME")),
			"Investments",
		);
		assert.equal(
			mapPlaidCategory({
				personal_finance_category: { primary: "RENT_AND_UTILITIES" },
			}),
			"Bills & Utilities",
		);
	});
});
