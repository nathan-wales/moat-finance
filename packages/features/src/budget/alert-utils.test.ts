import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	defaultBudgetAlertsForParent,
	formatBudgetAlertSummary,
} from "./alert-utils";

describe("formatBudgetAlertSummary", () => {
	it("shows defaults and off", () => {
		assert.equal(formatBudgetAlertSummary(null), "—");
		assert.equal(
			formatBudgetAlertSummary({ enabled: false, thresholds: [75, 100] }),
			"Off",
		);
		assert.equal(
			formatBudgetAlertSummary({ enabled: true, thresholds: [75, 100] }),
			"75% · 100%",
		);
	});
});

describe("defaultBudgetAlertsForParent", () => {
	it("turns 75% and empty on only for flexible categories", () => {
		assert.deepEqual(defaultBudgetAlertsForParent("FLEXIBLE"), {
			enabled: true,
			thresholds: [75, 100],
		});
		assert.deepEqual(defaultBudgetAlertsForParent("FIXED"), {
			enabled: false,
			thresholds: [75, 100],
		});
		assert.deepEqual(defaultBudgetAlertsForParent("NON_MONTHLY"), {
			enabled: false,
			thresholds: [75, 100],
		});
	});
});
