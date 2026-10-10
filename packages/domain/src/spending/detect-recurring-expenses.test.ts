import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildRecurringSnapshotItems,
	detectRecurringExpenses,
	monthKeyFromParts,
	toRecurringExpenseSummary,
	toSnapshotRecurring,
} from "./detect-recurring-expenses";

describe("detectRecurringExpenses", () => {
	it("does not treat grocery with varying monthly totals as recurring", () => {
		const detected = detectRecurringExpenses([
			{
				normalizedDescription: "costco",
				monthKey: "2026-06",
				monthlyTotal: 47.12,
			},
			{
				normalizedDescription: "costco",
				monthKey: "2026-07",
				monthlyTotal: 181.55,
			},
			{
				normalizedDescription: "harmons",
				monthKey: "2026-05",
				monthlyTotal: 32.4,
			},
			{
				normalizedDescription: "harmons",
				monthKey: "2026-06",
				monthlyTotal: 88.1,
			},
		]);
		assert.deepEqual(detected, []);
	});

	it("does not treat two visits in a single month as recurring", () => {
		const detected = detectRecurringExpenses([
			{
				normalizedDescription: "costco",
				monthKey: "2026-07",
				monthlyTotal: 45.0,
			},
		]);
		assert.equal(detected.length, 0);
	});

	it("detects a stable Netflix-like series across 2+ months", () => {
		const detected = detectRecurringExpenses([
			{
				normalizedDescription: "Netflix",
				monthKey: monthKeyFromParts(2026, 6),
				monthlyTotal: 15.99,
			},
			{
				normalizedDescription: "  NETFLIX ",
				monthKey: "2026-7",
				monthlyTotal: 15.99,
			},
		]);
		assert.equal(detected.length, 1);
		assert.equal(detected[0]?.description, "netflix");
		assert.equal(detected[0]?.occurrences, 2);
		assert.equal(detected[0]?.monthlyAmount, 15.99);
		assert.deepEqual(detected.map(toRecurringExpenseSummary), [
			{
				description: "netflix",
				monthlyAmount: 15.99,
				occurrences: 2,
			},
		]);
	});

	it("still detects a 2-month subscription whose last month jumped 20%", () => {
		const detected = detectRecurringExpenses([
			{
				normalizedDescription: "netflix",
				monthKey: "2026-06",
				monthlyTotal: 15.99,
				lastDateIso: "2026-06-15T12:00:00.000Z",
				lastChargeAmount: 15.99,
			},
			{
				normalizedDescription: "netflix",
				monthKey: "2026-07",
				monthlyTotal: 19.19,
				lastDateIso: "2026-07-15T12:00:00.000Z",
				lastChargeAmount: 19.19,
			},
		]);
		assert.equal(detected.length, 1);
		assert.equal(detected[0]?.latestMonthTotal, 19.19);
		assert.equal(detected[0]?.previousMonthTotal, 15.99);
	});

	it("ranks streams by average monthly amount", () => {
		const detected = detectRecurringExpenses([
			{
				normalizedDescription: "spotify",
				monthKey: "2026-06",
				monthlyTotal: 11.99,
			},
			{
				normalizedDescription: "spotify",
				monthKey: "2026-07",
				monthlyTotal: 11.99,
			},
			{
				normalizedDescription: "rent",
				monthKey: "2026-06",
				monthlyTotal: 1800,
			},
			{
				normalizedDescription: "rent",
				monthKey: "2026-07",
				monthlyTotal: 1800,
			},
		]);
		assert.deepEqual(
			detected.map((stream) => stream.description),
			["rent", "spotify"],
		);
	});
});

describe("toSnapshotRecurring", () => {
	it("maps latest vs previous occurrence so a 20% jump flags as changed", () => {
		const [stream] = detectRecurringExpenses([
			{
				normalizedDescription: "netflix",
				monthKey: "2026-06",
				monthlyTotal: 15.99,
				lastDateIso: "2026-06-15T12:00:00.000Z",
			},
			{
				normalizedDescription: "netflix",
				monthKey: "2026-07",
				monthlyTotal: 19.19,
				lastDateIso: "2026-07-15T12:00:00.000Z",
			},
		]);
		assert.ok(stream);
		const item = toSnapshotRecurring(stream);
		assert.equal(item.label, "netflix");
		assert.equal(item.amount, 19.19);
		assert.equal(item.previousAmount, 15.99);
		assert.equal(
			Math.abs(item.amount - (item.previousAmount ?? 0)) /
				(item.previousAmount ?? 1) >=
				0.1,
			true,
		);
		assert.equal(item.cadence, "monthly");
		assert.equal(item.nextExpectedDateIso?.startsWith("2026-08-14"), true);
	});

	it("omits grocery noise from snapshot recurring items", () => {
		const items = buildRecurringSnapshotItems([
			{
				normalizedDescription: "costco",
				monthKey: "2026-06",
				monthlyTotal: 47.12,
			},
			{
				normalizedDescription: "costco",
				monthKey: "2026-07",
				monthlyTotal: 181.55,
			},
		]);
		assert.deepEqual(items, []);
	});
});
