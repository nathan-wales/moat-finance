import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Category } from "@moat/contracts";
import {
	insightsCategoryFilterIsActive,
	insightsCategoryQueryKeySuffix,
	mergeInsightsFilterCategories,
	parseInsightsCategoryFilterExclusions,
	retainInsightsCategoryExclusions,
	sanitizeInsightsCategoryFilterExclusions,
	selectedInsightsCategoryNames,
	splitInsightsFilterCategories,
	toInsightsCategoryQueryFilter,
	unselectedInsightsCategoryNames,
} from "./insights-category-filter";

function category(
	overrides: Partial<Category> & Pick<Category, "name">,
): Category {
	return {
		id: overrides.id ?? overrides.name,
		icon: null,
		color: "#71717A",
		isHidden: false,
		isDefault: true,
		sortOrder: 0,
		parentCategory: null,
		...overrides,
	};
}

describe("splitInsightsFilterCategories", () => {
	it("puts ungrouped visible names in income and parented names in expense", () => {
		assert.deepEqual(
			splitInsightsFilterCategories([
				category({ name: "Salary" }),
				category({ name: "Rental Income" }),
				category({ name: "Eating Out", parentCategory: "FLEXIBLE" }),
				category({ name: "Groceries", parentCategory: "FLEXIBLE" }),
				category({ name: "Transfer", isHidden: true }),
				category({ name: "Old", isRemoved: true, parentCategory: "FIXED" }),
			]),
			{
				income: ["Rental Income", "Salary"],
				expense: ["Eating Out", "Groceries"],
			},
		);
	});

	it("adds period activity to both sections without dropping the catalog", () => {
		const catalog = splitInsightsFilterCategories([
			category({ name: "Salary" }),
			category({ name: "Credit card payment" }),
			category({ name: "Rental Income", parentCategory: "FLEXIBLE" }),
			category({ name: "Mortgage & Rent", parentCategory: "FIXED" }),
		]);

		const merged = mergeInsightsFilterCategories(catalog, {
			income: ["Rental Income", "Mortgage & Rent"],
			expense: ["Mortgage & Rent"],
		});

		assert.deepEqual(merged, {
			income: [
				"Credit card payment",
				"Mortgage & Rent",
				"Rental Income",
				"Salary",
			],
			expense: ["Mortgage & Rent", "Rental Income"],
		});
		assert.deepEqual(
			toInsightsCategoryQueryFilter(merged.income, ["Credit card payment"]),
			["Mortgage & Rent", "Rental Income", "Salary"],
		);
	});

	it("keeps an exclusion for a category that is absent this period", () => {
		assert.deepEqual(
			retainInsightsCategoryExclusions(
				{ income: ["Rental Income", "Salary"], expense: [] },
				{ income: ["Salary"], expense: [] },
				{ income: ["Salary", "Credit card payment"], expense: ["Groceries"] },
			),
			{ income: ["Rental Income", "Salary"], expense: [] },
		);
	});

	it("dedupes category names within each section", () => {
		assert.deepEqual(
			splitInsightsFilterCategories([
				category({
					id: "sub-1",
					name: "Subscriptions",
					parentCategory: "FIXED",
				}),
				category({
					id: "sub-2",
					name: "Subscriptions",
					parentCategory: "FIXED",
				}),
				category({ id: "salary-1", name: "Salary" }),
				category({ id: "salary-2", name: "Salary" }),
			]),
			{
				income: ["Salary"],
				expense: ["Subscriptions"],
			},
		);
	});
});

describe("insights category filter selection", () => {
	it("drops excluded names from the selected list", () => {
		assert.deepEqual(
			selectedInsightsCategoryNames(["Salary", "Reimbursement"], ["Salary"]),
			["Reimbursement"],
		);
	});

	it("lists unselected names for add more", () => {
		assert.deepEqual(
			unselectedInsightsCategoryNames(["Salary", "Reimbursement"], ["Salary"]),
			["Reimbursement"],
		);
	});

	it("omits query filters until something is excluded", () => {
		assert.equal(toInsightsCategoryQueryFilter(["Salary"], []), undefined);
		assert.deepEqual(
			toInsightsCategoryQueryFilter(["Salary", "Bonus"], ["Bonus"]),
			["Salary"],
		);
	});

	it("treats empty include lists as an active filter", () => {
		assert.equal(
			insightsCategoryFilterIsActive({ income: ["Salary"], expense: [] }),
			true,
		);
		assert.equal(
			insightsCategoryFilterIsActive({ income: [], expense: [] }),
			false,
		);
	});
});

describe("insights category filter persistence", () => {
	it("parses stored exclusions and ignores junk", () => {
		assert.deepEqual(
			parseInsightsCategoryFilterExclusions(
				JSON.stringify({
					income: ["Salary", "Salary"],
					expense: ["Groceries"],
				}),
			),
			{ income: ["Salary"], expense: ["Groceries"] },
		);
		assert.deepEqual(parseInsightsCategoryFilterExclusions("not-json"), {
			income: [],
			expense: [],
		});
	});

	it("drops exclusions that are no longer in the catalog", () => {
		assert.deepEqual(
			sanitizeInsightsCategoryFilterExclusions(
				{ income: ["Salary", "Gone"], expense: ["Groceries", "Gone"] },
				{ income: ["Salary"], expense: ["Groceries"] },
			),
			{ income: ["Salary"], expense: ["Groceries"] },
		);
	});
});

describe("insightsCategoryQueryKeySuffix", () => {
	it("uses all when both sides are unfiltered", () => {
		assert.equal(insightsCategoryQueryKeySuffix({}), "all");
	});
});
