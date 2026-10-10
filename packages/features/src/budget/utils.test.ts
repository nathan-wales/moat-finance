import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getBudgetOverviewTitle,
	groupCategoriesByParent,
	rollupBudgetByParent,
} from "./utils";

describe("rollupBudgetByParent", () => {
	it("sums child spend into catalog parents when parentCategory is missing", () => {
		const rows = rollupBudgetByParent([
			{
				categoryName: "Mortgage & Rent",
				spentThisMonth: 3555,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: null,
			},
			{
				categoryName: "Entertainment",
				spentThisMonth: 2170,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: null,
			},
			{
				categoryName: "Credit card payment",
				spentThisMonth: 2109,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: null,
			},
			{
				categoryName: "Gifts & Donations",
				spentThisMonth: 1710,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: null,
			},
			{
				categoryName: "Loans",
				spentThisMonth: 1096,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: null,
			},
		]);

		const spentByParent = Object.fromEntries(
			rows.map((row) => [row.parent, row.spentThisMonth]),
		);
		assert.equal(spentByParent.FIXED, 4651);
		assert.equal(spentByParent.FLEXIBLE, 2170);
		assert.equal(spentByParent.NON_MONTHLY, 1710);
		assert.deepEqual(rows.find((row) => row.parent === "FIXED")?.categories, [
			"Mortgage & Rent",
			"Loans",
		]);
	});

	it("lets a stored parent override the catalog", () => {
		const rows = rollupBudgetByParent([
			{
				categoryName: "Groceries",
				spentThisMonth: 194,
				monthlyGoal: null,
				expectedSpendToDate: 0,
				parentCategory: "FIXED",
			},
		]);

		assert.equal(
			rows.find((row) => row.parent === "FIXED")?.spentThisMonth,
			194,
		);
		assert.equal(
			rows.find((row) => row.parent === "FLEXIBLE")?.spentThisMonth,
			0,
		);
	});
});

describe("groupCategoriesByParent", () => {
	it("groups and sorts child categories under each parent", () => {
		const grouped = groupCategoriesByParent([
			{
				categoryName: "Utilities",
				parentCategory: null,
			},
			{
				categoryName: "Mortgage & Rent",
				parentCategory: null,
			},
			{
				categoryName: "Entertainment",
				parentCategory: null,
			},
			{
				categoryName: "Salary",
				parentCategory: null,
			},
		]);

		assert.deepEqual(
			grouped.FIXED.map((row) => row.categoryName),
			["Mortgage & Rent", "Utilities"],
		);
		assert.deepEqual(
			grouped.FLEXIBLE.map((row) => row.categoryName),
			["Entertainment"],
		);
		assert.deepEqual(grouped.NON_MONTHLY, []);
	});

	it("lets a stored parent override the catalog", () => {
		const grouped = groupCategoriesByParent([
			{
				categoryName: "Groceries",
				parentCategory: "FIXED" as const,
			},
		]);

		assert.deepEqual(
			grouped.FIXED.map((row) => row.categoryName),
			["Groceries"],
		);
		assert.deepEqual(grouped.FLEXIBLE, []);
	});
});

describe("getBudgetOverviewTitle", () => {
	it("uses This Month Overview for the current reporting month", () => {
		assert.equal(
			getBudgetOverviewTitle("2026-09", "2026-09"),
			"This Month Overview",
		);
	});

	it("uses the possessive month name for a past month", () => {
		assert.equal(
			getBudgetOverviewTitle("2026-08", "2026-09"),
			"August's Overview",
		);
	});
});
