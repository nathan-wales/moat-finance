import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CANONICAL_DEFAULT_CATEGORIES,
	isUngroupedCanonicalCategory,
	resolveCategoryParent,
} from "./canonical-categories";

function parentOf(name: string) {
	return (
		CANONICAL_DEFAULT_CATEGORIES.find((category) => category.name === name)
			?.parentCategory ?? null
	);
}

describe("canonical spend parents", () => {
	it("groups recurring obligations as Fixed", () => {
		for (const name of [
			"Mortgage & Rent",
			"Bills & Utilities",
			"Insurance",
			"Subscriptions",
			"Loans",
		]) {
			assert.equal(parentOf(name), "FIXED");
		}
	});

	it("groups day-to-day variable spend as Flexible", () => {
		for (const name of [
			"Groceries",
			"Gas",
			"Auto & Transport",
			"Health & Medical",
			"Kids",
			"Pets",
			"Education",
			"Eating Out",
			"Shopping",
			"Clothing",
			"Entertainment",
			"Sports & Fitness",
			"Business Services",
			"Fees",
			"Uncategorized",
		]) {
			assert.equal(parentOf(name), "FLEXIBLE");
		}
	});

	it("groups lumpy expenses as Non-monthly", () => {
		for (const name of [
			"Home",
			"Cars",
			"Travel",
			"Flights",
			"Gifts & Donations",
			"Taxes",
		]) {
			assert.equal(parentOf(name), "NON_MONTHLY");
		}
	});

	it("leaves income, transfer, and investments ungrouped", () => {
		for (const name of [
			"Salary",
			"Reimbursement",
			"Transfer",
			"Credit card payment",
			"Investments",
		]) {
			assert.equal(parentOf(name), null);
			assert.equal(isUngroupedCanonicalCategory(name), true);
		}
	});
});

describe("resolveCategoryParent", () => {
	it("prefers the stored parent over the catalog", () => {
		assert.equal(resolveCategoryParent("Groceries", "FIXED"), "FIXED");
	});

	it("fills catalog parents when stored is missing", () => {
		assert.equal(resolveCategoryParent("Mortgage & Rent"), "FIXED");
		assert.equal(resolveCategoryParent("Entertainment"), "FLEXIBLE");
		assert.equal(resolveCategoryParent("Gifts & Donations"), "NON_MONTHLY");
	});

	it("keeps ungrouped catalog names without a parent", () => {
		assert.equal(resolveCategoryParent("Credit card payment"), null);
		assert.equal(resolveCategoryParent("Salary"), null);
	});

	it("defaults unknown custom names to Flexible", () => {
		assert.equal(resolveCategoryParent("Coffee"), "FLEXIBLE");
	});

	it("maps legacy desktop names to the renamed catalog parent", () => {
		assert.equal(resolveCategoryParent("Utilities"), "FIXED");
		assert.equal(resolveCategoryParent("Dining Out"), "FLEXIBLE");
	});
});

describe("canonical category colors", () => {
	it("gives every default a unique 6-digit hex", () => {
		const colors = CANONICAL_DEFAULT_CATEGORIES.map(
			(category) => category.color,
		);
		assert.equal(new Set(colors).size, colors.length);
		for (const color of colors) {
			assert.match(color, /^#[0-9A-F]{6}$/);
		}
	});
});
