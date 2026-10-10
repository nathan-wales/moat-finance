import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { calendarYearInTimeZone } from "./year";

describe("calendarYearInTimeZone", () => {
	it("keeps a late Dec 31 US mountain trip in the local calendar year", () => {
		const startedAt = new Date("2027-01-01T01:00:00.000Z");
		assert.equal(calendarYearInTimeZone(startedAt, "America/Denver"), 2026);
		assert.equal(calendarYearInTimeZone(startedAt, "UTC"), 2027);
	});

	it("falls back to UTC when the zone is missing or invalid", () => {
		const startedAt = new Date("2026-07-01T00:00:00.000Z");
		assert.equal(calendarYearInTimeZone(startedAt, undefined), 2026);
		assert.equal(calendarYearInTimeZone(startedAt, "Not/AZone"), 2026);
	});
});
