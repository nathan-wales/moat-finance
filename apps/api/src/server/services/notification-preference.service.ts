import type {
	NotificationChannel as ZodChannel,
	PushPrivacyLevel as ZodPrivacy,
} from "@moat/monitoring-rules";
import type { PrismaClient } from "../../../generated/prisma";
import {
	ensureDefaultWeeklySummaryRule,
	getOrCreateNotificationPreference,
	syncWeeklySummaryRuleFromPrefs,
} from "./notification-bootstrap.service";
import {
	fromPrismaChannels,
	fromPrismaPrivacy,
	toPrismaChannels,
	toPrismaPrivacy,
} from "./notification-mapping";

export type NotificationPreferenceView = {
	timezone: string;
	pushPrivacyLevel: ZodPrivacy;
	quietHoursEnabled: boolean;
	quietHoursStartMinute: number;
	quietHoursEndMinute: number;
	maxPushPerDay: number;
	weeklySummaryEnabled: boolean;
	weeklySummaryDayOfWeek: number;
	weeklySummaryMinuteOfDay: number;
	weeklySummaryChannels: ZodChannel[];
	weeklySummaryReportingPeriod: string;
	weeklySummaryIncludeAiObservations: boolean;
	weeklySummaryAccountIds: string[];
	weeklySummarySections: string[];
	emailEnabled: boolean;
	pushEnabled: boolean;
	inAppEnabled: boolean;
	onboardingSummaryAcknowledgedAt: string | null;
};

function formatPreference(row: {
	timezone: string;
	pushPrivacyLevel: Parameters<typeof fromPrismaPrivacy>[0];
	quietHoursEnabled: boolean;
	quietHoursStartMinute: number;
	quietHoursEndMinute: number;
	maxPushPerDay: number;
	weeklySummaryEnabled: boolean;
	weeklySummaryDayOfWeek: number;
	weeklySummaryMinuteOfDay: number;
	weeklySummaryChannels: Parameters<typeof fromPrismaChannels>[0];
	weeklySummaryReportingPeriod: string;
	weeklySummaryIncludeAiObservations: boolean;
	weeklySummaryAccountIds: string[];
	weeklySummarySections: string[];
	emailEnabled: boolean;
	pushEnabled: boolean;
	inAppEnabled: boolean;
	onboardingSummaryAcknowledgedAt: Date | null;
}): NotificationPreferenceView {
	return {
		timezone: row.timezone,
		pushPrivacyLevel: fromPrismaPrivacy(row.pushPrivacyLevel),
		quietHoursEnabled: row.quietHoursEnabled,
		quietHoursStartMinute: row.quietHoursStartMinute,
		quietHoursEndMinute: row.quietHoursEndMinute,
		maxPushPerDay: row.maxPushPerDay,
		weeklySummaryEnabled: row.weeklySummaryEnabled,
		weeklySummaryDayOfWeek: row.weeklySummaryDayOfWeek,
		weeklySummaryMinuteOfDay: row.weeklySummaryMinuteOfDay,
		weeklySummaryChannels: fromPrismaChannels(row.weeklySummaryChannels),
		weeklySummaryReportingPeriod: row.weeklySummaryReportingPeriod,
		weeklySummaryIncludeAiObservations: row.weeklySummaryIncludeAiObservations,
		weeklySummaryAccountIds: row.weeklySummaryAccountIds,
		weeklySummarySections: row.weeklySummarySections,
		emailEnabled: row.emailEnabled,
		pushEnabled: row.pushEnabled,
		inAppEnabled: row.inAppEnabled,
		onboardingSummaryAcknowledgedAt:
			row.onboardingSummaryAcknowledgedAt?.toISOString() ?? null,
	};
}

export async function getNotificationPreferenceView(
	db: PrismaClient,
	userId: string,
): Promise<NotificationPreferenceView> {
	const pref = await getOrCreateNotificationPreference(db, userId);
	await ensureDefaultWeeklySummaryRule(db, userId);
	return formatPreference(pref);
}

