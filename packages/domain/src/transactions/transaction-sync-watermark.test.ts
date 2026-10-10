import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	laterUtcDate,
	overlapWindowFromBounds,
	shouldSkipHistoricalAddedTransaction,
	toUtcDateKey,
} from "./transaction-sync-watermark";

describe("shouldSkipHistoricalAddedTransaction", () => {
	const overlap = {
		from: new Date("2026-08-01T00:00:00.000Z"),
		through: new Date("2026-08-30T00:00:00.000Z"),
	};

	it("skips added txs inside leftover local coverage on any sync", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-08-01T00:00:00.000Z"),
				overlap,
			}),
			true,
		);
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-08-15T00:00:00.000Z"),
				overlap,
			}),
			true,
		);
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-08-30T00:00:00.000Z"),
				overlap,
			}),
			true,
		);
	});

	it("imports added txs after the leftover window", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-09-01T00:00:00.000Z"),
				overlap,
			}),
			false,
		);
	});

	it("imports added txs older than leftover local history", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-07-31T00:00:00.000Z"),
				overlap,
			}),
			false,
		);
	});

	it("imports the full window when leftover coverage is unknown", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2025-09-06T00:00:00.000Z"),
			}),
			false,
		);
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-08-15T00:00:00.000Z"),
				overlap: null,
			}),
			false,
		);
	});

	it("never skips modified rows", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "modified",
				postedDate: new Date("2026-08-15T00:00:00.000Z"),
				overlap,
			}),
			false,
		);
	});

	it("still skips leftover coverage after a later incremental historical pull", () => {
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2026-08-05T00:00:00.000Z"),
				overlap,
			}),
			true,
		);
		assert.equal(
			shouldSkipHistoricalAddedTransaction({
				kind: "added",
				postedDate: new Date("2025-09-06T00:00:00.000Z"),
				overlap,
			}),
			false,
		);
	});
});

describe("overlapWindowFromBounds", () => {
	it("requires both ends", () => {
		const from = new Date("2026-08-01T00:00:00.000Z");
		const through = new Date("2026-08-30T00:00:00.000Z");
		assert.deepEqual(overlapWindowFromBounds(from, through), { from, through });
		assert.equal(overlapWindowFromBounds(from, null), null);
		assert.equal(overlapWindowFromBounds(null, through), null);
	});
});

describe("laterUtcDate", () => {
	it("returns the later calendar date", () => {
		const earlier = new Date("2026-08-01T00:00:00.000Z");
		const later = new Date("2026-08-10T00:00:00.000Z");
		assert.equal(
			toUtcDateKey(laterUtcDate(earlier, later) ?? earlier),
			"2026-08-10",
		);
		assert.equal(laterUtcDate(null, later), later);
		assert.equal(laterUtcDate(earlier, null), earlier);
		assert.equal(laterUtcDate(null, undefined), null);
	});
});
