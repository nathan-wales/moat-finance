import assert from "node:assert/strict";
import { DatabaseSync } from "node:sqlite";
import { describe, it } from "node:test";
import {
	applyCategoryOverride,
	defaultCategoryCapabilities,
	isEmptyCategoryOverride,
	sqliteCategoryNamesFilter,
} from "./category-overrides";

describe("defaultCategoryCapabilities", () => {
	it("allows hide and delete on custom categories", () => {
		assert.deepEqual(defaultCategoryCapabilities("Coffee", false), {
			canDelete: true,
			canHide: true,
		});
	});

	it("protects Uncategorized from hide and delete", () => {
		assert.deepEqual(defaultCategoryCapabilities("Uncategorized", true), {
			canDelete: false,
			canHide: false,
		});
	});

	it("protects Transfer from delete but allows hide", () => {
		assert.deepEqual(defaultCategoryCapabilities("Transfer", true), {
			canDelete: false,
			canHide: true,
		});
	});
});

describe("sqliteCategoryNamesFilter", () => {
	it("omits sql when names are undefined", () => {
		assert.deepEqual(sqliteCategoryNamesFilter(undefined), {
			sql: "",
			params: [],
		});
	});

	it("matches nothing for an empty list", () => {
		assert.deepEqual(sqliteCategoryNamesFilter([]), {
			sql: "AND 0",
			params: [],
		});
	});

	it("matches resolved names on a sqlite schema without t.category", () => {
		const db = new DatabaseSync(":memory:");
		db.exec(`
			CREATE TABLE "Transaction" (
				id TEXT,
				userId TEXT,
				categoryId TEXT
			);
			CREATE TABLE Category (
				id TEXT,
				name TEXT
			);
			CREATE TABLE CategoryOverride (
				categoryId TEXT,
				userId TEXT,
				name TEXT
			);
			INSERT INTO Category (id, name) VALUES
				('cat-salary', 'Salary'),
				('cat-bonus', 'Bonus');
			INSERT INTO CategoryOverride (categoryId, userId, name) VALUES
				('cat-bonus', 'user-1', 'Annual bonus');
			INSERT INTO "Transaction" (id, userId, categoryId) VALUES
				('tx-salary', 'user-1', 'cat-salary'),
				('tx-bonus', 'user-1', 'cat-bonus'),
				('tx-none', 'user-1', NULL);
		`);

		const filter = sqliteCategoryNamesFilter([
			"Salary",
			"Annual bonus",
			"Uncategorized",
		]);
		assert.doesNotMatch(filter.sql, /t\.category(?!Id)/);

		const rows = db
			.prepare(
				`SELECT id FROM "Transaction" t WHERE 1 = 1 ${filter.sql} ORDER BY id`,
			)
			.all(...filter.params) as Array<{ id: string }>;

		assert.deepEqual(
			rows.map((row) => row.id),
			["tx-bonus", "tx-none", "tx-salary"],
		);
	});
});

describe("applyCategoryOverride", () => {
	const groceries = {
		name: "Groceries",
		icon: null as string | null,
		isHidden: false,
		isDefault: true,
		parentCategory: "FLEXIBLE" as const,
	};

	it("inherits canonical fields when no override exists", () => {
		assert.deepEqual(applyCategoryOverride(groceries, null), {
			name: "Groceries",
			icon: null,
			color: "#71717A",
			isHidden: false,
			isRemoved: false,
			canDelete: true,
			canHide: true,
			parentCategory: "FLEXIBLE",
		});
	});

	it("applies sparse name and icon without changing visibility", () => {
		assert.deepEqual(
			applyCategoryOverride(groceries, { name: "Food", icon: "carrot" }),
			{
				name: "Food",
				icon: "carrot",
				color: "#71717A",
				isHidden: false,
				isRemoved: false,
				canDelete: true,
				canHide: true,
				parentCategory: "FLEXIBLE",
			},
		);
	});

	it("treats removed as hidden", () => {
		const resolved = applyCategoryOverride(groceries, { isRemoved: true });
		assert.equal(resolved.isRemoved, true);
		assert.equal(resolved.isHidden, true);
	});

	it("applies a color override", () => {
		assert.equal(
			applyCategoryOverride(groceries, { color: "#d97706" }).color,
			"#D97706",
		);
	});

	it("applies a parent override", () => {
		assert.equal(
			applyCategoryOverride(groceries, { parentCategory: "FIXED" })
				.parentCategory,
			"FIXED",
		);
	});

	it("fills the canonical parent when none is stored", () => {
		assert.equal(
			applyCategoryOverride({
				name: "Mortgage & Rent",
				icon: null,
				isHidden: false,
				isDefault: true,
			}).parentCategory,
			"FIXED",
		);
	});

	it("keeps ungrouped catalog categories without a parent", () => {
		assert.equal(
			applyCategoryOverride({
				name: "Credit card payment",
				icon: null,
				isHidden: false,
				isDefault: true,
			}).parentCategory,
			null,
		);
	});

	it("defaults custom categories to Flexible", () => {
		assert.equal(
			applyCategoryOverride({
				name: "Coffee",
				icon: null,
				isHidden: false,
				isDefault: false,
			}).parentCategory,
			"FLEXIBLE",
		);
	});
});

describe("isEmptyCategoryOverride", () => {
	it("is empty when every field inherits", () => {
		assert.equal(isEmptyCategoryOverride({}), true);
		assert.equal(
			isEmptyCategoryOverride({
				name: null,
				icon: null,
				color: null,
				isHidden: null,
				isRemoved: false,
			}),
			true,
		);
	});

	it("is not empty when a field is set", () => {
		assert.equal(isEmptyCategoryOverride({ name: "Food" }), false);
		assert.equal(isEmptyCategoryOverride({ isRemoved: true }), false);
		assert.equal(isEmptyCategoryOverride({ color: "#16A34A" }), false);
		assert.equal(
			isEmptyCategoryOverride({ parentCategory: "NON_MONTHLY" }),
			false,
		);
	});
});
