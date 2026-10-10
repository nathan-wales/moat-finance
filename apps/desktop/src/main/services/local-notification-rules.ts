import { randomUUID } from "node:crypto";
import type { NotificationPreference, NotificationRule } from "@moat/contracts";
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	getNotificationTemplate,
	notificationRuleSchema,
} from "@moat/monitoring-rules";

type RuleRow = {
	id: string;
	userId: string;
	name: string;
	plainLanguageSummary: string | null;
	signalType: string;
	triggerJson: string;
	conditionsJson: string;
	scheduleJson: string;
	watchQueryJson: string | null;
	channelsJson: string;
	urgency: string;
	isActive: number;
	isPaused: number;
	templateId: string | null;
	source: string;
	sourceAttribution: string | null;
	lastEvaluatedAt: string | null;
	lastFiredAt: string | null;
	fireCount: number;
	createdAt: string;
	updatedAt: string;
};

type PrefRow = {
	userId: string;
	timezone: string;
	pushPrivacyLevel: string;
	quietHoursEnabled: number;
	quietHoursStartMinute: number;
	quietHoursEndMinute: number;
	maxPushPerDay: number;
	weeklySummaryEnabled: number;
	weeklySummaryDayOfWeek: number;
	weeklySummaryMinuteOfDay: number;
	weeklySummaryChannelsJson: string;
	emailEnabled: number;
	pushEnabled: number;
	inAppEnabled: number;
	onboardingSummaryAcknowledgedAt: string | null;
};

const LOCAL_USER = "local-user";

function parseJson<T>(value: string, fallback: T): T {
	try {
		return JSON.parse(value) as T;
	} catch {
		return fallback;
	}
}

function formatRule(row: RuleRow): NotificationRule {
	return {
		id: row.id,
		name: row.name,
		plainLanguageSummary: row.plainLanguageSummary,
		signalType: row.signalType as NotificationRule["signalType"],
		trigger: parseJson(row.triggerJson, {}),
		conditions: parseJson(row.conditionsJson, []),
		schedule: parseJson(row.scheduleJson, { kind: "immediate" }),
		watchQuery: row.watchQueryJson ? parseJson(row.watchQueryJson, null) : null,
		channels: parseJson(row.channelsJson, ["in_app"]),
		urgency: row.urgency as NotificationRule["urgency"],
		isActive: row.isActive === 1,
		isPaused: row.isPaused === 1,
		templateId: row.templateId,
		source: row.source,
		sourceAttribution: row.sourceAttribution,
		lastEvaluatedAt: row.lastEvaluatedAt,
		lastFiredAt: row.lastFiredAt,
		fireCount: row.fireCount,
		createdAt: new Date(row.createdAt).toISOString(),
		updatedAt: new Date(row.updatedAt).toISOString(),
	};
}

function formatPrefs(row: PrefRow): NotificationPreference {
	return {
		timezone: row.timezone,
		pushPrivacyLevel:
			row.pushPrivacyLevel as NotificationPreference["pushPrivacyLevel"],
		quietHoursEnabled: row.quietHoursEnabled === 1,
		quietHoursStartMinute: row.quietHoursStartMinute,
		quietHoursEndMinute: row.quietHoursEndMinute,
		maxPushPerDay: row.maxPushPerDay,
		weeklySummaryEnabled: row.weeklySummaryEnabled === 1,
		weeklySummaryDayOfWeek: row.weeklySummaryDayOfWeek,
		weeklySummaryMinuteOfDay: row.weeklySummaryMinuteOfDay,
		weeklySummaryChannels: parseJson(row.weeklySummaryChannelsJson, [
			"in_app",
		]) as NotificationPreference["weeklySummaryChannels"],
		weeklySummaryReportingPeriod: "previous_calendar_week",
		weeklySummaryIncludeAiObservations: true,
		weeklySummaryAccountIds: [],
		weeklySummarySections: [],
		emailEnabled: row.emailEnabled === 1,
		pushEnabled: row.pushEnabled === 1,
		inAppEnabled: row.inAppEnabled === 1,
		onboardingSummaryAcknowledgedAt: row.onboardingSummaryAcknowledgedAt,
	};
}

