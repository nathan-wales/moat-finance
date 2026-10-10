import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	ensureCurrentMonthPoint,
	resolveInvestmentCardSource,
	rollupLastPerMonth,
	toAccountHistoryId,
	toMonthlyAssetHistory,
} from "./rollup-monthly-last";

describe("rollupLastPerMonth", () => {
	it("keeps the last value in each calendar month", () => {
		const points = rollupLastPerMonth([
			{ date: "2026-01-01", value: 100 },
			{ date: "2026-01-15", value: 120 },
			{ date: "2026-02-28", value: 130 },
		]);
		assert.deepEqual(points, [
			{ month: "2026-01", total: 120 },
			{ month: "2026-02", total: 130 },
		]);
	});
});

describe("ensureCurrentMonthPoint", () => {
	it("replaces the current month with the live value", () => {
		const points = ensureCurrentMonthPoint(
			[{ month: "2026-07", total: 10 }],
			50,
			new Date("2026-08-15T12:00:00"),
		);
		assert.deepEqual(points, [
			{ month: "2026-07", total: 10 },
			{ month: "2026-08", total: 50 },
		]);
	});
});

describe("resolveInvestmentCardSource", () => {
	it("maps plaid_ and plaid- prefixes to PLAID", () => {
		assert.deepEqual(resolveInvestmentCardSource("plaid_abc"), {
			source: "PLAID",
			sourceId: "abc",
		});
		assert.deepEqual(resolveInvestmentCardSource("plaid-abc"), {
			source: "PLAID",
			sourceId: "abc",
		});
	});

	it("treats unprefixed ids as investments", () => {
		assert.deepEqual(resolveInvestmentCardSource("inv_1"), {
			source: "INVESTMENT",
			sourceId: "inv_1",
		});
	});
});

describe("toAccountHistoryId", () => {
	it("uses prefixed ids that account history resolution understands", () => {
		assert.equal(toAccountHistoryId("PLAID", "abc"), "plaid-abc");
		assert.equal(
			toAccountHistoryId("INVESTMENT", "xyz"),
			"investment-acct-xyz",
		);
	});
});

describe("toMonthlyAssetHistory", () => {
	it("rolls daily rows and seeds the live current month", () => {
		const result = toMonthlyAssetHistory(
			[
				{ date: "2026-01-05", value: 100 },
				{ date: "2026-01-20", value: 110 },
				{ date: "2026-02-10", value: 120 },
			],
			150,
			24,
			new Date("2026-03-15T12:00:00"),
		);
		assert.equal(result.current, 150);
		assert.deepEqual(result.points, [
			{ month: "2026-01", total: 110 },
			{ month: "2026-02", total: 120 },
			{ month: "2026-03", total: 150 },
		]);
	});

	it("returns a single current-month point when there is no history", () => {
		const result = toMonthlyAssetHistory(
			[],
			80,
			24,
			new Date("2026-08-15T12:00:00"),
		);
		assert.deepEqual(result, {
			current: 80,
			points: [{ month: "2026-08", total: 80 }],
		});
	});
});
