import {
	createNotificationRuleInputSchema,
	deleteNotificationRuleInputSchema,
	naturalLanguageRuleInputSchema,
	notificationRuleSchema,
	notificationTemplates,
	parseNaturalLanguageRulePrompt,
	pauseNotificationRuleInputSchema,
	previewNotificationRuleInputSchema,
	updateNotificationRuleInputSchema,
} from "@moat/monitoring-rules";
import { z } from "zod";
import { logger } from "~/lib/logger";
import {
	listNotificationInbox,
	markNotificationRead,
	resolveNotification,
} from "~/server/services/notification-delivery.service";
import { previewNotificationRule } from "~/server/services/notification-evaluation.service";
import {
	getNotificationPreferenceView,
	updateNotificationPreference,
} from "~/server/services/notification-preference.service";
import {
	createNotificationRule,
	deleteNotificationRule,
	getNotificationRuleById,
	listNotificationRules,
	pauseNotificationRule,
	updateNotificationRule,
} from "~/server/services/notification-rule.service";
import {
	dismissNotificationSuggestion,
	listNotificationSuggestions,
} from "~/server/services/notification-suggestion.service";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

const idInput = z.object({ id: z.string().min(1) });

const preferenceUpdateInput = z.object({
	timezone: z.string().min(1).max(80).optional(),
	pushPrivacyLevel: z
		.enum(["hide_details", "general_details", "show_amounts"])
		.optional(),
	quietHoursEnabled: z.boolean().optional(),
	quietHoursStartMinute: z.number().int().min(0).max(1439).optional(),
	quietHoursEndMinute: z.number().int().min(0).max(1439).optional(),
	maxPushPerDay: z.number().int().min(0).max(100).optional(),
	weeklySummaryEnabled: z.boolean().optional(),
	weeklySummaryDayOfWeek: z.number().int().min(0).max(6).optional(),
	weeklySummaryMinuteOfDay: z.number().int().min(0).max(1439).optional(),
	weeklySummaryChannels: z
		.array(z.enum(["email", "push", "in_app"]))
		.min(1)
		.max(3)
		.optional(),
	weeklySummaryReportingPeriod: z.string().min(1).max(80).optional(),
	weeklySummaryIncludeAiObservations: z.boolean().optional(),
	weeklySummaryAccountIds: z.array(z.string()).max(50).optional(),
	weeklySummarySections: z.array(z.string()).max(20).optional(),
	emailEnabled: z.boolean().optional(),
	pushEnabled: z.boolean().optional(),
	inAppEnabled: z.boolean().optional(),
	acknowledgeWeeklySummaryOnboarding: z.boolean().optional(),
});

const resolveInput = z.object({
	id: z.string().min(1),
	status: z.enum(["RESOLVED", "SNOOZED", "MUTED"]),
	snoozedUntilIso: z.string().datetime().optional(),
	action: z.enum(["paid_elsewhere", "ignore_this_month"]).optional(),
});

const registerPushTokenInput = z.object({
	token: z.string().min(10).max(512),
	platform: z.enum(["ios"]).default("ios"),
	appVersion: z.string().max(40).optional(),
});

export const notificationRule = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const rules = await listNotificationRules(ctx.db, ctx.userId);
		return { rules };
	}),

	get: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = idInput.parse(body ?? {});
		const rule = await getNotificationRuleById(ctx.db, ctx.userId, input.id);
		return { rule };
	}),

	templates: withDemoOrAuth(async (_ctx: DemoOrAuthContext) => {
		return { templates: notificationTemplates };
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = createNotificationRuleInputSchema.parse(body);
		const rule = await createNotificationRule(ctx.db, {
			userId: ctx.userId,
			input,
		});
		logger.info("notification_rule_created", {
			userId: ctx.userId,
			feature: "notifications",
			operation: "create",
			signalType: rule.signalType,
			source: rule.source,
		});
		return { rule };
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = updateNotificationRuleInputSchema.parse(body);
		const rule = await updateNotificationRule(ctx.db, ctx.userId, input);
		return { rule };
	}),

	pause: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = pauseNotificationRuleInputSchema.parse(body);
		const rule = await pauseNotificationRule(
			ctx.db,
			ctx.userId,
			input.id,
			input.paused,
		);
		return { rule };
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = deleteNotificationRuleInputSchema.parse(body);
		await deleteNotificationRule(ctx.db, ctx.userId, input.id);
		return { success: true };
	}),

	preview: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = previewNotificationRuleInputSchema.parse(body);
		const result = await previewNotificationRule(
			ctx.db,
			ctx.userId,
			notificationRuleSchema.parse(input.rule),
		);
		return result;
	}),

	parseNaturalLanguage: withDemoOrAuth(
		async (_ctx: DemoOrAuthContext, body: unknown) => {
			const input = naturalLanguageRuleInputSchema.parse(body);
			const rule = parseNaturalLanguageRulePrompt(input.prompt);
			return { rule };
		},
	),

	getPreferences: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const preferences = await getNotificationPreferenceView(ctx.db, ctx.userId);
		return { preferences };
	}),

	updatePreferences: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = preferenceUpdateInput.parse(body);
			const preferences = await updateNotificationPreference(
				ctx.db,
				ctx.userId,
				input,
			);
			return { preferences };
		},
	),

	listInbox: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = z
			.object({
				unreadOnly: z.boolean().optional(),
				limit: z.number().int().min(1).max(100).optional(),
			})
			.parse(body ?? {});
		const items = await listNotificationInbox(ctx.db, ctx.userId, input);
		return { items };
	}),

	markRead: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = idInput.parse(body);
		await markNotificationRead(ctx.db, ctx.userId, input.id);
		return { success: true };
	}),

	resolve: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = resolveInput.parse(body);
		await resolveNotification(
			ctx.db,
			ctx.userId,
			input.id,
			input.status,
			input.snoozedUntilIso ? new Date(input.snoozedUntilIso) : undefined,
			input.action,
		);
		return { success: true };
	}),

	listSuggestions: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const suggestions = await listNotificationSuggestions(ctx.db, ctx.userId);
		return { suggestions };
	}),

	dismissSuggestion: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = idInput.parse(body);
			await dismissNotificationSuggestion(ctx.db, ctx.userId, input.id);
			return { success: true };
		},
	),

	registerPushToken: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = registerPushTokenInput.parse(body);
			await ctx.db.devicePushToken.upsert({
				where: {
					userId_token: {
						userId: ctx.userId,
						token: input.token,
					},
				},
				create: {
					userId: ctx.userId,
					token: input.token,
					platform: input.platform,
					appVersion: input.appVersion,
				},
				update: {
					platform: input.platform,
					appVersion: input.appVersion,
					lastRegisteredAt: new Date(),
					revokedAt: null,
				},
			});
			return { success: true };
		},
	),
};

export const notificationInbox = {
	list: notificationRule.listInbox,
};