async function ensurePrefs(db: SqliteDbClient): Promise<PrefRow> {
	const existing = await db.$queryRaw<PrefRow[]>`
		SELECT * FROM "NotificationPreference" WHERE "userId" = ${LOCAL_USER} LIMIT 1
	`;
	if (existing[0]) return existing[0];

	await db.$executeRaw`
		INSERT INTO "NotificationPreference" ("userId")
		VALUES (${LOCAL_USER})
	`;
	const created = await db.$queryRaw<PrefRow[]>`
		SELECT * FROM "NotificationPreference" WHERE "userId" = ${LOCAL_USER} LIMIT 1
	`;
	const row = created[0];
	if (!row) throw new Error("Failed to create notification preferences");
	return row;
}

async function ensureWeeklySummary(db: SqliteDbClient): Promise<void> {
	const existing = await db.$queryRaw<{ id: string }[]>`
		SELECT "id" FROM "NotificationRule"
		WHERE "userId" = ${LOCAL_USER}
			AND "source" = 'default_weekly_summary'
		LIMIT 1
	`;
	if (existing[0]) return;

	const prefs = await ensurePrefs(db);
	const template = getNotificationTemplate("weekly_or_monthly_summary");
	if (!template) return;

	const rule = template.defaultRule;
	const id = randomUUID();
	const now = new Date().toISOString();
	await db.$executeRaw`
		INSERT INTO "NotificationRule" (
			"id", "userId", "name", "plainLanguageSummary", "signalType",
			"triggerJson", "conditionsJson", "scheduleJson", "channelsJson",
			"urgency", "isActive", "isPaused", "templateId", "source",
			"createdAt", "updatedAt"
		) VALUES (
			${id},
			${LOCAL_USER},
			${rule.name},
			${rule.plainLanguageSummary ?? null},
			${rule.signalType},
			${JSON.stringify(rule.trigger)},
			${JSON.stringify(rule.conditions)},
			${JSON.stringify({
				kind: "cron_summary",
				dayOfWeek: prefs.weeklySummaryDayOfWeek,
				minuteOfDay: prefs.weeklySummaryMinuteOfDay,
			})},
			${prefs.weeklySummaryChannelsJson},
			${rule.urgency},
			${prefs.weeklySummaryEnabled},
			${prefs.weeklySummaryEnabled === 1 ? 0 : 1},
			${"weekly_or_monthly_summary"},
			${"default_weekly_summary"},
			${now},
			${now}
		)
	`;
}

export async function listLocalNotificationRules(
	db: SqliteDbClient,
): Promise<NotificationRule[]> {
	await ensureWeeklySummary(db);
	const rows = await db.$queryRaw<RuleRow[]>`
		SELECT * FROM "NotificationRule"
		WHERE "userId" = ${LOCAL_USER}
		ORDER BY "createdAt" DESC
	`;
	return rows.map(formatRule);
}

export async function getLocalNotificationRule(
	db: SqliteDbClient,
	id: string,
): Promise<NotificationRule | null> {
	const rows = await db.$queryRaw<RuleRow[]>`
		SELECT * FROM "NotificationRule"
		WHERE "userId" = ${LOCAL_USER} AND "id" = ${id}
		LIMIT 1
	`;
	return rows[0] ? formatRule(rows[0]) : null;
}

