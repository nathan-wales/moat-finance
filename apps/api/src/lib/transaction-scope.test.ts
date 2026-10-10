import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { splitParentExclusionWhere } from "@moat/data-access";
import {
	buildCategoryNameFilter,
	buildCategoryNamesFilter,
	buildTransactionWhere,
	hiddenCategoryExclusionWhere,
	mergeTransactionWhere,
	normalizeCategoryFilterNames,
	parseOptionalCategoryNames,
	resolveCategoryFilterNames,
	signedCategorySpendAmount,
} from "./transaction-scope";

describe("buildCategoryNameFilter", () => {
	it("matches category via FK and legacy string column", () => {
		assert.deepEqual(buildCategoryNameFilter("Mortgage & Rent"), {
			OR: [
				{
					categoryRef: {
						name: { equals: "Mortgage & Rent", mode: "insensitive" },
					},
				},
				{
					categoryId: null,
					category: { equals: "Mortgage & Rent", mode: "insensitive" },
				},
			],
		});
	});

	it("also matches per-user override names", () => {
		assert.deepEqual(buildCategoryNameFilter("Food", "user-a"), {
			OR: [
				{
					categoryRef: {
						name: { equals: "Food", mode: "insensitive" },
					},
				},
				{
					categoryRef: {
						overrides: {
							some: {
								userId: "user-a",
								name: { equals: "Food", mode: "insensitive" },
							},
						},
					},
				},
				{
					categoryId: null,
					category: { equals: "Food", mode: "insensitive" },
				},
			],
		});
	});
});

describe("buildCategoryNamesFilter", () => {
	it("returns undefined for empty input", () => {
		assert.equal(buildCategoryNamesFilter([]), undefined);
	});

	it("matches any of multiple category names", () => {
		const filter = buildCategoryNamesFilter(["Salary", "Groceries"]);
		assert.ok(filter?.OR);
		assert.equal(filter?.OR?.length, 4);
	});
});

describe("normalizeCategoryFilterNames", () => {
	it("returns undefined when the filter is omitted", () => {
		assert.equal(normalizeCategoryFilterNames(undefined), undefined);
	});

	it("lowercases and dedupes names", () => {
		assert.deepEqual(normalizeCategoryFilterNames(["Salary", " salary "]), [
			"salary",
		]);
		assert.deepEqual(normalizeCategoryFilterNames([]), []);
	});
});

describe("parseOptionalCategoryNames", () => {
	it("accepts a single query string or an array", () => {
		assert.deepEqual(parseOptionalCategoryNames("Salary"), ["Salary"]);
		assert.deepEqual(parseOptionalCategoryNames("Salary,Bonus"), [
			"Salary",
			"Bonus",
		]);
		assert.deepEqual(parseOptionalCategoryNames(["Salary", "Bonus"]), [
			"Salary",
			"Bonus",
		]);
		assert.equal(parseOptionalCategoryNames(undefined), undefined);
	});
});

describe("resolveCategoryFilterNames", () => {
	it("merges category and categories without duplicates", () => {
		assert.deepEqual(
			resolveCategoryFilterNames({
				category: "Salary",
				categories: ["Salary", "Groceries"],
			}),
			["Salary", "Groceries"],
		);
	});
});

describe("signedCategorySpendAmount", () => {
	it("adds expenses and subtracts income", () => {
		assert.equal(signedCategorySpendAmount("EXPENSE", 3000), 3000);
		assert.equal(signedCategorySpendAmount("INCOME", 500), -500);
	});

	it("nets mortgage payment minus rental income", () => {
		const payment = signedCategorySpendAmount("EXPENSE", 6000);
		const rentalIncome = signedCategorySpendAmount("INCOME", 2000);
		assert.equal(payment + rentalIncome, 4000);
	});
});

describe("buildTransactionWhere split parents", () => {
	it("excludes split parents from the default transaction where", () => {
		assert.deepEqual(buildTransactionWhere({ userId: "user-1" }).AND, [
			hiddenCategoryExclusionWhere("user-1"),
			splitParentExclusionWhere(),
		]);
	});

	it("keeps split parents only when opted in", () => {
		const where = buildTransactionWhere({
			userId: "user-1",
			includeSplitParents: true,
		});
		assert.deepEqual(where.AND, [hiddenCategoryExclusionWhere("user-1")]);
	});
});

describe("mergeTransactionWhere", () => {
	it("keeps split-parent exclusion when list filters are applied", () => {
		const merged = mergeTransactionWhere(
			buildTransactionWhere({ userId: "user-1" }),
			[{ description: { contains: "HOA" } }],
		);
		assert.deepEqual(merged.AND, [
			hiddenCategoryExclusionWhere("user-1"),
			splitParentExclusionWhere(),
			{ description: { contains: "HOA" } },
		]);
	});
});
