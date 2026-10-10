import {
	type NotificationRuleInput,
	notificationRuleSchema,
	signalTriggerSchema,
	type UpdateNotificationRuleInput,
	type WatchQuery,
	watchQuerySchema,
} from "@moat/monitoring-rules";
import { logger } from "~/lib/logger";
import { Prisma, type PrismaClient } from "../../../generated/prisma";
import { ensureDefaultWeeklySummaryRule } from "./notification-bootstrap.service";
import {
	fromPrismaChannels,
	fromPrismaSignal,
	fromPrismaUrgency,
	toPrismaChannels,
	toPrismaSignal,
	toPrismaUrgency,
} from "./notification-mapping";

export type NotificationRuleView = {
	id: string;
	name: string;
	plainLanguageSummary: string | null;
	signalType: ReturnType<typeof fromPrismaSignal>;
	trigger: NotificationRuleInput["trigger"];
	conditions: NotificationRuleInput["conditions"];
	schedule: NotificationRuleInput["schedule"];
	watchQuery: WatchQuery | null;
	channels: ReturnType<typeof fromPrismaChannels>;
	urgency: ReturnType<typeof fromPrismaUrgency>;
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

function parseStoredWatchQuery(value: unknown): WatchQuery | undefined {
	if (value === null || value === undefined) return undefined;
	const parsed = watchQuerySchema.safeParse(value);
	return parsed.success ? parsed.data : undefined;
}

function formatRule(row: {
	id: string;
	name: string;
	plainLanguageSummary: string | null;
	signalType: Parameters<typeof fromPrismaSignal>[0];
	trigger: unknown;
	conditions: unknown;
	schedule: unknown;
	watchQuery?: unknown;
	channels: Parameters<typeof fromPrismaChannels>[0];
	urgency: Parameters<typeof fromPrismaUrgency>[0];
	isActive: boolean;
	isPaused: boolean;
	templateId: string | null;
	source: string;
	sourceAttribution: string | null;
	lastEvaluatedAt: Date | null;
	lastFiredAt: Date | null;
	fireCount: number;
	createdAt: Date;
	updatedAt: Date;
}): NotificationRuleView {
	const watchQuery = parseStoredWatchQuery(row.watchQuery);
	const triggerParsed = signalTriggerSchema.safeParse(row.trigger);
	const parsed = notificationRuleSchema.parse({
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

	return {
		id: row.id,
		name: parsed.name,
		plainLanguageSummary: parsed.plainLanguageSummary ?? null,
		signalType: parsed.signalType,
		trigger: parsed.trigger,
		conditions: parsed.conditions,
		schedule: parsed.schedule,
		watchQuery: parsed.watchQuery ?? null,
		channels: parsed.channels,
		urgency: parsed.urgency,
		isActive: row.isActive,
		isPaused: row.isPaused,
		templateId: row.templateId,
		source: row.source,
		sourceAttribution: row.sourceAttribution,
		lastEvaluatedAt: row.lastEvaluatedAt?.toISOString() ?? null,
		lastFiredAt: row.lastFiredAt?.toISOString() ?? null,
		fireCount: row.fireCount,
		createdAt: row.createdAt.toISOString(),
		updatedAt: row.updatedAt.toISOString(),
	};
}

function tryFormatRule(
	row: Parameters<typeof formatRule>[0],
): NotificationRuleView | null {
	try {
		return formatRule(row);
	} catch (error) {
		logger.error("notification_rule_format_failed", {
			feature: "notifications",
			operation: "formatRule",
			ruleId: row.id,
			error: error instanceof Error ? error.message : "unknown",
		});
		return null;
	}
}

export async function listNotificationRules(
	db: PrismaClient,
	userId: string,
): Promise<NotificationRuleView[]> {
	await ensureDefaultWeeklySummaryRule(db, userId);
	const rows = await db.notificationRule.findMany({
		where: { userId },
		orderBy: [{ source: "asc" }, { createdAt: "desc" }],
	});
	return rows
		.map((row) => tryFormatRule(row))
		.filter((rule): rule is NotificationRuleView => rule !== null);
}

export async function getNotificationRuleById(
	db: PrismaClient,
	userId: string,
	id: string,
): Promise<NotificationRuleView | null> {
	const row = await db.notificationRule.findFirst({
		where: { id, userId },
	});
	return row ? tryFormatRule(row) : null;
}

export async function createNotificationRule(
	db: PrismaClient,
	args: {
		userId: string;
		input: unknown;
		sourceAttribution?: string;
	},
): Promise<NotificationRuleView> {
	const input = notificationRuleSchema.parse(args.input);
	const row = await db.notificationRule.create({
		data: {
			userId: args.userId,
			name: input.name,
			plainLanguageSummary: input.plainLanguageSummary,
			signalType: toPrismaSignal(input.signalType),
			trigger: input.trigger as Prisma.InputJsonValue,
			conditions: input.conditions as Prisma.InputJsonValue,
			schedule: input.schedule as Prisma.InputJsonValue,
			watchQuery:
				input.watchQuery === undefined
					? undefined
					: (input.watchQuery as Prisma.InputJsonValue),
			channels: toPrismaChannels(input.channels),
			urgency: toPrismaUrgency(input.urgency),
			templateId: input.templateId,
			source: input.source,
			sourceAttribution: args.sourceAttribution ?? input.sourceAttribution,
			isActive: input.isActive,
		},
	});
	return formatRule(row);
}

export async function updateNotificationRule(
	db: PrismaClient,
	userId: string,
	input: UpdateNotificationRuleInput,
): Promise<NotificationRuleView> {
	const existing = await db.notificationRule.findFirst({
		where: { id: input.id, userId },
	});
	if (!existing) {
		throw new Error("Notification rule not found");
	}

	const existingWatchQuery = parseStoredWatchQuery(existing.watchQuery);
	const watchQueryForMerge =
		input.watchQuery !== undefined ? input.watchQuery : existingWatchQuery;

	const merged = notificationRuleSchema.parse({
		name: input.name ?? existing.name,
		plainLanguageSummary:
			input.plainLanguageSummary ?? existing.plainLanguageSummary ?? undefined,
		signalType:
			watchQueryForMerge !== undefined
				? undefined
				: (input.signalType ?? fromPrismaSignal(existing.signalType)),
		trigger: input.trigger ?? existing.trigger,
		watchQuery: watchQueryForMerge,
		conditions: input.conditions ?? existing.conditions ?? [],
		schedule: input.schedule ?? existing.schedule ?? { kind: "immediate" },
		channels: input.channels ?? fromPrismaChannels(existing.channels),
		urgency: input.urgency ?? fromPrismaUrgency(existing.urgency),
		templateId: input.templateId ?? existing.templateId ?? undefined,
		source: input.source ?? existing.source,
		sourceAttribution:
			input.sourceAttribution ?? existing.sourceAttribution ?? undefined,
		isActive: input.isActive ?? existing.isActive,
	});

	const data: Prisma.NotificationRuleUpdateInput = {
		name: merged.name,
		plainLanguageSummary: merged.plainLanguageSummary,
		signalType: toPrismaSignal(merged.signalType),
		trigger: merged.trigger as Prisma.InputJsonValue,
		conditions: merged.conditions as Prisma.InputJsonValue,
		schedule: merged.schedule as Prisma.InputJsonValue,
		channels: toPrismaChannels(merged.channels),
		urgency: toPrismaUrgency(merged.urgency),
		templateId: merged.templateId,
		source: merged.source,
		sourceAttribution: merged.sourceAttribution,
		isActive: merged.isActive,
	};

	if (input.watchQuery !== undefined) {
		data.watchQuery = merged.watchQuery
			? (merged.watchQuery as Prisma.InputJsonValue)
			: Prisma.DbNull;
	} else if (merged.watchQuery) {
		data.watchQuery = merged.watchQuery as Prisma.InputJsonValue;
	}

	const row = await db.notificationRule.update({
		where: { id: input.id },
		data,
	});
	return formatRule(row);
}

export async function pauseNotificationRule(
	db: PrismaClient,
	userId: string,
	id: string,
	paused: boolean,
): Promise<NotificationRuleView> {
	const existing = await db.notificationRule.findFirst({
		where: { id, userId },
	});
	if (!existing) {
		throw new Error("Notification rule not found");
	}
	const row = await db.notificationRule.update({
		where: { id },
		data: {
			isPaused: paused,
			isActive: !paused,
		},
	});

	if (existing.source === "default_weekly_summary") {
		await db.notificationPreference.upsert({
			where: { userId },
			create: {
				userId,
				weeklySummaryEnabled: !paused,
			},
			update: {
				weeklySummaryEnabled: !paused,
			},
		});
	}

	return formatRule(row);
}

export async function deleteNotificationRule(
	db: PrismaClient,
	userId: string,
	id: string,
): Promise<void> {
	const existing = await db.notificationRule.findFirst({
		where: { id, userId },
	});
	if (!existing) {
		throw new Error("Notification rule not found");
	}
	await db.notificationRule.delete({ where: { id } });
}
