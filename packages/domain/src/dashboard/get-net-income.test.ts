import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { endOfDay, startOfMonth, subMonths } from "date-fns";
import { computeSavingsRate, summarizeNetIncome } from "./get-net-income";
import { trailingCashFlowRange } from "./trailing-cash-flow-range";

describe("summarizeNetIncome", () => {
	it("matches Insights 12M card math on a known fixture", () => {
		const monthlyTotals = [
			{ month: "2025-09", income: 22_000, expenses: 16_000, net: 6_000 },
			{ month: "2025-10", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2025-11", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2025-12", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-01", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-02", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-03", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-04", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-05", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-06", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-07", income: 22_369.75, expenses: 16_296.5833, net: 0 },
			{ month: "2026-08", income: 22_369.75, expenses: 16_296.5834, net: 0 },
		];
		// Normalize so totals land on the Insights screenshot numbers.
		const scaleIncome =
			268_437 / monthlyTotals.reduce((s, r) => s + r.income, 0);
		const scaleSpend =
			195_559 / monthlyTotals.reduce((s, r) => s + r.expenses, 0);
		const fixture = monthlyTotals.map((row) => ({
			month: row.month,
			income: row.income * scaleIncome,
			expenses: row.expenses * scaleSpend,
			net: row.income * scaleIncome - row.expenses * scaleSpend,
		}));

		const summary = summarizeNetIncome(fixture);
		assert.ok(Math.abs(summary.totalIncome - 268_437) < 0.01);
		assert.ok(Math.abs(summary.totalSpending - 195_559) < 0.01);
		assert.ok(Math.abs(summary.netIncome - 72_878) < 0.01);
		assert.ok(summary.savingsRate !== null);
		assert.ok(Math.abs((summary.savingsRate ?? 0) - 72_878 / 268_437) < 1e-9);
		assert.equal(summary.monthCount, 12);
	});

	it("returns a null savings rate when income is zero", () => {
		assert.equal(computeSavingsRate(0, -100), null);
		assert.equal(
			summarizeNetIncome([
				{ month: "2026-01", income: 0, expenses: 50, net: -50 },
			]).savingsRate,
			null,
		);
	});
});

describe("trailingCashFlowRange", () => {
	it("matches Insights 12m bounds", () => {
		const now = new Date("2026-08-24T15:00:00.000Z");
		const range = trailingCashFlowRange(12, now);
		assert.equal(
			range.startDate.getTime(),
			startOfMonth(subMonths(now, 11)).getTime(),
		);
		assert.equal(range.endDate.getTime(), endOfDay(now).getTime());
	});
});
