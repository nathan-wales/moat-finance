import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { compileLegacySignal } from "./compile-legacy-signal";
import { evaluateNotificationRule } from "./evaluate";
import { evaluateWatchQuery } from "./evaluate-watch-query";
import type { NotificationRuleInput } from "./rule";
import { notificationRuleSchema } from "./rule";
import type { FinancialSnapshot } from "./snapshot";

const emptySnapshot: FinancialSnapshot = {
	transactions: [],
	accounts: [],
	budgets: [],
	connections: [],
	recurring: [],
	expectedEvents: [],
	uncategorizedCount: 0,
	moneyIn: 0,
	moneyOut: 0,
	netWorth: 10000,
};

describe("evaluateWatchQuery fixtures", () => {
	it("Venmo expected count reports N of M on day 3", () => {
		const rule = notificationRuleSchema.parse({
			name: "Roommate Venmo check",
			plainLanguageSummary:
				"On the 3rd, report how many Venmo payments between $520–$630 arrived since the 1st (expect 3).",
			watchQuery: {
				source: { kind: "transactions" },
				filter: {
					all: [
						{ field: "merchant", op: "contains_any", value: ["Venmo"] },
						{ field: "amountAbs", op: "between", min: 520, max: 630 },
						{ field: "direction", op: "eq", value: "inflow" },
					],
				},
				window: { kind: "day_of_month_range", startDay: 1, endDay: 3 },
				measure: { metric: "count" },
				predicate: { op: "gte", value: 3, expected: 3 },
				report: { mode: "expected_vs_actual" },
			},
			schedule: { kind: "monthly_on_day", dayOfMonth: 3, minuteOfDay: 480 },
			channels: ["email", "push", "in_app"],
			urgency: "important",
		});

		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "t1",
					dateIso: "2026-08-01T12:00:00.000Z",
					amount: 550,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
				{
					id: "t2",
					dateIso: "2026-08-02T12:00:00.000Z",
					amount: 600,
					merchantName: "Venmo Cashout",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
				{
					id: "t3",
					dateIso: "2026-08-05T12:00:00.000Z",
					amount: 580,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
			],
		};

		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-08-03T16:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.body, /2 of 3/);
		assert.match(result.body, /Missing 1/);
		assert.match(
			result.explanation.facts.find((f) => f.label === "Window")?.value ?? "",
			/Aug 1–3/,
		);
		assert.equal(
			result.explanation.facts.find((f) => f.label === "Matched count")?.value,
			"2",
		);
	});

	it("day_of_month_range ignores transactions outside 1–3", () => {
		const rule = notificationRuleSchema.parse({
			name: "Range only",
			watchQuery: {
				source: { kind: "transactions" },
				filter: {
					all: [{ field: "merchant", op: "contains", value: "Venmo" }],
				},
				window: { kind: "day_of_month_range", startDay: 1, endDay: 3 },
				measure: { metric: "count" },
				predicate: { op: "always" },
				report: { mode: "status_report" },
			},
			schedule: { kind: "month_window_end" },
			channels: ["in_app"],
		});
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "in",
					dateIso: "2026-08-02T12:00:00.000Z",
					amount: 100,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
				{
					id: "out",
					dateIso: "2026-08-10T12:00:00.000Z",
					amount: 100,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
			],
		};
		const watchQuery = rule.watchQuery;
		assert.ok(watchQuery);
		const result = evaluateWatchQuery(
			rule,
			watchQuery,
			snapshot,
			new Date("2026-08-03T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(
			result.explanation.facts.find((f) => f.label === "Matched count")?.value,
			"1",
		);
	});

	it("budget 50% eating out fires via watch query", () => {
		const rule = notificationRuleSchema.parse({
			name: "Eating out halfway",
			watchQuery: {
				source: { kind: "budgets" },
				filter: {
					all: [{ field: "category", op: "in", value: ["Eating Out"] }],
				},
				window: { kind: "month_to_date" },
				measure: { metric: "budget_spent_percent" },
				predicate: { op: "crossed_above", value: 50 },
				report: { mode: "on_change" },
			},
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
		});
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			budgets: [
				{
					categoryId: "c1",
					categoryName: "Eating Out",
					monthlyGoal: 400,
					spent: 220,
					percentUsed: 55,
					percentOfMonthElapsed: 40,
				},
			],
		};
		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-08-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.body, /Eating Out/);
	});

	it("mid-month grocery status_report always delivers measure", () => {
		const rule = notificationRuleSchema.parse({
			name: "Mid-month grocery check",
			watchQuery: {
				source: { kind: "transactions" },
				filter: {
					all: [{ field: "category", op: "eq", value: "Groceries" }],
				},
				window: { kind: "day_of_month_range", startDay: 17, endDay: 20 },
				measure: { metric: "sum_amount_abs" },
				predicate: { op: "always" },
				report: { mode: "status_report" },
			},
			schedule: { kind: "month_window_end" },
			channels: ["in_app", "email"],
			urgency: "informational",
		});
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "g1",
					dateIso: "2026-08-18T12:00:00.000Z",
					amount: 42.5,
					merchantName: "Market",
					categoryName: "Groceries",
					type: "EXPENSE",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
			],
		};
		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-08-20T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.body, /\$42\.5/);
	});

	it("on_match does not fire when predicate unmet", () => {
		const rule = notificationRuleSchema.parse({
			name: "Need three",
			watchQuery: {
				source: { kind: "transactions" },
				window: { kind: "same_day" },
				measure: { metric: "count" },
				predicate: { op: "gte", value: 3 },
				report: { mode: "on_match" },
			},
			schedule: { kind: "immediate" },
			channels: ["in_app"],
		});
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				transactions: [
					{
						id: "t1",
						dateIso: "2026-08-01T12:00:00.000Z",
						amount: 10,
						type: "EXPENSE",
						hashtags: [],
						pending: false,
						isRecurring: false,
					},
				],
			},
			new Date("2026-08-01T15:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, false);
	});
});

