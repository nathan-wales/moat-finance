import {
	evaluateNotificationRule,
	getPreviousCalendarWeekBounds,
	getZonedParts,
	isWithinQuietHours,
	matchesLocalSchedule,
	matchesUtcCronWeekday,
	type NotificationChannel,
	type NotificationRuleInput,
	notificationRuleSchema,
	signalTriggerSchema,
	watchQuerySchema,
} from "@moat/monitoring-rules";
import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { syncExpectedRecurringEventsFromSnapshot } from "./expected-recurring-event.service";
import {
	getOrCreateNotificationPreference,
	provisionWeeklySummaryRulesForEligibleUsers,
} from "./notification-bootstrap.service";
import { recordAndDeliverNotification } from "./notification-delivery.service";
import {
	fromPrismaChannels,
	fromPrismaSignal,
	fromPrismaUrgency,
} from "./notification-mapping";
import { buildFinancialSnapshot } from "./notification-snapshot.service";
import { renderWeeklySummaryEmail } from "./weekly-summary-email";

/** Hobby Vercel plans only allow daily crons; match any time within the local day. */
const DAILY_CRON_SCHEDULE_TOLERANCE_MINUTES = 24 * 60 - 1;

function daysInMonth(year: number, month: number): number {
	return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

function periodLabelForPrefs(
	now: Date,
	timezone: string,
	reportingPeriod: string,
): string {
	if (reportingPeriod === "previous_calendar_week") {
		const bounds = getPreviousCalendarWeekBounds(now, timezone);
		return `${bounds.startLabel} – ${bounds.endLabel}`;
	}
	const bounds = getPreviousCalendarWeekBounds(now, timezone);
	return `${bounds.startLabel} – ${bounds.endLabel}`;
}

function ruleRowToInput(row: {
	id?: string;
	name: string;
	plainLanguageSummary: string | null;
	signalType: Parameters<typeof fromPrismaSignal>[0];
	trigger: unknown;
	conditions: unknown;
	schedule: unknown;
	watchQuery?: unknown;
	channels: Parameters<typeof fromPrismaChannels>[0];
	urgency: Parameters<typeof fromPrismaUrgency>[0];
	templateId: string | null;
	source: string;
	sourceAttribution: string | null;
	isActive: boolean;
}): NotificationRuleInput | null {
	const watchQueryParsed = watchQuerySchema.safeParse(row.watchQuery);
	const watchQuery = watchQueryParsed.success
		? watchQueryParsed.data
		: undefined;
	const triggerParsed = signalTriggerSchema.safeParse(row.trigger);
	const parsed = notificationRuleSchema.safeParse({
		name: row.name,
		plainLanguageSummary: row.plainLanguageSummary ?? undefined,
		signalType: watchQuery ? undefined : fromPrismaSignal(row.signalType),
		trigger: triggerParsed.success ? triggerParsed.data : undefined,
		watchQuery,
		conditions: row.conditions ?? [],
		schedule: row.schedule ?? { kind: "immediate" },
		channels: fromPrismaChannels(row.channels),
		urgency: fromPrismaUrgency(row.urgency),
		templateId: row.templateId ?? undefined,
		source: row.source,
		sourceAttribution: row.sourceAttribution ?? undefined,
		isActive: row.isActive,
	});
	if (!parsed.success) {
		logger.error("notification_rule_parse_failed", {
			feature: "notifications",
			operation: "ruleRowToInput",
			ruleId: row.id,
			error: parsed.error.issues[0]?.message ?? "invalid_rule",
		});
		return null;
	}
	return parsed.data;
}

function matchesDayOfMonthSchedule(
	now: Date,
	timezone: string,
	dayOfMonth: number,
	minuteOfDay: number,
): boolean {
	const zoned = getZonedParts(now, timezone);
	const effectiveDay = Math.min(
		dayOfMonth,
		daysInMonth(zoned.year, zoned.month),
	);
	if (zoned.day !== effectiveDay) return false;
	return matchesLocalSchedule(now, timezone, {
		minuteOfDay,
		toleranceMinutes: DAILY_CRON_SCHEDULE_TOLERANCE_MINUTES,
	});
}

function isScheduledSummaryRule(rule: NotificationRuleInput): boolean {
	return (
		rule.watchQuery?.source.kind === "scheduled_summary" ||
		rule.signalType === "scheduled_summary"
	);
}

export async function previewNotificationRule(
	db: PrismaClient,
	userId: string,
	ruleInput: NotificationRuleInput,
	now: Date = new Date(),
) {
	const prefs = await getOrCreateNotificationPreference(db, userId);
	const snapshot = await buildFinancialSnapshot(
		db,
		userId,
		now,
		prefs.timezone,
	);
	const evaluation = evaluateNotificationRule(
		ruleInput,
		snapshot,
		now,
		prefs.timezone,
	);

	const emailPreview = isScheduledSummaryRule(ruleInput)
		? renderWeeklySummaryEmail({
				snapshot,
				periodLabel: periodLabelForPrefs(
					now,
					prefs.timezone,
					prefs.weeklySummaryReportingPeriod,
				),
				includeAiObservations: prefs.weeklySummaryIncludeAiObservations,
				sections: prefs.weeklySummarySections,
			})
		: undefined;

	return {
		evaluation,
		timezone: prefs.timezone,
		emailPreview,
	};
}

export async function evaluateNotificationRulesForUser(
	db: PrismaClient,
	userId: string,
	now: Date,
	options?: { scheduleOnly?: boolean },
): Promise<{
	evaluated: number;
	matched: number;
	delivered: number;
	suppressed: number;
	deduped: number;
}> {
	const prefs = await getOrCreateNotificationPreference(db, userId);
	const snapshot = await buildFinancialSnapshot(
		db,
		userId,
		now,
		prefs.timezone,
	);
	await syncExpectedRecurringEventsFromSnapshot(db, userId, snapshot);
	const refreshedEvents = await db.expectedRecurringEvent.findMany({
		where: { userId, isActive: true },
		take: 100,
	});
	snapshot.expectedEvents = refreshedEvents.map((row) => ({
		id: row.id,
		label: row.label,
		matchCriteria:
			row.matchCriteria && typeof row.matchCriteria === "object"
				? (row.matchCriteria as {
						merchantContains?: string;
						descriptionContains?: string;
						categoryName?: string;
						hashtag?: string;
						accountIds?: string[];
						amountMin?: number;
						amountMax?: number;
						recurringLabel?: string;
					})
				: {},
		cadence: row.cadence,
		expectedWindowStartDay: row.expectedWindowStartDay,
		expectedWindowEndDay: row.expectedWindowEndDay,
		missingAfterDay: row.missingAfterDay,
		amount: row.amount,
		accountIds: row.accountIds,
		lastMatchedAtIso: row.lastMatchedAt?.toISOString() ?? null,
	}));

	const rules = await db.notificationRule.findMany({
		where: {
			userId,
			isActive: true,
			isPaused: false,
		},
	});

	let evaluated = 0;
	let matched = 0;
	let delivered = 0;
	let suppressed = 0;
	let deduped = 0;

	const user = await db.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});

	const dayStart = new Date(now);
	dayStart.setUTCHours(0, 0, 0, 0);
	const pushDeliveredToday = await db.notificationDelivery.count({
		where: {
			userId,
			createdAt: { gte: dayStart },
			channels: { has: "PUSH" },
			deliveryResult: { in: ["SENT", "SHADOW"] },
		},
	});
	let pushBudgetRemaining = Math.max(
		0,
		prefs.maxPushPerDay - pushDeliveredToday,
	);

	for (const row of rules) {
		const rule = ruleRowToInput(row);
		if (!rule) continue;
		const isSummary = isScheduledSummaryRule(rule);
		if (options?.scheduleOnly && !isSummary) continue;
		if (!options?.scheduleOnly && isSummary) continue;

		if (isSummary) {
			const dayOfWeek = rule.schedule.dayOfWeek ?? prefs.weeklySummaryDayOfWeek;
			if (!matchesUtcCronWeekday(now, dayOfWeek)) {
				continue;
			}
			if (!prefs.weeklySummaryEnabled) continue;
		} else if (
			rule.schedule.kind === "morning_digest" ||
			rule.schedule.kind === "evening_digest" ||
			rule.schedule.kind === "custom_time"
		) {
			const minuteOfDay =
				rule.schedule.kind === "morning_digest"
					? 480
					: rule.schedule.kind === "evening_digest"
						? 1080
						: (rule.schedule.minuteOfDay ?? 480);
			if (
				!matchesLocalSchedule(now, prefs.timezone, {
					minuteOfDay,
					toleranceMinutes: DAILY_CRON_SCHEDULE_TOLERANCE_MINUTES,
					...(rule.schedule.dayOfWeek !== undefined
						? { dayOfWeek: rule.schedule.dayOfWeek }
						: {}),
				})
			) {
				continue;
			}
		} else if (rule.schedule.kind === "monthly_on_day") {
			const dayOfMonth = rule.schedule.dayOfMonth;
			if (dayOfMonth === undefined) continue;
			if (
				!matchesDayOfMonthSchedule(
					now,
					prefs.timezone,
					dayOfMonth,
					rule.schedule.minuteOfDay ?? 480,
				)
			) {
				continue;
			}
		} else if (rule.schedule.kind === "month_window_end") {
			const endDay =
				rule.watchQuery?.window.kind === "day_of_month_range"
					? rule.watchQuery.window.endDay
					: rule.schedule.dayOfMonth;
			if (endDay === undefined) continue;
			if (
				!matchesDayOfMonthSchedule(
					now,
					prefs.timezone,
					endDay,
					rule.schedule.minuteOfDay ?? 480,
				)
			) {
				continue;
			}
		}

		evaluated += 1;
		let evaluation: ReturnType<typeof evaluateNotificationRule>;
		try {
			evaluation = evaluateNotificationRule(
				rule,
				snapshot,
				now,
				prefs.timezone,
			);
		} catch (error) {
			logger.error("notification_rule_evaluate_failed", {
				userId,
				demoUser: false,
				feature: "notifications",
				operation: "evaluateNotificationRule",
				ruleId: row.id,
				error: error instanceof Error ? error.message : "unknown",
			});
			continue;
		}

		if (!evaluation.fired) {
			if (row.lastFiredStateHash) {
				await db.notificationRule.update({
					where: { id: row.id },
					data: {
						lastEvaluatedAt: now,
						lastFiredStateHash: null,
					},
				});
			} else {
				await db.notificationRule.update({
					where: { id: row.id },
					data: { lastEvaluatedAt: now },
				});
			}
			continue;
		}

		await db.notificationRule.update({
			where: { id: row.id },
			data: { lastEvaluatedAt: now },
		});

		matched += 1;

		if (
			evaluation.stateHash &&
			row.lastFiredStateHash &&
			evaluation.stateHash === row.lastFiredStateHash
		) {
			suppressed += 1;
			logger.info("notification_delivery_suppressed", {
				userId,
				demoUser: false,
				feature: "notifications",
				operation: "same_state_hash",
			});
			continue;
		}

		const priorResolutions = await db.notificationDelivery.findMany({
			where: {
				userId,
				ruleId: row.id,
				resolutionStatus: { in: ["MUTED", "SNOOZED"] },
			},
			select: {
				resolutionStatus: true,
				snoozedUntil: true,
			},
			take: 20,
			orderBy: { createdAt: "desc" },
		});
		const muted = priorResolutions.some(
			(item) => item.resolutionStatus === "MUTED",
		);
		const snoozed = priorResolutions.some(
			(item) =>
				item.resolutionStatus === "SNOOZED" &&
				item.snoozedUntil !== null &&
				item.snoozedUntil > now,
		);
		if (muted || snoozed) {
			suppressed += 1;
			logger.info("notification_delivery_suppressed", {
				userId,
				demoUser: false,
				feature: "notifications",
				operation: muted ? "muted" : "snoozed",
			});
			continue;
		}

		if (
			prefs.quietHoursEnabled &&
			rule.urgency !== "critical" &&
			isWithinQuietHours(
				now,
				prefs.timezone,
				prefs.quietHoursStartMinute,
				prefs.quietHoursEndMinute,
			)
		) {
			suppressed += 1;
			logger.info("notification_delivery_suppressed", {
				userId,
				demoUser: false,
				feature: "notifications",
				operation: "quiet_hours",
			});
			continue;
		}

		const prefWeeklyChannels = fromPrismaChannels(prefs.weeklySummaryChannels);
		let channels: NotificationChannel[] =
			isSummary && prefWeeklyChannels.length > 0
				? prefWeeklyChannels
				: rule.channels;
		if (channels.includes("push") && pushBudgetRemaining <= 0) {
			channels = channels.filter((channel) => channel !== "push");
			if (channels.length === 0) {
				suppressed += 1;
				logger.info("notification_delivery_suppressed", {
					userId,
					demoUser: false,
					feature: "notifications",
					operation: "max_push_per_day",
				});
				continue;
			}
		}

		const summaryHtml = isSummary
			? renderWeeklySummaryEmail({
					snapshot,
					periodLabel: periodLabelForPrefs(
						now,
						prefs.timezone,
						prefs.weeklySummaryReportingPeriod,
					),
					includeAiObservations: prefs.weeklySummaryIncludeAiObservations,
					sections: prefs.weeklySummarySections,
				})
			: undefined;

		const attempt = await recordAndDeliverNotification(db, {
			userId,
			ruleId: row.id,
			channels,
			evaluation,
			isWeeklySummary: isSummary,
			summaryHtml,
			email: user?.email,
		});

		if (attempt.deduped || attempt.result === "DEDUPED") {
			deduped += 1;
			continue;
		}
		if (attempt.result === "SUPPRESSED") {
			suppressed += 1;
			continue;
		}

		if (channels.includes("push")) {
			pushBudgetRemaining = Math.max(0, pushBudgetRemaining - 1);
		}

		delivered += 1;
		await db.notificationRule.update({
			where: { id: row.id },
			data: {
				lastFiredAt: now,
				lastFiredStateHash: evaluation.stateHash,
				fireCount: { increment: 1 },
			},
		});
	}

	return { evaluated, matched, delivered, suppressed, deduped };
}