export async function createLocalNotificationRule(
	db: SqliteDbClient,
	input: {
		name: string;
		plainLanguageSummary?: string | null;
		signalType?: string;
		trigger?: Record<string, unknown>;
		conditions: Array<Record<string, unknown>>;
		schedule: Record<string, unknown>;
		watchQuery?: Record<string, unknown> | null;
		channels: string[];
		urgency: string;
		templateId?: string | null;
		source?: string;
		sourceAttribution?: string | null;
		isActive?: boolean;
	},
): Promise<NotificationRule> {
	const id = randomUUID();
	const now = new Date().toISOString();
	const normalized = notificationRuleSchema.parse({
		name: input.name,
		plainLanguageSummary: input.plainLanguageSummary ?? undefined,
		signalType: input.signalType,
		trigger: input.trigger,
		watchQuery: input.watchQuery ?? undefined,
		conditions: input.conditions,
		schedule: input.schedule,
		channels: input.channels,
		urgency: input.urgency,
		templateId: input.templateId ?? undefined,
		source: input.source ?? "manual",
		sourceAttribution: input.sourceAttribution ?? undefined,
		isActive: input.isActive !== false,
	});
	await db.$executeRaw`
		INSERT INTO "NotificationRule" (
			"id", "userId", "name", "plainLanguageSummary", "signalType",
			"triggerJson", "conditionsJson", "scheduleJson", "watchQueryJson",
			"channelsJson", "urgency", "isActive", "isPaused", "templateId",
			"source", "sourceAttribution", "createdAt", "updatedAt"
		) VALUES (
			${id},
			${LOCAL_USER},
			${normalized.name},
			${normalized.plainLanguageSummary ?? null},
			${normalized.signalType},
			${JSON.stringify(normalized.trigger)},
			${JSON.stringify(normalized.conditions)},
			${JSON.stringify(normalized.schedule)},
			${normalized.watchQuery ? JSON.stringify(normalized.watchQuery) : null},
			${JSON.stringify(normalized.channels)},
			${normalized.urgency},
			${normalized.isActive ? 1 : 0},
			${0},
			${normalized.templateId ?? null},
			${normalized.source},
			${normalized.sourceAttribution ?? null},
			${now},
			${now}
		)
	`;
	const created = await getLocalNotificationRule(db, id);
	if (!created) throw new Error("Failed to create notification rule");
	return created;
}

export async function updateLocalNotificationRule(
	db: SqliteDbClient,
	input: {
		id: string;
		name?: string;
		plainLanguageSummary?: string | null;
		signalType?: string;
		trigger?: Record<string, unknown>;
		conditions?: Array<Record<string, unknown>>;
		schedule?: Record<string, unknown>;
		watchQuery?: Record<string, unknown> | null;
		channels?: string[];
		urgency?: string;
		templateId?: string | null;
		source?: string;
		sourceAttribution?: string | null;
		isActive?: boolean;
	},
): Promise<NotificationRule> {
	const existing = await getLocalNotificationRule(db, input.id);
	if (!existing) throw new Error("Notification rule not found");

	const normalized = notificationRuleSchema.parse({
		name: input.name ?? existing.name,
		plainLanguageSummary:
			input.plainLanguageSummary ?? existing.plainLanguageSummary ?? undefined,
		signalType:
			input.watchQuery !== undefined || existing.watchQuery
				? undefined
				: (input.signalType ?? existing.signalType),
		trigger: input.trigger ?? existing.trigger,
		watchQuery:
			input.watchQuery !== undefined
				? (input.watchQuery ?? undefined)
				: (existing.watchQuery ?? undefined),
		conditions: input.conditions ?? existing.conditions,
		schedule: input.schedule ?? existing.schedule,
		channels: input.channels ?? existing.channels,
		urgency: input.urgency ?? existing.urgency,
		templateId: input.templateId ?? existing.templateId ?? undefined,
		source: input.source ?? existing.source,
		sourceAttribution:
			input.sourceAttribution ?? existing.sourceAttribution ?? undefined,
		isActive: input.isActive ?? existing.isActive,
	});
	const now = new Date().toISOString();
	await db.$executeRaw`
		UPDATE "NotificationRule"
		SET
			"name" = ${normalized.name},
			"plainLanguageSummary" = ${normalized.plainLanguageSummary ?? null},
			"signalType" = ${normalized.signalType},
			"triggerJson" = ${JSON.stringify(normalized.trigger)},
			"conditionsJson" = ${JSON.stringify(normalized.conditions)},
			"scheduleJson" = ${JSON.stringify(normalized.schedule)},
			"watchQueryJson" = ${
				normalized.watchQuery ? JSON.stringify(normalized.watchQuery) : null
			},
			"channelsJson" = ${JSON.stringify(normalized.channels)},
			"urgency" = ${normalized.urgency},
			"templateId" = ${normalized.templateId ?? null},
			"source" = ${normalized.source},
			"sourceAttribution" = ${normalized.sourceAttribution ?? null},
			"isActive" = ${normalized.isActive ? 1 : 0},
			"updatedAt" = ${now}
		WHERE "id" = ${input.id} AND "userId" = ${LOCAL_USER}
	`;
	const updated = await getLocalNotificationRule(db, input.id);
	if (!updated) throw new Error("Notification rule not found");
	return updated;
}

