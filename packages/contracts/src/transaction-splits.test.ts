import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	parseSplitLegDateInput,
	parseSplitTransactionInput,
	resolveSplitLegTimelineDates,
} from "./transaction-splits";

describe("split leg dates", () => {
	it("parses a calendar date as UTC noon so the day is timezone-stable", () => {
		const parsed = parseSplitLegDateInput("2026-03-15");
		assert.equal(parsed?.toISOString(), "2026-03-15T12:00:00.000Z");
	});

	it("keeps ISO instants as absolute timestamps", () => {
		const parsed = parseSplitLegDateInput("2026-03-15T07:00:00.000Z");
		assert.equal(parsed?.toISOString(), "2026-03-15T07:00:00.000Z");
	});

	it("accepts a date on each split leg", () => {
		const parsed = parseSplitTransactionInput({
			id: "tx-1",
			type: "EXPENSE",
			legs: [
				{
					description: "A",
					amount: 40,
					categoryName: "Shopping",
					hashtags: [],
					date: "2026-03-15",
				},
				{
					description: "B",
					amount: 60,
					categoryName: "Groceries",
					hashtags: [],
				},
			],
		});

		assert.equal(parsed.legs[0]?.date, "2026-03-15");
		assert.equal(parsed.legs[1]?.date, undefined);
	});

	it("updates postedDate when the parent already has one", () => {
		const parent = {
			date: new Date("2026-03-10T00:00:00.000Z"),
			postedDate: new Date("2026-03-10T00:00:00.000Z"),
		};
		const next = parseSplitLegDateInput("2026-04-01");
		const resolved = resolveSplitLegTimelineDates(parent, next);
		assert.equal(resolved.date.toISOString(), "2026-04-01T12:00:00.000Z");
		assert.equal(
			resolved.postedDate?.toISOString(),
			"2026-04-01T12:00:00.000Z",
		);
	});

	it("leaves postedDate empty when the parent has none", () => {
		const parent = {
			date: new Date("2026-03-10T00:00:00.000Z"),
			postedDate: null,
		};
		const next = parseSplitLegDateInput("2026-04-01");
		const resolved = resolveSplitLegTimelineDates(parent, next);
		assert.equal(resolved.date.toISOString(), "2026-04-01T12:00:00.000Z");
		assert.equal(resolved.postedDate, null);
	});
});
