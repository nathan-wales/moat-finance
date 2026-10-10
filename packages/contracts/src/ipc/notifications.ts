import { z } from "zod";

export const NOTIFICATION_CHANNELS = {
	listRules: "notifications:listRules",
	getRule: "notifications:getRule",
	createRule: "notifications:createRule",
	updateRule: "notifications:updateRule",
	pauseRule: "notifications:pauseRule",
	deleteRule: "notifications:deleteRule",
	getPreferences: "notifications:getPreferences",
	updatePreferences: "notifications:updatePreferences",
	listInbox: "notifications:listInbox",
	markRead: "notifications:markRead",
	resolve: "notifications:resolve",
	listSuggestions: "notifications:listSuggestions",
	dismissSuggestion: "notifications:dismissSuggestion",
} as const;

export const IpcResolveNotificationSchema = z.object({
	id: z.string().min(1),
	status: z.enum(["RESOLVED", "SNOOZED", "MUTED"]),
	snoozedUntilIso: z.string().optional(),
	action: z.enum(["paid_elsewhere", "ignore_this_month"]).optional(),
});

export const IpcNotificationRuleIdSchema = z.object({
	id: z.string().min(1),
});

export const IpcPauseNotificationRuleSchema = z.object({
	id: z.string().min(1),
	paused: z.boolean(),
});

export const IpcCreateNotificationRuleSchema = z.object({
	name: z.string().min(1).max(200),
	plainLanguageSummary: z.string().max(1000).optional().nullable(),
	signalType: z.string().min(1).optional(),
	trigger: z.record(z.unknown()).optional(),
	watchQuery: z.record(z.unknown()).optional().nullable(),
	conditions: z.array(z.record(z.unknown())).default([]),
	schedule: z.record(z.unknown()).default({ kind: "immediate" }),
	channels: z.array(z.string()).min(1).default(["in_app"]),
	urgency: z
		.enum(["critical", "important", "informational"])
		.default("important"),
	templateId: z.string().optional().nullable(),
	source: z.string().default("manual"),
	sourceAttribution: z.string().optional().nullable(),
	isActive: z.boolean().default(true),
});

export const IpcUpdateNotificationRuleSchema =
	IpcCreateNotificationRuleSchema.partial().extend({
		id: z.string().min(1),
	});

export const IpcUpdateNotificationPreferencesSchema = z.object({
	timezone: z.string().optional(),
	pushPrivacyLevel: z
		.enum(["hide_details", "general_details", "show_amounts"])
		.optional(),
	quietHoursEnabled: z.boolean().optional(),
	quietHoursStartMinute: z.number().int().optional(),
	quietHoursEndMinute: z.number().int().optional(),
	maxPushPerDay: z.number().int().optional(),
	weeklySummaryEnabled: z.boolean().optional(),
	weeklySummaryDayOfWeek: z.number().int().optional(),
	weeklySummaryMinuteOfDay: z.number().int().optional(),
	weeklySummaryChannels: z
		.array(z.enum(["email", "push", "in_app"]))
		.optional(),
	weeklySummaryReportingPeriod: z.string().optional(),
	weeklySummaryIncludeAiObservations: z.boolean().optional(),
	weeklySummaryAccountIds: z.array(z.string()).optional(),
	weeklySummarySections: z.array(z.string()).optional(),
	emailEnabled: z.boolean().optional(),
	pushEnabled: z.boolean().optional(),
	inAppEnabled: z.boolean().optional(),
	acknowledgeWeeklySummaryOnboarding: z.boolean().optional(),
});
