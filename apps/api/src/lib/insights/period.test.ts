import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { format } from "date-fns";
import {
	isInsightsWeekPeriod,
	resolveInsightsDateRange,
	usesWeeklyBuckets,
} from "./period";
import { InsightsPeriodSchema } from "./types";

function formatRange(range: { startDate: Date; endDate: Date }) {
	return {
		startDate: format(range.startDate, "yyyy-MM-dd"),
		endDate: format(range.endDate, "yyyy-MM-dd"),
	};
}

describe("insights week periods", () => {
	it("accepts this-week and last-week in the period schema", () => {
		assert.equal(InsightsPeriodSchema.parse("this-week"), "this-week");
		assert.equal(InsightsPeriodSchema.parse("last-week"), "last-week");
	});

	it("identifies week periods", () => {
		assert.equal(isInsightsWeekPeriod("this-week"), true);
		assert.equal(isInsightsWeekPeriod("last-week"), true);
		assert.equal(isInsightsWeekPeriod("this-month"), false);
	});

	it("uses weekly buckets for week periods", () => {
		assert.equal(usesWeeklyBuckets("this-week"), true);
		assert.equal(usesWeeklyBuckets("last-week"), true);
	});

	it("resolves this week from Monday through today", () => {
		const now = new Date(2026, 7, 19, 15, 30, 0);
		assert.deepEqual(formatRange(resolveInsightsDateRange("this-week", now)), {
			startDate: "2026-08-17",
			endDate: "2026-08-19",
		});
	});

	it("resolves last week as the previous Monday through Sunday", () => {
		const now = new Date(2026, 7, 19, 15, 30, 0);
		assert.deepEqual(formatRange(resolveInsightsDateRange("last-week", now)), {
			startDate: "2026-08-10",
			endDate: "2026-08-16",
		});
	});

	it("resolves this week on a Monday as a single day", () => {
		const now = new Date(2026, 7, 17, 9, 0, 0);
		assert.deepEqual(formatRange(resolveInsightsDateRange("this-week", now)), {
			startDate: "2026-08-17",
			endDate: "2026-08-17",
		});
	});

	it("resolves this week on a Sunday through the full ISO week", () => {
		const now = new Date(2026, 7, 23, 18, 0, 0);
		assert.deepEqual(formatRange(resolveInsightsDateRange("this-week", now)), {
			startDate: "2026-08-17",
			endDate: "2026-08-23",
		});
	});
});