describe("calendar date timezone safety", () => {
	it("keeps UTC-midnight posted dates inside day_of_month_range in US timezones", () => {
		const rule = notificationRuleSchema.parse({
			name: "TZ range",
			watchQuery: {
				source: { kind: "transactions" },
				filter: {
					all: [{ field: "merchant", op: "contains", value: "Venmo" }],
				},
				window: { kind: "day_of_month_range", startDay: 1, endDay: 3 },
				measure: { metric: "count" },
				predicate: { op: "always" },
				report: { mode: "status_report" },
			},
			schedule: { kind: "month_window_end" },
			channels: ["in_app"],
		});
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "aug1",
					dateIso: "2026-08-01T00:00:00.000Z",
					amount: 550,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
				{
					id: "aug4",
					dateIso: "2026-08-04T00:00:00.000Z",
					amount: 550,
					merchantName: "Venmo",
					type: "INCOME",
					hashtags: [],
					pending: false,
					isRecurring: false,
				},
			],
		};
		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-08-03T16:00:00.000Z"),
			"America/Los_Angeles",
		);
		assert.equal(
			result.explanation.facts.find((f) => f.label === "Matched count")?.value,
			"1",
		);
	});

	it("does not treat missing type as inflow", () => {
		const rule = notificationRuleSchema.parse({
			name: "Need type",
			watchQuery: {
				source: { kind: "transactions" },
				filter: {
					all: [{ field: "direction", op: "eq", value: "inflow" }],
				},
				window: { kind: "same_day" },
				measure: { metric: "count" },
				predicate: { op: "gte", value: 1 },
				report: { mode: "on_match" },
			},
			schedule: { kind: "immediate" },
			channels: ["in_app"],
		});
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				transactions: [
					{
						id: "no-type",
						dateIso: "2026-08-01T00:00:00.000Z",
						amount: 100,
						merchantName: "Venmo",
						hashtags: [],
						pending: false,
						isRecurring: false,
					},
				],
			},
			new Date("2026-08-01T18:00:00.000Z"),
			"America/New_York",
		);
		assert.equal(result.fired, false);
	});
});

describe("compileLegacySignal", () => {
	it("compiles expected_transaction_missing to month-wide missing watch", () => {
		const compiled = compileLegacySignal({
			signalType: "expected_transaction_missing",
			match: { recurringLabel: "Rent", categoryName: "Rent" },
			expectedCadence: "monthly",
			expectedWindowStartDay: 1,
			expectedWindowEndDay: 3,
			missingAfterDay: 5,
		});
		assert.equal(compiled.watchQuery.window.kind, "calendar_month");
		assert.equal(compiled.watchQuery.measure.metric, "missing");
		assert.equal(compiled.schedule?.kind, "monthly_on_day");
		assert.equal(compiled.schedule?.dayOfMonth, 5);
	});

	it("compiles budget_threshold to crossed_above percent watch", () => {
		const compiled = compileLegacySignal({
			signalType: "budget_threshold",
			categoryName: "Eating Out",
			thresholdPercent: 50,
		});
		assert.equal(compiled.watchQuery.source.kind, "budgets");
		assert.equal(compiled.watchQuery.measure.metric, "budget_spent_percent");
		assert.equal(compiled.watchQuery.predicate.op, "crossed_above");
		assert.equal(compiled.watchQuery.predicate.value, 50);
	});

	it("legacy rules without watchQuery still evaluate identically for appeared", () => {
		const legacy: NotificationRuleInput = {
			name: "Watch Amazon",
			signalType: "transaction_appeared",
			trigger: {
				signalType: "transaction_appeared",
				match: { merchantContains: "Amazon" },
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "informational",
			source: "manual",
			isActive: true,
		};
		const compiled = compileLegacySignal(legacy.trigger);
		const viaWatch: NotificationRuleInput = {
			...legacy,
			watchQuery: compiled.watchQuery,
		};
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "tx1",
					dateIso: "2026-07-15T14:00:00.000Z",
					amount: 42,
					merchantName: "Amazon",
					type: "EXPENSE",
					hashtags: [],
					accountId: "a1",
					pending: false,
					isRecurring: false,
				},
			],
		};
		const now = new Date("2026-07-15T15:00:00.000Z");
		const legacyResult = evaluateNotificationRule(legacy, snapshot, now, "UTC");
		const watchResult = evaluateNotificationRule(
			viaWatch,
			snapshot,
			now,
			"UTC",
		);
		assert.equal(legacyResult.fired, watchResult.fired);
		assert.equal(legacyResult.fired, true);
	});
});
