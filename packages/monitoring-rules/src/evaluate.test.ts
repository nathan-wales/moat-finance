import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildDedupeKey,
	evaluateNotificationRule,
	parseNaturalLanguageRulePrompt,
	renderPushCopy,
} from "./evaluate";
import type { NotificationRuleInput } from "./rule";
import type { FinancialSnapshot } from "./snapshot";
import {
	getZonedParts,
	isWithinQuietHours,
	matchesLocalSchedule,
	matchesUtcCronWeekday,
} from "./timezone";

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
	previousWeekNetWorth: 9800,
};

describe("evaluateNotificationRule", () => {
	it("fires transaction_appeared for same-day matches", () => {
		const rule: NotificationRuleInput = {
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
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			transactions: [
				{
					id: "tx1",
					dateIso: "2026-07-15T14:00:00.000Z",
					amount: -42,
					merchantName: "Amazon",
					description: "Order",
					categoryName: "Shopping",
					hashtags: [],
					accountId: "a1",
					pending: false,
					isRecurring: false,
				},
			],
		};
		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-07-15T15:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.explanation.summary, /matched/i);
	});

	it("fires budget_threshold when percent used crosses threshold", () => {
		const rule: NotificationRuleInput = {
			name: "Dining budget",
			signalType: "budget_threshold",
			trigger: {
				signalType: "budget_threshold",
				categoryName: "Restaurants",
				thresholdPercent: 80,
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const snapshot: FinancialSnapshot = {
			...emptySnapshot,
			budgets: [
				{
					categoryId: "c1",
					categoryName: "Restaurants",
					monthlyGoal: 400,
					spent: 328,
					percentUsed: 82,
					percentOfMonthElapsed: 50,
				},
			],
		};
		const result = evaluateNotificationRule(
			rule,
			snapshot,
			new Date("2026-07-15T15:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.explanation.summary, /Restaurants/);
		assert.equal(result.explanation.threshold?.value, 80);
	});

	it("fires expected_transaction_missing after missing-after day", () => {
		const rule: NotificationRuleInput = {
			name: "Rent missing",
			signalType: "expected_transaction_missing",
			trigger: {
				signalType: "expected_transaction_missing",
				match: { recurringLabel: "Rent", categoryName: "Rent" },
				expectedCadence: "monthly",
				expectedWindowStartDay: 1,
				expectedWindowEndDay: 3,
				missingAfterDay: 5,
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["email"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			emptySnapshot,
			new Date("2026-07-06T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.equal(result.explanation.absentExpectedLabel, "Rent");
	});

	it("does not fire expected_transaction_missing before missing-after day", () => {
		const rule: NotificationRuleInput = {
			name: "Rent missing",
			signalType: "expected_transaction_missing",
			trigger: {
				signalType: "expected_transaction_missing",
				match: { recurringLabel: "Rent" },
				expectedCadence: "monthly",
				expectedWindowStartDay: 1,
				expectedWindowEndDay: 3,
				missingAfterDay: 5,
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["email"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			emptySnapshot,
			new Date("2026-07-03T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, false);
	});

	it("fires balance_threshold below amount", () => {
		const rule: NotificationRuleInput = {
			name: "Low balance",
			signalType: "balance_threshold",
			trigger: {
				signalType: "balance_threshold",
				thresholdAmount: 1500,
				direction: "below",
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "critical",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				accounts: [
					{
						id: "a1",
						name: "Checking",
						currentBalance: 900,
						type: "depository",
					},
				],
			},
			new Date("2026-07-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
	});

	it("fires large_transaction for non-recurring spend", () => {
		const rule: NotificationRuleInput = {
			name: "Large purchase",
			signalType: "large_transaction",
			trigger: {
				signalType: "large_transaction",
				amountThreshold: 500,
				excludeRecurring: true,
				match: {},
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				transactions: [
					{
						id: "t1",
						dateIso: "2026-07-15T10:00:00.000Z",
						amount: -750,
						merchantName: "Furniture Co",
						description: "Sofa",
						categoryName: "Shopping",
						hashtags: [],
						accountId: "a1",
						pending: false,
						isRecurring: false,
					},
				],
			},
			new Date("2026-07-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.deepEqual(result.explanation.matchedTransactionIds, ["t1"]);
	});

	it("fires recurring_amount_changed on percent jump", () => {
		const rule: NotificationRuleInput = {
			name: "Subscription change",
			signalType: "recurring_amount_changed",
			trigger: {
				signalType: "recurring_amount_changed",
				percentChange: 10,
				match: {},
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["in_app"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				recurring: [
					{
						label: "StreamCo",
						amount: 18.99,
						previousAmount: 14.99,
						merchantName: "StreamCo",
					},
				],
			},
			new Date("2026-07-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
	});

	it("fires upcoming_recurring_bill inside horizon", () => {
		const rule: NotificationRuleInput = {
			name: "Upcoming bill",
			signalType: "upcoming_recurring_bill",
			trigger: {
				signalType: "upcoming_recurring_bill",
				daysAhead: 7,
				match: {},
			},
			conditions: [],
			schedule: { kind: "morning_digest" },
			channels: ["in_app"],
			urgency: "informational",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				recurring: [
					{
						label: "Internet",
						amount: 80,
						nextExpectedDateIso: "2026-07-18T12:00:00.000Z",
					},
				],
			},
			new Date("2026-07-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
	});

	it("fires account_sync_stale when last sync is old", () => {
		const rule: NotificationRuleInput = {
			name: "Stale sync",
			signalType: "account_sync_stale",
			trigger: {
				signalType: "account_sync_stale",
				staleAfterHours: 48,
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["email"],
			urgency: "critical",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				connections: [
					{
						id: "conn1",
						institutionName: "Chase",
						lastSuccessfulSyncAtIso: "2026-07-10T12:00:00.000Z",
					},
				],
			},
			new Date("2026-07-15T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
	});

	it("always fires scheduled_summary and builds weekly window", () => {
		const rule: NotificationRuleInput = {
			name: "Weekly summary",
			signalType: "scheduled_summary",
			trigger: {
				signalType: "scheduled_summary",
				reportingPeriod: "previous_calendar_week",
			},
			conditions: [],
			schedule: { kind: "cron_summary", dayOfWeek: 1, minuteOfDay: 480 },
			channels: ["email"],
			urgency: "informational",
			source: "default_weekly_summary",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{ ...emptySnapshot, moneyIn: 3000, moneyOut: 2200 },
			new Date("2026-07-20T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, true);
		assert.match(result.evaluationWindow, /scheduled_summary/);
	});

	it("builds stable dedupe keys", () => {
		assert.equal(
			buildDedupeKey("rule1", "budget_threshold:UTC:2026-7-15"),
			"rule1::budget_threshold:UTC:2026-7-15",
		);
	});

	it("treats expectedEvents lastMatchedAt in current month as found", () => {
		const rule: NotificationRuleInput = {
			name: "Rent missing",
			signalType: "expected_transaction_missing",
			trigger: {
				signalType: "expected_transaction_missing",
				match: { recurringLabel: "Rent" },
				expectedCadence: "monthly",
				expectedWindowStartDay: 1,
				expectedWindowEndDay: 3,
				missingAfterDay: 5,
			},
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["email"],
			urgency: "important",
			source: "manual",
			isActive: true,
		};
		const result = evaluateNotificationRule(
			rule,
			{
				...emptySnapshot,
				expectedEvents: [
					{
						id: "e1",
						label: "Rent",
						matchCriteria: { recurringLabel: "Rent" },
						cadence: "monthly",
						expectedWindowStartDay: 1,
						expectedWindowEndDay: 3,
						missingAfterDay: 5,
						amount: 1800,
						accountIds: [],
						lastMatchedAtIso: "2026-07-02T12:00:00.000Z",
					},
				],
			},
			new Date("2026-07-08T12:00:00.000Z"),
			"UTC",
		);
		assert.equal(result.fired, false);
		assert.match(result.explanation.summary, /matched/i);
	});
});

describe("parseNaturalLanguageRulePrompt", () => {
	it("scores missing rent payment with day-of-month preference", () => {
		const rule = parseNaturalLanguageRulePrompt(
			"Alert me by email if rent is missing by the 5th",
		);
		assert.equal(rule.signalType, "expected_transaction_missing");
		assert.equal(rule.trigger.signalType, "expected_transaction_missing");
		if (rule.trigger.signalType === "expected_transaction_missing") {
			assert.equal(rule.trigger.missingAfterDay, 5);
		}
		assert.ok(rule.channels.includes("email"));
	});

	it("defaults recurring amount change to 10 percent", () => {
		const rule = parseNaturalLanguageRulePrompt(
			"Tell me if a subscription gets more expensive",
		);
		assert.equal(rule.signalType, "recurring_amount_changed");
		if (rule.trigger.signalType === "recurring_amount_changed") {
			assert.equal(rule.trigger.percentChange, 10);
		}
	});

	it("parses sync stale intent", () => {
		const rule = parseNaturalLanguageRulePrompt(
			"Notify me if an account hasn't updated in 48 hours",
		);
		assert.equal(rule.signalType, "account_sync_stale");
	});

	it("falls back to budget threshold for generic prompts", () => {
		const rule = parseNaturalLanguageRulePrompt(
			"Keep an eye on my money vibes somehow",
		);
		assert.equal(rule.signalType, "budget_threshold");
		assert.equal(
			rule.plainLanguageSummary,
			"Keep an eye on my money vibes somehow",
		);
	});
});

describe("privacy + timezone", () => {
	it("hide_details push copy contains no dollar amounts", () => {
		const copy = renderPushCopy(
			{
				fired: true,
				evaluationWindow: "x",
				stateHash: "y",
				title: "Balance alert $1,500",
				body: "Checking is at $900 (60%).",
				explanation: {
					signalType: "balance_threshold",
					summary: "x",
					facts: [],
					checkedAccountIds: [],
					matchedTransactionIds: [],
				},
			},
			"hide_details",
		);
		assert.equal(/\$\d/.test(copy.title + copy.body), false);
		assert.equal(/\b60%/.test(copy.body), false);
	});

	it("matches the Monday 07:00 UTC cron slot (midnight PDT)", () => {
		const midnightPacificMonday = new Date("2026-08-31T07:00:00.000Z");
		assert.equal(matchesUtcCronWeekday(midnightPacificMonday, 1), true);
		assert.equal(
			matchesUtcCronWeekday(new Date("2026-09-01T07:00:00.000Z"), 1),
			false,
		);
	});

	it("matches Monday 8am America/New_York including DST spring-forward week", () => {
		// 2026-03-09 is the Monday after US spring-forward (2026-03-08).
		const now = new Date("2026-03-09T12:00:00.000Z"); // 08:00 EDT
		const parts = getZonedParts(now, "America/New_York");
		assert.equal(parts.weekday, 1);
		assert.equal(parts.hour, 8);
		assert.equal(
			matchesLocalSchedule(now, "America/New_York", {
				dayOfWeek: 1,
				minuteOfDay: 480,
			}),
			true,
		);
	});

	it("matches Monday 8am America/New_York during fall-back week", () => {
		// 2026-11-02 is the Monday after US fall-back (2026-11-01).
		const now = new Date("2026-11-02T13:00:00.000Z"); // 08:00 EST
		const parts = getZonedParts(now, "America/New_York");
		assert.equal(parts.weekday, 1);
		assert.equal(parts.hour, 8);
		assert.equal(isWithinQuietHours(now, "America/New_York", 1320, 480), false);
	});
});
