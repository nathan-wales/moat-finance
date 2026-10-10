import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	budgetAlertEvaluationWindow,
	budgetAlertMonthKey,
	buildBudgetAlertCopy,
	DEFAULT_BUDGET_ALERT_THRESHOLDS,
	defaultCategoryBudgetAlertsForParent,
	firedBudgetAlertThresholds,
	formatBudgetAlertSummary,
	hasBudgetAlertFiredThisMonth,
	highestFiredBudgetAlertThreshold,
	isFlexibleBudgetCategory,
	normalizeBudgetAlertThresholds,
	parseCategoryBudgetAlerts,
	resolveBudgetAlertCreateState,
} from "./budget-alerts";

describe("normalizeBudgetAlertThresholds", () => {
	it("returns the 75% and empty defaults for invalid input", () => {
		assert.deepEqual(normalizeBudgetAlertThresholds(null), [75, 100]);
		assert.deepEqual(normalizeBudgetAlertThresholds([]), [75, 100]);
		assert.deepEqual(normalizeBudgetAlertThresholds(["x"]), [75, 100]);
	});

	it("dedupes, drops invalid, and sorts custom thresholds", () => {
		assert.deepEqual(
			normalizeBudgetAlertThresholds([100, 50, 75, 50, 0, 200, 1500]),
			[50, 75, 100, 200],
		);
	});
});

describe("defaultCategoryBudgetAlertsForParent", () => {
	it("enables 75% and empty only for flexible categories", () => {
		assert.deepEqual(defaultCategoryBudgetAlertsForParent("FLEXIBLE"), {
			enabled: true,
			thresholds: [75, 100],
		});
		assert.deepEqual(defaultCategoryBudgetAlertsForParent("FIXED"), {
			enabled: false,
			thresholds: [75, 100],
		});
		assert.deepEqual(defaultCategoryBudgetAlertsForParent("NON_MONTHLY"), {
			enabled: false,
			thresholds: [75, 100],
		});
		assert.equal(isFlexibleBudgetCategory(null), false);
	});
});

describe("resolveBudgetAlertCreateState", () => {
	it("defaults on for flexible and off for fixed when alerts are omitted", () => {
		assert.deepEqual(
			resolveBudgetAlertCreateState({
				categoryName: "Eating Out",
				storedParent: "FLEXIBLE",
			}),
			{ alertsEnabled: true, alertThresholds: [75, 100] },
		);
		assert.deepEqual(
			resolveBudgetAlertCreateState({
				categoryName: "Mortgage & Rent",
				storedParent: "FIXED",
			}),
			{ alertsEnabled: false, alertThresholds: [75, 100] },
		);
	});

	it("uses the catalog parent when none is stored", () => {
		assert.equal(
			resolveBudgetAlertCreateState({ categoryName: "Eating Out" })
				.alertsEnabled,
			true,
		);
		assert.equal(
			resolveBudgetAlertCreateState({ categoryName: "Mortgage & Rent" })
				.alertsEnabled,
			false,
		);
	});

	it("keeps explicit thresholds on a non-flexible category", () => {
		assert.deepEqual(
			resolveBudgetAlertCreateState({
				categoryName: "Travel",
				storedParent: "NON_MONTHLY",
				alertsEnabled: true,
				alertThresholds: [50, 100],
			}),
			{ alertsEnabled: true, alertThresholds: [50, 100] },
		);
	});
});

describe("parseCategoryBudgetAlerts", () => {
	it("is null when no saved budget exists", () => {
		assert.equal(
			parseCategoryBudgetAlerts({
				hasSavedBudget: false,
				alertsEnabled: true,
				alertThresholds: DEFAULT_BUDGET_ALERT_THRESHOLDS,
			}),
			null,
		);
	});

	it("defaults enabled with 75% and empty", () => {
		assert.deepEqual(parseCategoryBudgetAlerts({ hasSavedBudget: true }), {
			enabled: true,
			thresholds: [75, 100],
		});
	});
});

