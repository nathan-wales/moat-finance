import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	INSIGHTS_PERIOD_OPTIONS,
	isInsightsWeekPeriod,
	parseInsightsPeriod,
	resolveInsightsDateRangeForSelection,
	showsInsightsMonthlyAverage,
} from "./period-utils";

describe("insights week period utils", () => {
	it("lists this week and last week first", () => {
		assert.deepEqual(
			INSIGHTS_PERIOD_OPTIONS.slice(0, 2).map((option) => option.value),
			["this-week", "last-week"],
		);
	});

	it("parses week period query values", () => {
		assert.equal(parseInsightsPeriod("this-week"), "this-week");
		assert.equal(parseInsightsPeriod("last-week"), "last-week");
	});

	it("hides monthly average for week periods only", () => {
		assert.equal(showsInsightsMonthlyAverage({ period: "this-week" }), false);
		assert.equal(showsInsightsMonthlyAverage({ period: "last-week" }), false);
		assert.equal(showsInsightsMonthlyAverage({ period: "this-month" }), true);
	});

	it("resolves last-month drill-down dates as the previous calendar month", () => {
		const now = new Date(2026, 8, 7);
		assert.deepEqual(
			resolveInsightsDateRangeForSelection({ period: "last-month" }, now),
			{ from: "2026-08-01", to: "2026-08-31" },
		);
	});

	it("resolves week date ranges for drill-down and spending", () => {
		const now = new Date(2026, 7, 19);
		assert.deepEqual(
			resolveInsightsDateRangeForSelection({ period: "this-week" }, now),
			{ from: "2026-08-17", to: "2026-08-19" },
		);
		assert.deepEqual(
			resolveInsightsDateRangeForSelection({ period: "last-week" }, now),
			{ from: "2026-08-10", to: "2026-08-16" },
		);
		assert.equal(isInsightsWeekPeriod("this-week"), true);
	});
});
