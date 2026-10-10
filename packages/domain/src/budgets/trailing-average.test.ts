import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildTrailingSixMonthTrend,
	computeTrailingAverageBudget,
	effectiveMonthlyGoal,
} from "./trailing-average";

const september = new Date(2026, 8, 3);

describe("buildTrailingSixMonthTrend", () => {
	it("covers the six complete months before the reference month", () => {
		const trend = buildTrailingSixMonthTrend(new Map(), september);
		assert.deepEqual(
			trend.map((row) => row.month),
			["2026-03", "2026-04", "2026-05", "2026-06", "2026-07", "2026-08"],
		);
	});

	it("excludes the current month even when it has spend", () => {
		const trend = buildTrailingSixMonthTrend(
			new Map([
				["2026-08", 100],
				["2026-09", 999],
			]),
			september,
		);
		assert.equal(
			trend.find((row) => row.month === "2026-09"),
			undefined,
		);
		assert.equal(trend.at(-1)?.amount, 100);
	});
});

describe("computeTrailingAverageBudget", () => {
	it("averages only months with spend", () => {
		const result = computeTrailingAverageBudget(
			new Map([
				["2026-03", 100],
				["2026-05", 200],
				["2026-08", 300],
			]),
			september,
		);
		assert.equal(result.sixMonthAverage, 200);
		assert.equal(result.suggestedBudget, 200);
	});

	it("returns zero when no months have spend", () => {
		const result = computeTrailingAverageBudget(new Map(), september);
		assert.equal(result.sixMonthAverage, 0);
		assert.equal(result.suggestedBudget, 0);
	});

	it("rounds values under 100 to the nearest 10", () => {
		const result = computeTrailingAverageBudget(
			new Map([["2026-08", 43]]),
			september,
		);
		assert.equal(result.sixMonthAverage, 43);
		assert.equal(result.suggestedBudget, 40);
	});

	it("rounds values of 100 or more to the nearest 25", () => {
		const result = computeTrailingAverageBudget(
			new Map([["2026-08", 274]]),
			september,
		);
		assert.equal(result.sixMonthAverage, 274);
		assert.equal(result.suggestedBudget, 275);
	});
});

describe("effectiveMonthlyGoal", () => {
	it("keeps a saved goal instead of the trailing average", () => {
		const goal = effectiveMonthlyGoal(
			50,
			new Map([["2026-08", 200]]),
			september,
		);
		assert.equal(goal, 50);
	});

	it("uses the rounded trailing average when no goal is saved", () => {
		const goal = effectiveMonthlyGoal(
			null,
			new Map([["2026-08", 274]]),
			september,
		);
		assert.equal(goal, 275);
	});

	it("stays unset when there is no trailing spend", () => {
		const goal = effectiveMonthlyGoal(null, new Map(), september);
		assert.equal(goal, null);
	});
});
