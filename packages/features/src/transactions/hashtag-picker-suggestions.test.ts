import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	firstUnselectedSuggestionIndex,
	getHashtagPickerSuggestions,
} from "./hashtag-picker-suggestions";

const allHashtags = [
	{ name: "moat-finance" },
	{ name: "orem-house-monthly" },
	{ name: "tax-deductible" },
	{ name: "travel" },
	{ name: "wildflower-condo-monthly" },
];

describe("getHashtagPickerSuggestions", () => {
	it("puts already-added tags first when the query is empty", () => {
		const suggestions = getHashtagPickerSuggestions(
			allHashtags,
			["moat-finance", "wildflower-condo-monthly"],
			"",
		);

		assert.deepEqual(
			suggestions.map((item) => item.name),
			[
				"moat-finance",
				"wildflower-condo-monthly",
				"orem-house-monthly",
				"tax-deductible",
				"travel",
			],
		);
		assert.equal(suggestions[0]?.selected, true);
		assert.equal(suggestions[1]?.selected, true);
		assert.equal(suggestions[2]?.selected, false);
	});

	it("keeps matching selected tags at the top while typing", () => {
		const suggestions = getHashtagPickerSuggestions(
			allHashtags,
			["moat-finance", "wildflower-condo-monthly"],
			"moat",
		);

		assert.deepEqual(
			suggestions.map((item) => ({ name: item.name, selected: item.selected })),
			[{ name: "moat-finance", selected: true }],
		);
	});

	it("drops selected tags once they no longer match the query", () => {
		const suggestions = getHashtagPickerSuggestions(
			allHashtags,
			["moat-finance", "wildflower-condo-monthly"],
			"tax",
		);

		assert.deepEqual(
			suggestions.map((item) => ({ name: item.name, selected: item.selected })),
			[{ name: "tax-deductible", selected: false }],
		);
	});

	it("does not duplicate selected tags in the unselected matches", () => {
		const suggestions = getHashtagPickerSuggestions(
			allHashtags,
			["tax-deductible"],
			"tax",
		);

		assert.equal(
			suggestions.filter((item) => item.name === "tax-deductible").length,
			1,
		);
		assert.equal(suggestions[0]?.selected, true);
	});
});

describe("firstUnselectedSuggestionIndex", () => {
	it("skips selected tags so enter still adds the next available tag", () => {
		assert.equal(
			firstUnselectedSuggestionIndex([
				{ name: "moat-finance", selected: true },
				{ name: "tax-deductible", selected: false },
			]),
			1,
		);
	});

	it("stays on the first selected tag when nothing unselected remains", () => {
		assert.equal(
			firstUnselectedSuggestionIndex([
				{ name: "moat-finance", selected: true },
			]),
			0,
		);
	});
});