export async function pauseLocalNotificationRule(
	db: SqliteDbClient,
	id: string,
	paused: boolean,
): Promise<NotificationRule> {
	const existing = await getLocalNotificationRule(db, id);
	if (!existing) throw new Error("Notification rule not found");
	const now = new Date().toISOString();
	await db.$executeRaw`
		UPDATE "NotificationRule"
		SET
			"isPaused" = ${paused ? 1 : 0},
			"isActive" = ${paused ? 0 : 1},
			"updatedAt" = ${now}
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
	`;

	if (existing.source === "default_weekly_summary") {
		await db.$executeRaw`
			UPDATE "NotificationPreference"
			SET
				"weeklySummaryEnabled" = ${paused ? 0 : 1},
				"updatedAt" = ${now}
			WHERE "userId" = ${LOCAL_USER}
		`;
	}

	const updated = await getLocalNotificationRule(db, id);
	if (!updated) throw new Error("Notification rule not found");
	return updated;
}

export async function deleteLocalNotificationRule(
	db: SqliteDbClient,
	id: string,
): Promise<void> {
	await db.$executeRaw`
		DELETE FROM "NotificationRule"
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
	`;
}

export async function getLocalNotificationPreferences(
	db: SqliteDbClient,
): Promise<NotificationPreference> {
	const prefs = await ensurePrefs(db);
	return formatPrefs(prefs);
}

