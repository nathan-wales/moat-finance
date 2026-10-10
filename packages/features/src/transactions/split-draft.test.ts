import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	createSplitLegDraft,
	isSplitDraftComplete,
	splitRemainderCents,
	toSplitLegDateValue,
} from "./split-draft";

describe("split-draft", () => {
	it("requires at least two complete legs that sum to the original", () => {
		const first = createSplitLegDraft({
			description: "Coffee",
			amount: "6.50",
			category: "Eating Out",
		});
		const second = createSplitLegDraft({
			description: "Groceries",
			amount: "13.50",
			category: "Groceries",
		});

		assert.equal(splitRemainderCents(20, [first, second]), 0);
		assert.equal(isSplitDraftComplete(20, [first, second]), true);
		assert.equal(isSplitDraftComplete(20, [first]), false);
	});

	it("rejects leftover remainder or missing name/category", () => {
		const first = createSplitLegDraft({
			description: "Coffee",
			amount: "6.50",
			category: "Eating Out",
		});
		const incomplete = createSplitLegDraft({
			description: "",
			amount: "13.50",
			category: "Groceries",
		});

		assert.equal(splitRemainderCents(20, [first, incomplete]), 0);
		assert.equal(isSplitDraftComplete(20, [first, incomplete]), false);
		assert.ok(splitRemainderCents(20, [first]) > 0);
	});

	it("normalizes a transaction timestamp to a single calendar date", () => {
		assert.equal(toSplitLegDateValue("2026-03-15T12:00:00.000Z"), "2026-03-15");
		assert.equal(
			createSplitLegDraft({ date: "2026-04-02" }).date,
			"2026-04-02",
		);
	});
});
