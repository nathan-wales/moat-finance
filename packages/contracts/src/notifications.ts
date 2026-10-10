export type NotificationChannel = "email" | "push" | "in_app";
export type NotificationSignalType =
	| "transaction_appeared"
	| "expected_transaction_missing"
	| "budget_threshold"
	| "balance_threshold"
	| "large_transaction"
	| "recurring_amount_changed"
	| "upcoming_recurring_bill"
	| "account_sync_stale"
	| "scheduled_summary";

export type NotificationUrgency = "critical" | "important" | "informational";
export type PushPrivacyLevel =
	| "hide_details"
	| "general_details"
	| "show_amounts";

export type NotificationRule = {
	id: string;
	name: string;
	plainLanguageSummary: string | null;
	signalType: NotificationSignalType;
	trigger: Record<string, unknown>;
	conditions: Array<Record<string, unknown>>;
	schedule: {
		kind: string;
		dayOfWeek?: number;
		dayOfMonth?: number;
		minuteOfDay?: number;
		timezone?: string;
	};
	watchQuery?: Record<string, unknown> | null;
	channels: NotificationChannel[];
	urgency: NotificationUrgency;
	isActive: boolean;
	isPaused: boolean;
	templateId: string | null;
	source: string;
	sourceAttribution: string | null;
	lastEvaluatedAt: string | null;
	lastFiredAt: string | null;
	fireCount: number;
	createdAt: string;
	updatedAt: string;
};

export type NotificationPreference = {
	timezone: string;
	pushPrivacyLevel: PushPrivacyLevel;
	quietHoursEnabled: boolean;
	quietHoursStartMinute: number;
	quietHoursEndMinute: number;
	maxPushPerDay: number;
	weeklySummaryEnabled: boolean;
	weeklySummaryDayOfWeek: number;
	weeklySummaryMinuteOfDay: number;
	weeklySummaryChannels: NotificationChannel[];
	weeklySummaryReportingPeriod: string;
	weeklySummaryIncludeAiObservations: boolean;
	weeklySummaryAccountIds: string[];
	weeklySummarySections: string[];
	emailEnabled: boolean;
	pushEnabled: boolean;
	inAppEnabled: boolean;
	onboardingSummaryAcknowledgedAt: string | null;
};

export type NotificationInboxItem = {
	id: string;
	ruleId: string | null;
	title: string;
	body: string;
	channels: string[];
	deliveryResult: string;
	explanation: {
		signalType: string;
		summary: string;
		facts: Array<{ label: string; value: string }>;
	};
	linkedData: unknown;
	readAt: string | null;
	resolutionStatus: string;
	isWeeklySummary: boolean;
	createdAt: string;
};

export type NotificationSuggestion = {
	id: string;
	suggestionKey: string;
	title: string;
	description: string;
	templateId: string;
	prefill: Record<string, unknown>;
	createdAt: string;
};

export type NotificationTemplate = {
	id: string;
	title: string;
	description: string;
	signalType: NotificationSignalType;
	defaultRule: Record<string, unknown>;
};

export type CreateNotificationRuleInput = Record<string, unknown> & {
	name: string;
	signalType?: NotificationSignalType;
};

export type UpdateNotificationRuleInput =
	Partial<CreateNotificationRuleInput> & {
		id: string;
	};