describe("formatBudgetAlertSummary", () => {
	it("labels thresholds as percents and disabled as Off", () => {
		assert.equal(formatBudgetAlertSummary(null), "—");
		assert.equal(
			formatBudgetAlertSummary({ enabled: false, thresholds: [75, 100] }),
			"Off",
		);
		assert.equal(
			formatBudgetAlertSummary({ enabled: true, thresholds: [50, 75, 100] }),
			"50% · 75% · 100%",
		);
	});
});

describe("firedBudgetAlertThresholds", () => {
	it("fires 75% but not empty when spend is between them", () => {
		assert.deepEqual(
			firedBudgetAlertThresholds({
				spent: 80,
				monthlyGoal: 100,
				thresholds: [75, 100],
			}),
			[75],
		);
	});

	it("fires every crossed threshold once over budget", () => {
		assert.deepEqual(
			firedBudgetAlertThresholds({
				spent: 120,
				monthlyGoal: 100,
				thresholds: [50, 75, 100],
			}),
			[50, 75, 100],
		);
	});

	it("fires a custom threshold over 100", () => {
		assert.deepEqual(
			firedBudgetAlertThresholds({
				spent: 160,
				monthlyGoal: 100,
				thresholds: [75, 150],
			}),
			[75, 150],
		);
	});
});

describe("highestFiredBudgetAlertThreshold", () => {
	it("returns the highest crossed threshold", () => {
		assert.equal(
			highestFiredBudgetAlertThreshold({
				spent: 120,
				monthlyGoal: 100,
				thresholds: [50, 75, 100],
			}),
			100,
		);
	});

	it("returns null when no threshold has been crossed", () => {
		assert.equal(
			highestFiredBudgetAlertThreshold({
				spent: 20,
				monthlyGoal: 100,
				thresholds: [75, 100],
			}),
			null,
		);
	});
});

describe("budgetAlertMonthKey", () => {
	it("uses the timezone calendar month, not UTC", () => {
		const now = new Date("2026-10-01T06:00:00.000Z");
		assert.equal(budgetAlertMonthKey(now, "UTC"), "2026-10");
		assert.equal(budgetAlertMonthKey(now, "America/Los_Angeles"), "2026-09");
	});
});

describe("budgetAlertEvaluationWindow", () => {
	it("dedupes by category and timezone month", () => {
		assert.equal(
			budgetAlertEvaluationWindow(
				new Date("2026-09-12T07:00:00.000Z"),
				"cat-1",
				"UTC",
			),
			"budget-alert:cat-1:2026-09",
		);
	});
});

describe("hasBudgetAlertFiredThisMonth", () => {
	it("matches the category-month window and legacy threshold windows", () => {
		assert.equal(
			hasBudgetAlertFiredThisMonth(
				"budget-alert:cat-1:2026-09",
				"cat-1",
				"2026-09",
			),
			true,
		);
		assert.equal(
			hasBudgetAlertFiredThisMonth(
				"budget-alert:cat-1:75:2026-09",
				"cat-1",
				"2026-09",
			),
			true,
		);
		assert.equal(
			hasBudgetAlertFiredThisMonth(
				"budget-alert:cat-1:100:2026-08",
				"cat-1",
				"2026-09",
			),
			false,
		);
		assert.equal(
			hasBudgetAlertFiredThisMonth(
				"budget-alert:cat-2:2026-09",
				"cat-1",
				"2026-09",
			),
			false,
		);
	});
});

describe("buildBudgetAlertCopy", () => {
	it("uses over-budget copy for the empty threshold", () => {
		const copy = buildBudgetAlertCopy({
			categoryName: "Dining",
			spent: 420,
			monthlyGoal: 400,
			threshold: 100,
		});
		assert.equal(copy.title, "Dining is over budget");
		assert.match(copy.summary, /over/);
	});

	it("uses reached-percent copy for thresholds over 100", () => {
		const copy = buildBudgetAlertCopy({
			categoryName: "Dining",
			spent: 620,
			monthlyGoal: 400,
			threshold: 150,
		});
		assert.equal(copy.title, "Dining reached 150% of its budget");
	});
});