export async function runNotificationRuleEvaluationSweep(
	db: PrismaClient,
	now: Date = new Date(),
) {
	const users = await db.notificationRule.findMany({
		where: { isActive: true, isPaused: false },
		select: { userId: true },
		distinct: ["userId"],
	});

	let evaluated = 0;
	let matched = 0;
	let delivered = 0;
	let suppressed = 0;
	let deduped = 0;

	for (const { userId } of users) {
		const result = await evaluateNotificationRulesForUser(db, userId, now, {
			scheduleOnly: false,
		});
		evaluated += result.evaluated;
		matched += result.matched;
		delivered += result.delivered;
		suppressed += result.suppressed;
		deduped += result.deduped;
	}

	logger.info("notification_rule_evaluation_sweep", {
		feature: "notifications",
		operation: "evaluate-notification-rules",
		userCount: users.length,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	});

	return {
		userCount: users.length,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	};
}

export async function runNotificationScheduleSweep(
	db: PrismaClient,
	now: Date = new Date(),
) {
	const provisioned = await provisionWeeklySummaryRulesForEligibleUsers(db);

	const prefs = await db.notificationPreference.findMany({
		where: { weeklySummaryEnabled: true },
		select: { userId: true },
	});
	const summaryRuleUsers = await db.notificationRule.findMany({
		where: {
			signalType: "SCHEDULED_SUMMARY",
			isActive: true,
			isPaused: false,
		},
		select: { userId: true },
		distinct: ["userId"],
	});

	const userIds = new Set([
		...prefs.map((row) => row.userId),
		...summaryRuleUsers.map((row) => row.userId),
	]);

	let evaluated = 0;
	let matched = 0;
	let delivered = 0;
	let suppressed = 0;
	let deduped = 0;

	for (const userId of userIds) {
		const result = await evaluateNotificationRulesForUser(db, userId, now, {
			scheduleOnly: true,
		});
		evaluated += result.evaluated;
		matched += result.matched;
		delivered += result.delivered;
		suppressed += result.suppressed;
		deduped += result.deduped;
	}

	logger.info("notification_schedule_sweep", {
		feature: "notifications",
		operation: "evaluate-notification-schedules",
		userCount: userIds.size,
		provisioned: provisioned.provisioned,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	});

	return {
		userCount: userIds.size,
		provisioned: provisioned.provisioned,
		evaluated,
		matched,
		delivered,
		suppressed,
		deduped,
	};
}
