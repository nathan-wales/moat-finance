import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	earliestBudgetMonthStart,
	parseBudgetMonthKey,
	resolveBudgetReportingMonth,
} from "./resolve-reporting-month";

const september = new Date(2026, 8, 3);

describe("parseBudgetMonthKey", () => {
	it("parses a yyyy-MM key as the first of that month", () => {
		const parsed = parseBudgetMonthKey("2026-08");
		assert.ok(parsed);
		assert.equal(parsed.getFullYear(), 2026);
		assert.equal(parsed.getMonth(), 7);
		assert.equal(parsed.getDate(), 1);
	});

	it("rejects invalid values", () => {
		assert.equal(parseBudgetMonthKey(undefined), null);
		assert.equal(parseBudgetMonthKey(""), null);
		assert.equal(parseBudgetMonthKey("2026-13"), null);
		assert.equal(parseBudgetMonthKey("2026-8"), null);
		assert.equal(parseBudgetMonthKey("august"), null);
	});
});

describe("resolveBudgetReportingMonth", () => {
	it("defaults to the current month when month is omitted", () => {
		const result = resolveBudgetReportingMonth({ now: september });
		assert.equal(result.monthKey, "2026-09");
		assert.equal(result.isCurrentMonth, true);
		assert.equal(result.dayOfMonth, 3);
		assert.equal(result.daysInMonth, 30);
		assert.equal(result.startDate, "2026-09-01");
		assert.equal(result.endDate, "2026-09-30");
	});

	it("treats a past month in range as complete", () => {
		const result = resolveBudgetReportingMonth({
			now: september,
			month: "2026-08",
		});
		assert.equal(result.monthKey, "2026-08");
		assert.equal(result.isCurrentMonth, false);
		assert.equal(result.dayOfMonth, 31);
		assert.equal(result.daysInMonth, 31);
		assert.equal(result.startDate, "2026-08-01");
		assert.equal(result.endDate, "2026-08-31");
	});

	it("clamps a future month to the current month", () => {
		const result = resolveBudgetReportingMonth({
			now: september,
			month: "2026-10",
		});
		assert.equal(result.monthKey, "2026-09");
		assert.equal(result.isCurrentMonth, true);
		assert.equal(result.dayOfMonth, 3);
	});

	it("clamps a month older than 12 months to the current month", () => {
		const result = resolveBudgetReportingMonth({
			now: september,
			month: "2025-08",
		});
		assert.equal(result.monthKey, "2026-09");
		assert.equal(result.isCurrentMonth, true);
	});

	it("allows the earliest month in the trailing 12", () => {
		const earliest = earliestBudgetMonthStart(september);
		assert.equal(earliest.getFullYear(), 2025);
		assert.equal(earliest.getMonth(), 9);

		const result = resolveBudgetReportingMonth({
			now: september,
			month: "2025-10",
		});
		assert.equal(result.monthKey, "2025-10");
		assert.equal(result.isCurrentMonth, false);
		assert.equal(result.dayOfMonth, 31);
	});

	it("clamps invalid month strings to the current month", () => {
		const result = resolveBudgetReportingMonth({
			now: september,
			month: "nope",
		});
		assert.equal(result.monthKey, "2026-09");
		assert.equal(result.isCurrentMonth, true);
	});
});
