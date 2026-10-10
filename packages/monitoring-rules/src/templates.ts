import type { NotificationRuleInput } from "./rule";
import type { NotificationSignalType } from "./signal";

export type NotificationTemplate = {
	id: string;
	title: string;
	description: string;
	signalType: NotificationSignalType;
	defaultRule: NotificationRuleInput;
};

export const notificationTemplates: NotificationTemplate[] = [
	{
		id: "transaction_appeared",
		title: "Transaction appeared",
		description:
			"Notify when a transaction matching your criteria appears today.",
		signalType: "transaction_appeared",
		defaultRule: {
			name: "Watch for a transaction",
			plainLanguageSummary:
				"Moat will notify you when a transaction matching your watch criteria appears.",
			signalType: "transaction_appeared",
			trigger: {
				signalType: "transaction_appeared",
				match: {},
			},
			conditions: [{ kind: "appears" }],
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
			urgency: "informational",
			templateId: "transaction_appeared",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "missing_expected_payment",
		title: "Missing expected payment",
		description: "Notify when an expected payment like rent does not appear.",
		signalType: "expected_transaction_missing",
		defaultRule: {
			name: "Missing expected payment",
			plainLanguageSummary:
				"On the configured day each month, Moat checks whether your expected payment appeared. If it did not, you will be notified.",
			signalType: "expected_transaction_missing",
			trigger: {
				signalType: "expected_transaction_missing",
				match: { recurringLabel: "Rent", categoryName: "Rent" },
				expectedCadence: "monthly",
				expectedWindowStartDay: 1,
				expectedWindowEndDay: 3,
				missingAfterDay: 5,
			},
			conditions: [{ kind: "does_not_appear_by_date", dayOfMonth: 5 }],
			schedule: { kind: "immediate" },
			channels: ["email", "push", "in_app"],
			urgency: "important",
			templateId: "missing_expected_payment",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "budget_almost_reached",
		title: "Budget almost reached",
		description: "Notify when a category reaches a percentage of its budget.",
		signalType: "budget_threshold",
		defaultRule: {
			name: "Budget almost reached",
			plainLanguageSummary:
				"Moat will notify you when a category reaches 80% of its monthly budget.",
			signalType: "budget_threshold",
			trigger: {
				signalType: "budget_threshold",
				thresholdPercent: 80,
			},
			conditions: [{ kind: "exceeds_amount", percent: 80 }],
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
			urgency: "important",
			templateId: "budget_almost_reached",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "large_or_unusual_purchase",
		title: "Large or unusual purchase",
		description: "Notify on large transactions that are not recurring.",
		signalType: "large_transaction",
		defaultRule: {
			name: "Large purchase",
			plainLanguageSummary:
				"Moat will notify you when a non-recurring transaction exceeds your threshold.",
			signalType: "large_transaction",
			trigger: {
				signalType: "large_transaction",
				amountThreshold: 500,
				excludeRecurring: true,
				match: {},
			},
			conditions: [{ kind: "exceeds_amount", amount: 500 }],
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
			urgency: "important",
			templateId: "large_or_unusual_purchase",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "low_account_balance",
		title: "Low account balance",
		description: "Notify when checking or savings drops below a threshold.",
		signalType: "balance_threshold",
		defaultRule: {
			name: "Low account balance",
			plainLanguageSummary:
				"Moat will notify you when your account balance falls below your preferred level.",
			signalType: "balance_threshold",
			trigger: {
				signalType: "balance_threshold",
				thresholdAmount: 1500,
				direction: "below",
			},
			conditions: [{ kind: "falls_below_amount", amount: 1500 }],
			schedule: { kind: "immediate" },
			channels: ["email", "push", "in_app"],
			urgency: "critical",
			templateId: "low_account_balance",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "recurring_bill_changed",
		title: "Recurring bill changed",
		description: "Notify when a subscription or bill amount changes.",
		signalType: "recurring_amount_changed",
		defaultRule: {
			name: "Recurring bill changed",
			plainLanguageSummary:
				"Moat will notify you when a recurring bill changes by more than 10%.",
			signalType: "recurring_amount_changed",
			trigger: {
				signalType: "recurring_amount_changed",
				percentChange: 10,
				match: {},
			},
			conditions: [{ kind: "changes_by_percent", percent: 10 }],
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
			urgency: "important",
			templateId: "recurring_bill_changed",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "upcoming_bill",
		title: "Upcoming bill",
		description: "Remind you before an expected recurring bill.",
		signalType: "upcoming_recurring_bill",
		defaultRule: {
			name: "Upcoming bill",
			plainLanguageSummary:
				"Moat will remind you about recurring bills coming up in the next 7 days.",
			signalType: "upcoming_recurring_bill",
			trigger: {
				signalType: "upcoming_recurring_bill",
				daysAhead: 7,
				match: {},
			},
			conditions: [{ kind: "appears" }],
			schedule: { kind: "morning_digest" },
			channels: ["in_app", "email"],
			urgency: "informational",
			templateId: "upcoming_bill",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "account_stopped_syncing",
		title: "Account stopped syncing",
		description: "Notify when a connected account goes stale.",
		signalType: "account_sync_stale",
		defaultRule: {
			name: "Account sync interrupted",
			plainLanguageSummary:
				"Moat will notify you if a connected account has not synced within 48 hours.",
			signalType: "account_sync_stale",
			trigger: {
				signalType: "account_sync_stale",
				staleAfterHours: 48,
			},
			conditions: [{ kind: "remains_unresolved", unresolvedHours: 48 }],
			schedule: { kind: "immediate" },
			channels: ["email", "in_app"],
			urgency: "critical",
			templateId: "account_stopped_syncing",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "weekly_or_monthly_summary",
		title: "Weekly or monthly summary",
		description: "Scheduled money summary delivered on your schedule.",
		signalType: "scheduled_summary",
		defaultRule: {
			name: "Weekly money summary",
			plainLanguageSummary:
				"Every Monday at midnight Pacific (3:00 a.m. Eastern), Moat will send your weekly money summary covering the previous Monday–Sunday.",
			signalType: "scheduled_summary",
			trigger: {
				signalType: "scheduled_summary",
				reportingPeriod: "previous_calendar_week",
			},
			conditions: [],
			schedule: {
				kind: "cron_summary",
				dayOfWeek: 1,
				minuteOfDay: 480,
			},
			channels: ["email", "in_app"],
			urgency: "informational",
			templateId: "weekly_or_monthly_summary",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "roommate_payment_check",
		title: "Roommate payment check",
		description:
			"On a chosen day, report how many expected payments arrived in a day-of-month window.",
		signalType: "transaction_appeared",
		defaultRule: {
			name: "Roommate Venmo check",
			plainLanguageSummary:
				"On the 3rd, report how many Venmo payments between $520–$630 arrived since the 1st (expect 3).",
			signalType: "transaction_appeared",
			trigger: {
				signalType: "transaction_appeared",
				match: { merchantContains: "Venmo" },
			},
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
			conditions: [],
			schedule: { kind: "monthly_on_day", dayOfMonth: 3, minuteOfDay: 480 },
			channels: ["email", "push", "in_app"],
			urgency: "important",
			templateId: "roommate_payment_check",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "category_budget_percent",
		title: "Category budget %",
		description: "Notify when a category reaches a percentage of its budget.",
		signalType: "budget_threshold",
		defaultRule: {
			name: "Eating out halfway",
			plainLanguageSummary:
				"Notify when Eating Out reaches 50% of this month’s budget.",
			signalType: "budget_threshold",
			trigger: {
				signalType: "budget_threshold",
				categoryName: "Eating Out",
				thresholdPercent: 50,
			},
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
			conditions: [],
			schedule: { kind: "immediate" },
			channels: ["push", "in_app"],
			urgency: "important",
			templateId: "category_budget_percent",
			source: "manual",
			isActive: true,
		},
	},
	{
		id: "mid_month_spend_status",
		title: "Mid-month spend status",
		description: "Status report for category spend over a day-of-month window.",
		signalType: "transaction_appeared",
		defaultRule: {
			name: "Mid-month grocery check",
			plainLanguageSummary:
				"On the 20th, report grocery spend between the 17th and 20th.",
			signalType: "transaction_appeared",
			trigger: {
				signalType: "transaction_appeared",
				match: { categoryName: "Groceries" },
			},
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
			conditions: [],
			schedule: { kind: "month_window_end" },
			channels: ["in_app", "email"],
			urgency: "informational",
			templateId: "mid_month_spend_status",
			source: "manual",
			isActive: true,
		},
	},
];

export function getNotificationTemplate(
	id: string,
): NotificationTemplate | undefined {
	return notificationTemplates.find((template) => template.id === id);
}
