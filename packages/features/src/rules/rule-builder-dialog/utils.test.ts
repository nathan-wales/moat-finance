import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { ActionRow, ConditionGroupRow, ConditionRow } from "./types";
import {
	committedPreviewFromState,
	renameSerializedRuleDraft,
	serializeRuleDraft,
	suggestedRuleName,
	suggestHashtags,
} from "./utils";

function action(
	partial: Partial<ActionRow> & Pick<ActionRow, "type">,
): ActionRow {
	return {
		id: "action",
		valueText: "",
		hashtagId: null,
		hashtagEntries: [],
		...partial,
	};
}

function group(conditions: ConditionGroupRow["conditions"]): ConditionGroupRow {
	return { id: "group", match: "ALL", conditions };
}

describe("suggestedRuleName", () => {
	it("uses the set-description action when present", () => {
		assert.equal(
			suggestedRuleName(
				[
					action({
						type: "SET_DESCRIPTION",
						valueText: "Sage Income - Qualtrics",
					}),
				],
				[
					group([
						{
							id: "c1",
							field: "DESCRIPTION",
							operator: "CONTAINS",
							valueText: "Qualtrics",
							valueNumber: "",
							secondValueNumber: "",
						},
					]),
				],
			),
			"Sage Income - Qualtrics",
		);
	});

	it("falls back to a description condition", () => {
		assert.equal(
			suggestedRuleName(
				[action({ type: "SET_CATEGORY", valueText: "Salary" })],
				[
					group([
						{
							id: "c1",
							field: "DESCRIPTION",
							operator: "CONTAINS",
							valueText: "Qualtrics",
							valueNumber: "",
							secondValueNumber: "",
						},
					]),
				],
			),
			"Qualtrics",
		);
	});

	it("returns empty when nothing describes the rule", () => {
		assert.equal(
			suggestedRuleName(
				[action({ type: "SET_CATEGORY", valueText: "Salary" })],
				[
					group([
						{
							id: "c1",
							field: "ACCOUNT",
							operator: "EQUALS",
							valueText: "Checking",
							valueNumber: "",
							secondValueNumber: "",
						},
					]),
				],
			),
			"",
		);
	});
});

function condition(
	partial: Partial<ConditionRow> & Pick<ConditionRow, "field" | "operator">,
): ConditionRow {
	return {
		id: "c1",
		valueText: "",
		valueNumber: "",
		secondValueNumber: "",
		...partial,
	};
}

describe("committedPreviewFromState", () => {
	it("includes the latest completed IF values", () => {
		const preview = committedPreviewFromState("ALL", [
			group([
				condition({
					field: "DESCRIPTION",
					operator: "CONTAINS",
					valueText: "Qualtrics",
				}),
				condition({
					id: "c2",
					field: "ACCOUNT",
					operator: "EQUALS",
					valueText: "Checking",
				}),
			]),
		]);

		assert.equal(preview.match, "ALL");
		assert.equal(preview.conditions.length, 2);
		assert.equal(preview.conditions[0]?.valueText, "Qualtrics");
		assert.equal(preview.conditions[1]?.valueText, "Checking");
	});

	it("omits incomplete conditions so a blur with empty text clears them", () => {
		const preview = committedPreviewFromState("ANY", [
			group([
				condition({
					field: "DESCRIPTION",
					operator: "CONTAINS",
					valueText: "   ",
				}),
			]),
		]);

		assert.deepEqual(preview.conditions, []);
		assert.deepEqual(preview.groups, []);
	});
});

describe("suggestHashtags", () => {
	const newestFirst = [
		"uber",
		"travel",
		"tax-deductible",
		"groceries",
		"coffee",
		"business",
	];

	it("shows the 5 most recent hashtags when the query is empty", () => {
		assert.deepEqual(suggestHashtags(newestFirst, ""), [
			"uber",
			"travel",
			"tax-deductible",
			"groceries",
			"coffee",
		]);
	});

	it("fuzzy-matches across the full list as you type", () => {
		assert.deepEqual(suggestHashtags(newestFirst, "tax"), ["tax-deductible"]);
	});

	it("matches a leading hash the same as a bare query", () => {
		assert.deepEqual(suggestHashtags(newestFirst, "#tr"), ["travel"]);
	});
});

describe("serializeRuleDraft", () => {
	it("ignores row ids so regenerated drafts compare equal", () => {
		const first = serializeRuleDraft({
			name: "Mortgage",
			match: "ALL",
			groups: [
				group([
					condition({
						id: "c-a",
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: "JPMorgan",
					}),
				]),
			],
			actions: [
				action({
					id: "a-a",
					type: "SET_CATEGORY",
					valueText: "Mortgage & Rent",
				}),
			],
		});
		const second = serializeRuleDraft({
			name: "  Mortgage  ",
			match: "ALL",
			groups: [
				group([
					condition({
						id: "c-b",
						field: "DESCRIPTION",
						operator: "CONTAINS",
						valueText: "JPMorgan",
					}),
				]),
			],
			actions: [
				action({
					id: "a-b",
					type: "SET_CATEGORY",
					valueText: "Mortgage & Rent",
				}),
			],
		});
		assert.equal(first, second);
	});

	it("treats a renamed rule as a different draft", () => {
		const original = serializeRuleDraft({
			name: "Mortgage",
			match: "ALL",
			groups: [group([condition({ field: "ACCOUNT", operator: "EQUALS" })])],
			actions: [action({ type: "SET_CATEGORY" })],
		});
		assert.notEqual(
			original,
			renameSerializedRuleDraft(original, "Condo mortgage"),
		);
		assert.equal(
			renameSerializedRuleDraft(original, "Condo mortgage"),
			serializeRuleDraft({
				name: "Condo mortgage",
				match: "ALL",
				groups: [group([condition({ field: "ACCOUNT", operator: "EQUALS" })])],
				actions: [action({ type: "SET_CATEGORY" })],
			}),
		);
	});
});
