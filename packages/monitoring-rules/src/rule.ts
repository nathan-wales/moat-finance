import { z } from "zod";
import {
	derivePlaceholderTrigger,
	deriveSignalTypeFromWatchQuery,
} from "./compile-legacy-signal";
import { notificationConditionSchema } from "./condition";
import {
	deliveryScheduleSchema,
	notificationChannelSchema,
	notificationUrgencySchema,
} from "./delivery";
import {
	type NotificationSignalType,
	notificationSignalTypeSchema,
	type SignalTrigger,
	signalTriggerSchema,
} from "./signal";
import { type WatchQuery, watchQuerySchema } from "./watch-query";

export const notificationRuleSources = [
	"manual",
	"natural_language",
	"mcp",
	"suggestion",
	"insight",
	"default_weekly_summary",
] as const;

export const notificationRuleSourceSchema = z.enum(notificationRuleSources);
export type NotificationRuleSource = z.infer<
	typeof notificationRuleSourceSchema
>;

export const notificationRuleFieldsSchema = z.object({
	name: z.string().min(1).max(200),
	plainLanguageSummary: z.string().min(1).max(1000).optional(),
	signalType: notificationSignalTypeSchema.optional(),
	trigger: signalTriggerSchema.optional(),
	watchQuery: watchQuerySchema.optional(),
	conditions: z.array(notificationConditionSchema).max(20).default([]),
	schedule: deliveryScheduleSchema.default({ kind: "immediate" }),
	channels: z
		.array(notificationChannelSchema)
		.min(1)
		.max(3)
		.default(["in_app"]),
	urgency: notificationUrgencySchema.default("important"),
	templateId: z.string().min(1).max(80).optional(),
	source: notificationRuleSourceSchema.default("manual"),
	sourceAttribution: z.string().min(1).max(120).optional(),
	isActive: z.boolean().default(true),
});

function refineWatchQueryOrLegacy(
	data: z.infer<typeof notificationRuleFieldsSchema>,
	ctx: z.RefinementCtx,
) {
	if (!data.watchQuery && (!data.signalType || !data.trigger)) {
		ctx.addIssue({
			code: z.ZodIssueCode.custom,
			message:
				"Provide watchQuery, or both signalType and trigger for legacy rules",
			path: ["watchQuery"],
		});
	}
}

export const notificationRuleObjectSchema =
	notificationRuleFieldsSchema.superRefine(refineWatchQueryOrLegacy);

export type NotificationRuleInput = {
	name: string;
	plainLanguageSummary?: string;
	signalType: NotificationSignalType;
	trigger: SignalTrigger;
	watchQuery?: WatchQuery;
	conditions: z.infer<typeof notificationConditionSchema>[];
	schedule: z.infer<typeof deliveryScheduleSchema>;
	channels: z.infer<typeof notificationChannelSchema>[];
	urgency: z.infer<typeof notificationUrgencySchema>;
	templateId?: string;
	source: NotificationRuleSource;
	sourceAttribution?: string;
	isActive: boolean;
};

export function normalizeNotificationRule(
	data: z.infer<typeof notificationRuleFieldsSchema>,
): NotificationRuleInput {
	if (data.watchQuery) {
		const derivedSignal = deriveSignalTypeFromWatchQuery(data.watchQuery);
		return {
			...data,
			// Prefer derived type so stale signalType cannot mis-route cron sweeps.
			signalType: derivedSignal,
			trigger: data.trigger ?? derivePlaceholderTrigger(data.watchQuery),
			watchQuery: data.watchQuery,
		};
	}
	return {
		...data,
		signalType: data.signalType as NotificationSignalType,
		trigger: data.trigger as SignalTrigger,
	};
}

/** Parse + normalize into a fully resolved rule input. */
export const notificationRuleSchema = {
	parse(input: unknown): NotificationRuleInput {
		return normalizeNotificationRule(notificationRuleObjectSchema.parse(input));
	},
	safeParse(input: unknown) {
		const parsed = notificationRuleObjectSchema.safeParse(input);
		if (!parsed.success) return parsed;
		return {
			success: true as const,
			data: normalizeNotificationRule(parsed.data),
		};
	},
};

export const createNotificationRuleInputSchema = notificationRuleFieldsSchema;

export const updateNotificationRuleInputSchema = notificationRuleFieldsSchema
	.partial()
	.extend({
		id: z.string().min(1),
	});

export type UpdateNotificationRuleInput = z.infer<
	typeof updateNotificationRuleInputSchema
>;

export const pauseNotificationRuleInputSchema = z.object({
	id: z.string().min(1),
	paused: z.boolean(),
});

export const deleteNotificationRuleInputSchema = z.object({
	id: z.string().min(1),
});

export const previewNotificationRuleInputSchema = z.object({
	rule: notificationRuleFieldsSchema,
});

export const naturalLanguageRuleInputSchema = z.object({
	prompt: z.string().min(3).max(1000),
});
