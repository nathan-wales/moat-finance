import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	DEFAULT_DASHBOARD_WIDGETS,
	isCanonicalDefaultDashboardLayout,
	sortWidgetsForDefaultLayout,
} from "./dashboard-defaults";

describe("isCanonicalDefaultDashboardLayout", () => {
	it("accepts the canonical default widget order", () => {
		assert.equal(
			isCanonicalDefaultDashboardLayout(
				DEFAULT_DASHBOARD_WIDGETS.map((widget) => ({
					widgetType: widget.widgetType,
					order: widget.order,
					isVisible: true,
				})),
			),
			true,
		);
	});

	it("rejects layouts where portfolio allocation is appended last", () => {
		assert.equal(
			isCanonicalDefaultDashboardLayout([
				{ widgetType: "net-worth-chart", order: 0, isVisible: true },
				{ widgetType: "monthly-cash-flow", order: 1, isVisible: true },
				{ widgetType: "summary-metrics", order: 2, isVisible: true },
				{ widgetType: "spending-by-category", order: 3, isVisible: true },
				{ widgetType: "recent-transactions", order: 4, isVisible: true },
				{ widgetType: "forecasted-balance", order: 5, isVisible: true },
				{ widgetType: "portfolio-allocation", order: 6, isVisible: true },
			]),
			false,
		);
	});

	it("includes the 12-month average after monthly cash flow", () => {
		assert.deepEqual(
			DEFAULT_DASHBOARD_WIDGETS.map((widget) => widget.widgetType),
			[
				"portfolio-allocation",
				"net-worth-chart",
				"monthly-cash-flow",
				"summary-metrics",
				"spending-by-category",
				"recent-transactions",
				"forecasted-balance",
			],
		);
	});
});

describe("sortWidgetsForDefaultLayout", () => {
	it("places default widgets in canonical order and keeps custom widgets after", () => {
		const sorted = sortWidgetsForDefaultLayout([
			{ widgetType: "net-worth-chart", order: 0 },
			{ widgetType: "portfolio-allocation", order: 5 },
			{ widgetType: "cash-on-hand", order: 6 },
			{ widgetType: "monthly-cash-flow", order: 1 },
			{ widgetType: "summary-metrics", order: 3 },
		]);

		assert.deepEqual(
			sorted.map((widget) => widget.widgetType),
			[
				"portfolio-allocation",
				"net-worth-chart",
				"monthly-cash-flow",
				"summary-metrics",
				"cash-on-hand",
			],
		);
	});
});