export async function updateLocalNotificationPreferences(
	db: SqliteDbClient,
	input: Partial<NotificationPreference> & {
		acknowledgeWeeklySummaryOnboarding?: boolean;
	},
): Promise<NotificationPreference> {
	const current = await ensurePrefs(db);
	const next = formatPrefs(current);
	const merged: NotificationPreference = {
		...next,
		timezone: input.timezone ?? next.timezone,
		pushPrivacyLevel: input.pushPrivacyLevel ?? next.pushPrivacyLevel,
		quietHoursEnabled: input.quietHoursEnabled ?? next.quietHoursEnabled,
		quietHoursStartMinute:
			input.quietHoursStartMinute ?? next.quietHoursStartMinute,
		quietHoursEndMinute: input.quietHoursEndMinute ?? next.quietHoursEndMinute,
		maxPushPerDay: input.maxPushPerDay ?? next.maxPushPerDay,
		weeklySummaryEnabled:
			input.weeklySummaryEnabled ?? next.weeklySummaryEnabled,
		weeklySummaryDayOfWeek:
			input.weeklySummaryDayOfWeek ?? next.weeklySummaryDayOfWeek,
		weeklySummaryMinuteOfDay:
			input.weeklySummaryMinuteOfDay ?? next.weeklySummaryMinuteOfDay,
		weeklySummaryChannels:
			input.weeklySummaryChannels ?? next.weeklySummaryChannels,
		emailEnabled: input.emailEnabled ?? next.emailEnabled,
		pushEnabled: input.pushEnabled ?? next.pushEnabled,
		inAppEnabled: input.inAppEnabled ?? next.inAppEnabled,
		onboardingSummaryAcknowledgedAt: input.acknowledgeWeeklySummaryOnboarding
			? new Date().toISOString()
			: next.onboardingSummaryAcknowledgedAt,
	};

	const now = new Date().toISOString();
	await db.$executeRaw`
		UPDATE "NotificationPreference"
		SET
			"timezone" = ${merged.timezone},
			"pushPrivacyLevel" = ${merged.pushPrivacyLevel},
			"quietHoursEnabled" = ${merged.quietHoursEnabled ? 1 : 0},
			"quietHoursStartMinute" = ${merged.quietHoursStartMinute},
			"quietHoursEndMinute" = ${merged.quietHoursEndMinute},
			"maxPushPerDay" = ${merged.maxPushPerDay},
			"weeklySummaryEnabled" = ${merged.weeklySummaryEnabled ? 1 : 0},
			"weeklySummaryDayOfWeek" = ${merged.weeklySummaryDayOfWeek},
			"weeklySummaryMinuteOfDay" = ${merged.weeklySummaryMinuteOfDay},
			"weeklySummaryChannelsJson" = ${JSON.stringify(merged.weeklySummaryChannels)},
			"emailEnabled" = ${merged.emailEnabled ? 1 : 0},
			"pushEnabled" = ${merged.pushEnabled ? 1 : 0},
			"inAppEnabled" = ${merged.inAppEnabled ? 1 : 0},
			"onboardingSummaryAcknowledgedAt" = ${merged.onboardingSummaryAcknowledgedAt},
			"updatedAt" = ${now}
		WHERE "userId" = ${LOCAL_USER}
	`;

	await ensureWeeklySummary(db);
	await db.$executeRaw`
		UPDATE "NotificationRule"
		SET
			"isActive" = ${merged.weeklySummaryEnabled ? 1 : 0},
			"isPaused" = ${merged.weeklySummaryEnabled ? 0 : 1},
			"channelsJson" = ${JSON.stringify(merged.weeklySummaryChannels)},
			"scheduleJson" = ${JSON.stringify({
				kind: "cron_summary",
				dayOfWeek: merged.weeklySummaryDayOfWeek,
				minuteOfDay: merged.weeklySummaryMinuteOfDay,
			})},
			"updatedAt" = ${now}
		WHERE "userId" = ${LOCAL_USER}
			AND "source" = 'default_weekly_summary'
	`;

	return merged;
}

export async function listLocalNotificationInbox(db: SqliteDbClient) {
	const rows = await db.$queryRaw<
		Array<{
			id: string;
			ruleId: string | null;
			title: string;
			body: string;
			channelsJson: string;
			deliveryResult: string;
			explanationJson: string;
			readAt: string | null;
			resolutionStatus: string;
			isWeeklySummary: number;
			createdAt: string;
		}>
	>`
		SELECT * FROM "NotificationDelivery"
		WHERE "userId" = ${LOCAL_USER}
		ORDER BY "createdAt" DESC
		LIMIT 50
	`;

	return rows.map((row) => ({
		id: row.id,
		ruleId: row.ruleId,
		title: row.title,
		body: row.body,
		channels: parseJson(row.channelsJson, ["in_app"]),
		deliveryResult: row.deliveryResult,
		explanation: parseJson(row.explanationJson, {
			signalType: "scheduled_summary",
			summary: "",
			facts: [],
		}),
		linkedData: null,
		readAt: row.readAt,
		resolutionStatus: row.resolutionStatus,
		isWeeklySummary: row.isWeeklySummary === 1,
		createdAt: new Date(row.createdAt).toISOString(),
	}));
}

export async function markLocalNotificationRead(
	db: SqliteDbClient,
	id: string,
): Promise<void> {
	const now = new Date().toISOString();
	await db.$executeRaw`
		UPDATE "NotificationDelivery"
		SET "readAt" = ${now}
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
	`;
}

