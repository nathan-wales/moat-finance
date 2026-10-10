import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	compareByAmountSort,
	pageIdsByAmountSort,
	sortRowsByIdOrder,
} from "./amount-sort";

const rows = [
	{ id: "qualtrics", type: "INCOME", amount: 18255 },
	{ id: "salary-2", type: "INCOME", amount: 12500 },
	{ id: "large-expense", type: "EXPENSE", amount: 7172 },
	{ id: "mid-expense", type: "EXPENSE", amount: 5421 },
	{ id: "small-income", type: "INCOME", amount: 100 },
	{ id: "small-expense", type: "EXPENSE", amount: 12 },
];

describe("compareByAmountSort", () => {
	it("puts the largest income first for amount high", () => {
		const ids = pageIdsByAmountSort(rows, "desc", 0, 10);
		assert.deepEqual(ids, [
			"qualtrics",
			"salary-2",
			"small-income",
			"large-expense",
			"mid-expense",
			"small-expense",
		]);
	});

	it("puts the largest expense first for amount low", () => {
		const ids = pageIdsByAmountSort(rows, "asc", 0, 10);
		assert.deepEqual(ids, [
			"large-expense",
			"mid-expense",
			"small-expense",
			"qualtrics",
			"salary-2",
			"small-income",
		]);
	});

	it("paginates after grouping by sign", () => {
		assert.deepEqual(pageIdsByAmountSort(rows, "desc", 0, 3), [
			"qualtrics",
			"salary-2",
			"small-income",
		]);
		assert.deepEqual(pageIdsByAmountSort(rows, "asc", 0, 3), [
			"large-expense",
			"mid-expense",
			"small-expense",
		]);
	});

	it("breaks amount ties by id", () => {
		const first = { id: "b", type: "INCOME", amount: 50 };
		const second = { id: "a", type: "INCOME", amount: 50 };
		assert.equal(compareByAmountSort(first, second, "desc") > 0, true);
		assert.deepEqual(pageIdsByAmountSort([first, second], "desc", 0, 2), [
			"a",
			"b",
		]);
	});
});

describe("sortRowsByIdOrder", () => {
	it("restores the requested id order", () => {
		const unordered = [{ id: "b" }, { id: "a" }, { id: "c" }];
		assert.deepEqual(
			sortRowsByIdOrder(unordered, ["c", "a", "b"]).map((row) => row.id),
			["c", "a", "b"],
		);
	});
});
