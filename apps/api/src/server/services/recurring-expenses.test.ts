import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildRecurringSnapshotItems } from "@moat/domain";
import { renderWeeklySummaryEmail } from "./weekly-summary-email";

type Snapshot = Parameters<typeof renderWeeklySummaryEmail>[0]["snapshot"];

function snapshot(overrides: Partial<Snapshot> = {}): Snapshot {
	return {
		transactions: [],
		accounts: [],
		budgets: [],
		connections: [],
		recurring: [],
		expectedEvents: [],
		uncategorizedCount: 0,
		moneyIn: 100,
		moneyOut: 50,
		netWorth: 1000,
		...overrides,
	};
}

describe("weekly email recurring vs Insights Recurring Expenses", () => {
	it("does not flag Costco-twice-in-100-days grocery noise as a changed recurring payment", () => {
		const recurring = buildRecurringSnapshotItems([
			{
				normalizedDescription: "costco",
				monthKey: "2026-06",
				monthlyTotal: 47.12,
				lastDateIso: "2026-06-20T12:00:00.000Z",
			},
			{
				normalizedDescription: "costco",
				monthKey: "2026-07",
				monthlyTotal: 181.55,
				lastDateIso: "2026-07-18T12:00:00.000Z",
			},
		]);
		assert.deepEqual(recurring, []);

		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({ recurring }),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.equal(result.html.includes("recurring payment"), false);
		assert.equal(result.html.includes("Costco"), false);
		assert.equal(result.text.includes("recurring payment"), false);
	});

	it("flags a stable 2-month subscription whose last charge jumped 20%", () => {
		const recurring = buildRecurringSnapshotItems([
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
		assert.equal(recurring.length, 1);
		assert.equal(recurring[0]?.label, "netflix");
		assert.equal(recurring[0]?.amount, 19.19);
		assert.equal(recurring[0]?.previousAmount, 15.99);

		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({ recurring }),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.match(result.html, /1 recurring payment changed/);
		assert.match(result.html, /Netflix/);
		assert.equal(result.html.includes("Costco"), false);
	});
});