export async function resolveLocalNotification(
	db: SqliteDbClient,
	id: string,
	status: "RESOLVED" | "SNOOZED" | "MUTED",
): Promise<void> {
	const existing = await db.$queryRaw<Array<{ id: string }>>`
		SELECT "id" FROM "NotificationDelivery"
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
		LIMIT 1
	`;
	if (!existing[0]) throw new Error("Notification not found");
	await db.$executeRaw`
		UPDATE "NotificationDelivery"
		SET "resolutionStatus" = ${status}
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
	`;
}

export async function listLocalNotificationSuggestions(db: SqliteDbClient) {
	const existing = await db.$queryRaw<
		Array<{
			id: string;
			suggestionKey: string;
			title: string;
			description: string;
			templateId: string;
			prefillJson: string;
			dismissedAt: string | null;
			createdAt: string;
		}>
	>`
		SELECT * FROM "NotificationSuggestion"
		WHERE "userId" = ${LOCAL_USER} AND "dismissedAt" IS NULL
		ORDER BY "createdAt" DESC
	`;
	if (existing.length > 0) {
		return existing.map((row) => ({
			id: row.id,
			suggestionKey: row.suggestionKey,
			title: row.title,
			description: row.description,
			templateId: row.templateId,
			prefill: parseJson(row.prefillJson, {}),
			createdAt: new Date(row.createdAt).toISOString(),
		}));
	}

	const candidates = [
		{
			suggestionKey: "missing_payment:rent",
			templateId: "missing_expected_payment",
			title: "Your rent is reliably detectable. Monitor for a missing payment?",
			description:
				"Create an alert if an expected rent payment does not appear by its usual window.",
		},
		{
			suggestionKey: "low_balance:checking",
			templateId: "low_account_balance",
			title: "Your checking balance varies. Add a low-balance threshold?",
			description: "Get notified when checking drops below a level you choose.",
		},
		{
			suggestionKey: "upcoming_bill:recurring",
			templateId: "upcoming_bill",
			title: "Want a reminder before recurring bills are due?",
			description: "Get notified a few days before an upcoming recurring bill.",
		},
	] as const;

	const created = [];
	for (const candidate of candidates) {
		const template = getNotificationTemplate(candidate.templateId);
		if (!template) continue;
		const id = randomUUID();
		const now = new Date().toISOString();
		const prefillJson = JSON.stringify({
			...template.defaultRule,
			source: "suggestion",
		});
		await db.$executeRaw`
			INSERT INTO "NotificationSuggestion" (
				"id", "userId", "suggestionKey", "title", "description",
				"templateId", "prefillJson", "createdAt"
			) VALUES (
				${id}, ${LOCAL_USER}, ${candidate.suggestionKey}, ${candidate.title},
				${candidate.description}, ${candidate.templateId}, ${prefillJson}, ${now}
			)
			ON CONFLICT("userId", "suggestionKey") DO NOTHING
		`;
	}

	const rows = await db.$queryRaw<
		Array<{
			id: string;
			suggestionKey: string;
			title: string;
			description: string;
			templateId: string;
			prefillJson: string;
			createdAt: string;
		}>
	>`
		SELECT * FROM "NotificationSuggestion"
		WHERE "userId" = ${LOCAL_USER} AND "dismissedAt" IS NULL
		ORDER BY "createdAt" DESC
		LIMIT 5
	`;

	for (const row of rows) {
		created.push({
			id: row.id,
			suggestionKey: row.suggestionKey,
			title: row.title,
			description: row.description,
			templateId: row.templateId,
			prefill: parseJson(row.prefillJson, {}),
			createdAt: new Date(row.createdAt).toISOString(),
		});
	}
	return created;
}

export async function dismissLocalNotificationSuggestion(
	db: SqliteDbClient,
	id: string,
): Promise<void> {
	const now = new Date().toISOString();
	await db.$executeRaw`
		UPDATE "NotificationSuggestion"
		SET "dismissedAt" = ${now}
		WHERE "id" = ${id} AND "userId" = ${LOCAL_USER}
	`;
}
