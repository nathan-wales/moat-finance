import { z } from "zod";

export const notificationChannels = ["email", "push", "in_app"] as const;
export const notificationChannelSchema = z.enum(notificationChannels);
export type NotificationChannel = z.infer<typeof notificationChannelSchema>;

export const notificationScheduleKinds = [
	"immediate",
	"morning_digest",
	"evening_digest",
	"custom_time",
	"cron_summary",
	"monthly_on_day",
	"month_window_end",
] as const;

export const notificationScheduleKindSchema = z.enum(notificationScheduleKinds);
export type NotificationScheduleKind = z.infer<
	typeof notificationScheduleKindSchema
>;

export const notificationUrgencyLevels = [
	"critical",
	"important",
	"informational",
] as const;

export const notificationUrgencySchema = z.enum(notificationUrgencyLevels);
export type NotificationUrgency = z.infer<typeof notificationUrgencySchema>;

export const pushPrivacyLevels = [
	"hide_details",
	"general_details",
	"show_amounts",
] as const;

export const pushPrivacyLevelSchema = z.enum(pushPrivacyLevels);
export type PushPrivacyLevel = z.infer<typeof pushPrivacyLevelSchema>;

export const deliveryScheduleSchema = z
	.object({
		kind: notificationScheduleKindSchema.default("immediate"),
		dayOfWeek: z.number().int().min(0).max(6).optional(),
		dayOfMonth: z.number().int().min(1).max(31).optional(),
		minuteOfDay: z.number().int().min(0).max(1439).optional(),
		timezone: z.string().min(1).max(80).optional(),
	})
	.superRefine((schedule, ctx) => {
		if (
			schedule.kind === "monthly_on_day" &&
			schedule.dayOfMonth === undefined
		) {
			ctx.addIssue({
				code: z.ZodIssueCode.custom,
				message: "monthly_on_day requires dayOfMonth",
				path: ["dayOfMonth"],
			});
		}
	});

export type DeliverySchedule = z.infer<typeof deliveryScheduleSchema>;

export const quietHoursSchema = z.object({
	enabled: z.boolean().default(false),
	startMinuteOfDay: z.number().int().min(0).max(1439).default(1320),
	endMinuteOfDay: z.number().int().min(0).max(1439).default(480),
});

export type QuietHours = z.infer<typeof quietHoursSchema>;
