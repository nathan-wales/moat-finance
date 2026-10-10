import {
	getNotificationTemplate,
	type NotificationChannel,
} from "@moat/monitoring-rules";
import type { Prisma, PrismaClient } from "../../../generated/prisma";
import {
	fromPrismaChannels,
	toPrismaChannels,
	toPrismaSignal,
	toPrismaUrgency,
} from "./notification-mapping";

const WEEKLY_SUMMARY_SOURCE = "default_weekly_summary";
const WEEKLY_SUMMARY_TEMPLATE_ID = "weekly_or_monthly_summary";

type NotificationDb = PrismaClient | Prisma.TransactionClient;

function findDefaultWeeklySummaryRule(db: NotificationDb, userId: string) {
	return db.notificationRule.findFirst({
		where: {
			userId,
			source: WEEKLY_SUMMARY_SOURCE,
			signalType: "SCHEDULED_SUMMARY",
		},
	});
}

export async function getOrCreateNotificationPreference(
	db: PrismaClient,
	userId: string,
) {
	// Upsert rather than create-and-recover: requests run inside a single
	// database-actor transaction, where a caught constraint violation would
	// still leave the transaction aborted.
	return db.notificationPreference.upsert({
		where: { userId },
		create: { userId },
		update: {},
	});
}

export async function ensureDefaultWeeklySummaryRule(
	db: PrismaClient,
	userId: string,
) {
	const existing = await findDefaultWeeklySummaryRule(db, userId);
	if (existing) return existing;

	const prefs = await getOrCreateNotificationPreference(db, userId);
	const template = getNotificationTemplate(WEEKLY_SUMMARY_TEMPLATE_ID);
	if (!template) {
		throw new Error("Weekly summary template missing");
	}

	const channels = fromPrismaChannels(prefs.weeklySummaryChannels);
	const deliveryChannels: NotificationChannel[] =
		channels.length > 0 ? channels : ["email", "in_app"];

	const rule = template.defaultRule;

	// No unique constraint can express "one default weekly summary rule per user",
	// so concurrent bootstraps are serialized on a per-user advisory lock instead.
	return db.$transaction(async (tx) => {
		await tx.$executeRaw`SELECT pg_advisory_xact_lock(hashtext(${`notification-bootstrap:${userId}`})::bigint)`;

		const createdByConcurrentRequest = await findDefaultWeeklySummaryRule(
			tx,
			userId,
		);
		if (createdByConcurrentRequest) return createdByConcurrentRequest;

		return tx.notificationRule.create({
			data: {
				userId,
				name: rule.name,
				plainLanguageSummary: rule.plainLanguageSummary,
				signalType: toPrismaSignal(rule.signalType),
				trigger: rule.trigger as Prisma.InputJsonValue,
				conditions: rule.conditions as Prisma.InputJsonValue,
				schedule: {
					kind: "cron_summary",
					dayOfWeek: prefs.weeklySummaryDayOfWeek,
					minuteOfDay: prefs.weeklySummaryMinuteOfDay,
				} as Prisma.InputJsonValue,
				channels: toPrismaChannels(deliveryChannels),
				urgency: toPrismaUrgency(rule.urgency),
				templateId: WEEKLY_SUMMARY_TEMPLATE_ID,
				source: WEEKLY_SUMMARY_SOURCE,
				isActive: prefs.weeklySummaryEnabled,
				isPaused: !prefs.weeklySummaryEnabled,
			},
		});
	});
}

export async function syncWeeklySummaryRuleFromPrefs(
	db: PrismaClient,
	userId: string,
) {
	const prefs = await getOrCreateNotificationPreference(db, userId);
	const rule = await ensureDefaultWeeklySummaryRule(db, userId);
	const channels = fromPrismaChannels(prefs.weeklySummaryChannels);
	const deliveryChannels: NotificationChannel[] =
		channels.length > 0 ? channels : ["email", "in_app"];

	return db.notificationRule.update({
		where: { id: rule.id },
		data: {
			isActive: prefs.weeklySummaryEnabled,
			isPaused: !prefs.weeklySummaryEnabled,
			channels: toPrismaChannels(deliveryChannels),
			schedule: {
				kind: "cron_summary",
				dayOfWeek: prefs.weeklySummaryDayOfWeek,
				minuteOfDay: prefs.weeklySummaryMinuteOfDay,
			} as Prisma.InputJsonValue,
		},
	});
}

export async function provisionWeeklySummaryRulesForEligibleUsers(
	db: PrismaClient,
) {
	const usersWithAccounts = await db.financialAccount.findMany({
		where: { isActive: true },
		select: { userId: true },
		distinct: ["userId"],
	});

	let provisioned = 0;
	for (const row of usersWithAccounts) {
		await ensureDefaultWeeklySummaryRule(db, row.userId);
		await syncWeeklySummaryRuleFromPrefs(db, row.userId);
		provisioned += 1;
	}
	return { provisioned };
}
