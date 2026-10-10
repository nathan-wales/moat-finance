import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { RuleOperator } from "../../../generated/prisma";
import type { MatchableTransaction } from "./conditionMatcher";
import { matchCondition, resolveMatchableCategory } from "./conditionMatcher";

function categoryCondition(operator: RuleOperator, valueText: string) {
	return {
		field: "CATEGORY" as const,
		operator,
		valueText,
		valueNumber: null,
		valueDate: null,
		secondValueNumber: null,
		secondValueDate: null,
	};
}

/** Default "Groceries" renamed to "Food" by this user. */
const renamedDefault: MatchableTransaction = {
	description: "WHOLE FOODS",
	account: "Checking",
	amount: 42,
	date: new Date("2026-08-01T00:00:00.000Z"),
	...resolveMatchableCategory({
		canonicalName: "Groceries",
		overrideName: "Food",
	}),
};

describe("resolveMatchableCategory", () => {
	it("exposes the display name with the canonical name as an alias", () => {
		assert.deepEqual(
			resolveMatchableCategory({
				canonicalName: "Groceries",
				overrideName: "Food",
			}),
			{ category: "Food", categoryAliases: ["Groceries"] },
		);
	});

	it("does not alias a name to itself", () => {
		assert.deepEqual(
			resolveMatchableCategory({
				canonicalName: "Groceries",
				overrideName: "groceries",
			}),
			{ category: "Groceries", categoryAliases: [] },
		);
	});

	it("falls back to the legacy string column when there is no category row", () => {
		assert.deepEqual(
			resolveMatchableCategory({
				canonicalName: null,
				overrideName: "Food",
				fallbackName: "OTHER",
			}),
			{ category: "OTHER", categoryAliases: [] },
		);
	});
});

describe("matchCondition on CATEGORY", () => {
	it("matches a rule written against the renamed category", () => {
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("EQUALS", "Food")),
			true,
		);
	});

	it("matches a rule written before the rename", () => {
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("EQUALS", "groceries")),
			true,
		);
	});

	it("still rejects unrelated categories", () => {
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("EQUALS", "Travel")),
			false,
		);
	});

	it("negates across every spelling", () => {
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("NOT_EQUALS", "Food")),
			false,
		);
		assert.equal(
			matchCondition(
				renamedDefault,
				categoryCondition("NOT_EQUALS", "Groceries"),
			),
			false,
		);
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("NOT_EQUALS", "Travel")),
			true,
		);
		assert.equal(
			matchCondition(
				renamedDefault,
				categoryCondition("NOT_CONTAINS", "grocer"),
			),
			false,
		);
	});

	it("matches substrings of either spelling", () => {
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("CONTAINS", "roce")),
			true,
		);
		assert.equal(
			matchCondition(renamedDefault, categoryCondition("STARTS_WITH", "Foo")),
			true,
		);
	});

	it("leaves categories without an override unchanged", () => {
		const plain: MatchableTransaction = {
			...renamedDefault,
			...resolveMatchableCategory({ canonicalName: "Groceries" }),
		};
		assert.equal(
			matchCondition(plain, categoryCondition("EQUALS", "Groceries")),
			true,
		);
		assert.equal(
			matchCondition(plain, categoryCondition("EQUALS", "Food")),
			false,
		);
	});
});