export type UpdateNotificationPreferenceInput = {
	timezone?: string;
	pushPrivacyLevel?: ZodPrivacy;
	quietHoursEnabled?: boolean;
	quietHoursStartMinute?: number;
	quietHoursEndMinute?: number;
	maxPushPerDay?: number;
	weeklySummaryEnabled?: boolean;
	weeklySummaryDayOfWeek?: number;
	weeklySummaryMinuteOfDay?: number;
	weeklySummaryChannels?: ZodChannel[];
	weeklySummaryReportingPeriod?: string;
	weeklySummaryIncludeAiObservations?: boolean;
	weeklySummaryAccountIds?: string[];
	weeklySummarySections?: string[];
	emailEnabled?: boolean;
	pushEnabled?: boolean;
	inAppEnabled?: boolean;
	acknowledgeWeeklySummaryOnboarding?: boolean;
};

export async function updateNotificationPreference(
	db: PrismaClient,
	userId: string,
	input: UpdateNotificationPreferenceInput,
): Promise<NotificationPreferenceView> {
	await getOrCreateNotificationPreference(db, userId);
	const updated = await db.notificationPreference.update({
		where: { userId },
		data: {
			...(input.timezone !== undefined ? { timezone: input.timezone } : {}),
			...(input.pushPrivacyLevel !== undefined
				? { pushPrivacyLevel: toPrismaPrivacy(input.pushPrivacyLevel) }
				: {}),
			...(input.quietHoursEnabled !== undefined
				? { quietHoursEnabled: input.quietHoursEnabled }
				: {}),
			...(input.quietHoursStartMinute !== undefined
				? { quietHoursStartMinute: input.quietHoursStartMinute }
				: {}),
			...(input.quietHoursEndMinute !== undefined
				? { quietHoursEndMinute: input.quietHoursEndMinute }
				: {}),
			...(input.maxPushPerDay !== undefined
				? { maxPushPerDay: input.maxPushPerDay }
				: {}),
			...(input.weeklySummaryEnabled !== undefined
				? { weeklySummaryEnabled: input.weeklySummaryEnabled }
				: {}),
			...(input.weeklySummaryDayOfWeek !== undefined
				? { weeklySummaryDayOfWeek: input.weeklySummaryDayOfWeek }
				: {}),
			...(input.weeklySummaryMinuteOfDay !== undefined
				? { weeklySummaryMinuteOfDay: input.weeklySummaryMinuteOfDay }
				: {}),
			...(input.weeklySummaryChannels !== undefined
				? {
						weeklySummaryChannels: toPrismaChannels(
							input.weeklySummaryChannels,
						),
					}
				: {}),
			...(input.weeklySummaryReportingPeriod !== undefined
				? {
						weeklySummaryReportingPeriod: input.weeklySummaryReportingPeriod,
					}
				: {}),
			...(input.weeklySummaryIncludeAiObservations !== undefined
				? {
						weeklySummaryIncludeAiObservations:
							input.weeklySummaryIncludeAiObservations,
					}
				: {}),
			...(input.weeklySummaryAccountIds !== undefined
				? { weeklySummaryAccountIds: input.weeklySummaryAccountIds }
				: {}),
			...(input.weeklySummarySections !== undefined
				? { weeklySummarySections: input.weeklySummarySections }
				: {}),
			...(input.emailEnabled !== undefined
				? { emailEnabled: input.emailEnabled }
				: {}),
			...(input.pushEnabled !== undefined
				? { pushEnabled: input.pushEnabled }
				: {}),
			...(input.inAppEnabled !== undefined
				? { inAppEnabled: input.inAppEnabled }
				: {}),
			...(input.acknowledgeWeeklySummaryOnboarding
				? { onboardingSummaryAcknowledgedAt: new Date() }
				: {}),
		},
	});
	await ensureDefaultWeeklySummaryRule(db, userId);
	await syncWeeklySummaryRuleFromPrefs(db, userId);
	return formatPreference(updated);
}
