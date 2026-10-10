import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppContext } from "../context";
import { getBudgetStatus } from "./getBudgetStatus";

function makeCtx(options: {
	categories: Array<{
		categoryId: string;
		categoryName: string;
		monthlyGoal: number | null;
		parentCategory?: "FIXED" | "FLEXIBLE" | "NON_MONTHLY" | null;
	}>;
	spend: Array<{
		categoryId: string | null;
		categoryName: string;
		total: number;
	}>;
}): AppContext {
	return {
		userId: "user-1",
		repositories: {
			budgets: {
				getCategoriesWithBudgets: async () => options.categories,
				getCategorySpendForPeriod: async () => options.spend,
				getCategorySpendByMonth: async () => [],
				upsertCategoryBudget: async () => undefined,
			},
		},
	} as unknown as AppContext;
}

const period = {
	periodStart: new Date("2026-08-01T00:00:00.000Z"),
	periodEnd: new Date("2026-08-31T23:59:59.000Z"),
	dayOfMonth: 21,
	daysInMonth: 31,
};

describe("getBudgetStatus", () => {
	it("omits unused categories by default", async () => {
		const result = await getBudgetStatus(
			makeCtx({
				categories: [
					{
						categoryId: "groceries",
						categoryName: "Groceries",
						monthlyGoal: 400,
					},
					{
						categoryId: "hobbies",
						categoryName: "Hobbies",
						monthlyGoal: null,
					},
				],
				spend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 80 },
				],
			}),
			period,
		);

		assert.deepEqual(
			result.categories.map((category) => category.categoryId),
			["groceries"],
		);
	});

	it("includes unused categories when requested", async () => {
		const result = await getBudgetStatus(
			makeCtx({
				categories: [
					{
						categoryId: "groceries",
						categoryName: "Groceries",
						monthlyGoal: 400,
					},
					{
						categoryId: "hobbies",
						categoryName: "Hobbies",
						monthlyGoal: null,
					},
				],
				spend: [
					{ categoryId: "groceries", categoryName: "Groceries", total: 80 },
				],
			}),
			{ ...period, includeEmptyCategories: true },
		);

		assert.deepEqual(
			result.categories.map((category) => category.categoryId),
			["groceries", "hobbies"],
		);
		assert.equal(result.categories[1]?.spentThisMonth, 0);
		assert.equal(result.categories[1]?.monthlyGoal, null);
	});

	it("passes parentCategory through to budget rows", async () => {
		const result = await getBudgetStatus(
			makeCtx({
				categories: [
					{
						categoryId: "rent",
						categoryName: "Mortgage & Rent",
						monthlyGoal: 2000,
						parentCategory: "FIXED",
					},
					{
						categoryId: "salary",
						categoryName: "Salary",
						monthlyGoal: null,
						parentCategory: null,
					},
				],
				spend: [
					{
						categoryId: "rent",
						categoryName: "Mortgage & Rent",
						total: 2000,
					},
				],
			}),
			period,
		);

		assert.equal(result.categories[0]?.parentCategory, "FIXED");
	});

	it("fills catalog parents when the repository omits them", async () => {
		const result = await getBudgetStatus(
			makeCtx({
				categories: [
					{
						categoryId: "rent",
						categoryName: "Mortgage & Rent",
						monthlyGoal: null,
					},
					{
						categoryId: "entertainment",
						categoryName: "Entertainment",
						monthlyGoal: null,
					},
					{
						categoryId: "cc",
						categoryName: "Credit card payment",
						monthlyGoal: null,
					},
				],
				spend: [
					{
						categoryId: "rent",
						categoryName: "Mortgage & Rent",
						total: 3555,
					},
					{
						categoryId: "entertainment",
						categoryName: "Entertainment",
						total: 2170,
					},
					{
						categoryId: "cc",
						categoryName: "Credit card payment",
						total: 2109,
					},
				],
			}),
			period,
		);

		const parentByName = Object.fromEntries(
			result.categories.map((category) => [
				category.categoryName,
				category.parentCategory,
			]),
		);
		assert.equal(parentByName["Mortgage & Rent"], "FIXED");
		assert.equal(parentByName.Entertainment, "FLEXIBLE");
		assert.equal(parentByName["Credit card payment"], null);
	});
});
