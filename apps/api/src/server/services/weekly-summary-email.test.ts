import assert from "node:assert/strict";
import { describe, it } from "node:test";
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

const fullSnapshot = snapshot({
	accounts: [{ id: "a1", name: "Checking", currentBalance: 1200 }],
	budgets: [
		{
			categoryId: "c1",
			categoryName: "Restaurants",
			monthlyGoal: 400,
			spent: 248,
			percentUsed: 62,
			percentOfMonthElapsed: 48,
		},
	],
	connections: [
		{
			id: "conn1",
			institutionName: "Chase",
			lastSuccessfulSyncAtIso: null,
		},
	],
	recurring: [
		{
			label: "streamco",
			amount: 18.99,
			previousAmount: 14.99,
			nextExpectedDateIso: new Date(
				Date.now() + 3 * 24 * 60 * 60 * 1000,
			).toISOString(),
		},
	],
	uncategorizedCount: 7,
	moneyIn: 4200,
	moneyOut: 3100,
	recentAverageWeeklyMoneyOut: 2500,
	projectedEndOfMonthCash: 1800,
	netWorth: 52000,
	previousWeekNetWorth: 51000,
});

describe("renderWeeklySummaryEmail", () => {
	it("renders a prioritized digest with aggregated insights", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: fullSnapshot,
			periodLabel: "2026-07-13 – 2026-07-19",
			includeAiObservations: true,
		});

		assert.equal(result.subject, "Your weekly money summary");
		assert.match(result.html, /Your week in Moat/);
		assert.match(result.html, /Jul 13–19/);
		assert.match(result.html, /What changed/);
		assert.match(result.html, /Budget progress/);
		assert.match(result.html, /Needs your attention/);
		assert.match(result.html, /Looking ahead/);
		assert.match(result.html, /Restaurants/);
		assert.match(result.html, /\$248 \/ \$400/);
		assert.match(result.html, /7 transactions still need a category/);
		assert.match(result.html, /spent 24% more/);
		assert.match(result.html, /Spending jumped this week/);
		assert.match(result.html, /↑/);
		assert.match(result.html, /1 recurring payment changed/);
		assert.match(result.html, /↻/);
		assert.match(result.html, /Streamco/);
		assert.match(result.html, /1 account needs attention/);
		assert.match(result.html, /Projected month-end cash/);
		assert.match(result.html, /Open Moat/);
		assert.match(result.text, /Money in: \$4,200/);
		assert.equal(result.html.includes("@"), true);

		assert.equal(result.html.includes("No category budgets configured"), false);
		assert.equal(result.html.includes("A recurring bill"), false);
		assert.equal(
			result.html.includes("higher than recent weekly average"),
			false,
		);
		assert.equal(result.html.includes("Open Notifications in Moat"), false);
		assert.equal(result.html.includes("Change from previous week"), false);
		assert.equal(result.html.includes("Your week at a glance"), false);
	});

	it("respects sections filter when provided", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot(),
			periodLabel: "2026-07-13 – 2026-07-19",
			sections: ["glance", "actions"],
		});
		assert.match(result.html, /Your week in Moat/);
		assert.match(result.html, /Open Moat/);
		assert.equal(result.html.includes("What changed"), false);
		assert.equal(result.html.includes("Looking ahead"), false);
	});

	it("offers a budget opportunity when no category budgets exist", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({ budgets: [] }),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.match(result.html, /Want to keep spending on track/);
		assert.match(result.html, /Create your first budget/);
		assert.match(result.html, /You haven't set any category budgets yet/);
		assert.equal(result.html.includes("No category budgets configured"), false);
		assert.match(result.text, /Want to keep spending on track/);
		assert.match(result.text, /Create your first budget/);
	});

	it("aggregates multiple recurring amount changes", () => {
		const labels = [
			"Harmon’s",
			"Menchie’s",
			"Kneaders",
			"Old Navy",
			"Costco",
			"Trader Joe's",
			"Target",
			"Amazon",
		];
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({
				recurring: labels.map((label) => ({
					label,
					amount: 20,
					previousAmount: 10,
				})),
			}),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.match(result.html, /8 recurring payments changed/);
		assert.match(
			result.html,
			/Harmon’s, Menchie’s, Kneaders, Old Navy, Costco, and 3 others/,
		);
		assert.equal(result.html.includes("A recurring bill"), false);
		assert.match(result.text, /8 recurring payments changed/);
		assert.match(result.text, /and 3 others/);
	});

	it("aggregates multiple unsynced connections", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({
				connections: [
					{
						id: "c1",
						institutionName: "Chase",
						lastSuccessfulSyncAtIso: null,
					},
					{
						id: "c2",
						institutionName: "Wells Fargo",
						lastSuccessfulSyncAtIso: null,
					},
				],
			}),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.match(result.html, /2 accounts need attention/);
		assert.match(result.html, /two accounts haven't synced recently/);
		assert.equal(
			(result.html.match(/has not synced recently/g) ?? []).length,
			0,
		);
		assert.equal(
			(result.html.match(/2 accounts need attention/g) ?? []).length,
			1,
		);
	});

	it("colors negative net cash flow red", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({ moneyIn: 100, moneyOut: 400 }),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.match(result.html, /#B91C1C/);
		assert.match(result.text, /Net cash flow: -\$300/);
	});

	it("pretty-prints a same-month period label", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot(),
			periodLabel: "2026-07-13 – 2026-07-19",
			sections: ["glance"],
		});
		assert.match(result.html, /Jul 13–19/);
		assert.match(result.text, /Jul 13–19/);
	});

	it("omits the generic alert tip when AI observations are on but nothing changed", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({
				moneyIn: 100,
				moneyOut: 50,
				recentAverageWeeklyMoneyOut: 50,
				recurring: [],
			}),
			periodLabel: "2026-08-17 – 2026-08-23",
			includeAiObservations: true,
		});
		assert.equal(result.html.includes("persistent alert"), false);
		assert.equal(result.text.includes("persistent alert"), false);
		assert.equal(result.html.includes("Tip:"), false);
	});

	it("does not claim recurring payments changed when Insights has none", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({ recurring: [] }),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.equal(result.html.includes("recurring payment"), false);
		assert.equal(result.html.includes("Harmons"), false);
		assert.equal(result.html.includes("Costco"), false);
	});

	it("omits looking ahead when there are no upcoming recurring payments", () => {
		const result = renderWeeklySummaryEmail({
			snapshot: snapshot({
				projectedEndOfMonthCash: 1800,
				recurring: [
					{
						label: "streamco",
						amount: 18.99,
						previousAmount: 14.99,
					},
				],
			}),
			periodLabel: "2026-08-17 – 2026-08-23",
		});
		assert.equal(result.html.includes("Looking ahead"), false);
		assert.equal(result.text.includes("Looking ahead"), false);
		assert.equal(result.html.includes("Coming up"), false);
		assert.equal(result.text.includes("Coming up"), false);
		assert.equal(result.html.includes("Projected month-end cash"), false);
		assert.equal(result.text.includes("Projected month-end cash"), false);
		assert.equal(
			result.html.includes("No upcoming recurring items detected"),
			false,
		);
	});
});
