import type {
	NotificationChannel as ZodChannel,
	PushPrivacyLevel as ZodPrivacy,
	NotificationSignalType as ZodSignal,
	NotificationUrgency as ZodUrgency,
} from "@moat/monitoring-rules";
import type {
	NotificationChannel,
	NotificationSignalType,
	NotificationUrgency,
	PushPrivacyLevel,
} from "../../../generated/prisma";

const signalToPrisma: Record<ZodSignal, NotificationSignalType> = {
	transaction_appeared: "TRANSACTION_APPEARED",
	expected_transaction_missing: "EXPECTED_TRANSACTION_MISSING",
	budget_threshold: "BUDGET_THRESHOLD",
	balance_threshold: "BALANCE_THRESHOLD",
	large_transaction: "LARGE_TRANSACTION",
	recurring_amount_changed: "RECURRING_AMOUNT_CHANGED",
	upcoming_recurring_bill: "UPCOMING_RECURRING_BILL",
	account_sync_stale: "ACCOUNT_SYNC_STALE",
	scheduled_summary: "SCHEDULED_SUMMARY",
};

const signalFromPrisma: Record<NotificationSignalType, ZodSignal> = {
	TRANSACTION_APPEARED: "transaction_appeared",
	EXPECTED_TRANSACTION_MISSING: "expected_transaction_missing",
	BUDGET_THRESHOLD: "budget_threshold",
	BALANCE_THRESHOLD: "balance_threshold",
	LARGE_TRANSACTION: "large_transaction",
	RECURRING_AMOUNT_CHANGED: "recurring_amount_changed",
	UPCOMING_RECURRING_BILL: "upcoming_recurring_bill",
	ACCOUNT_SYNC_STALE: "account_sync_stale",
	SCHEDULED_SUMMARY: "scheduled_summary",
};

const channelToPrisma: Record<ZodChannel, NotificationChannel> = {
	email: "EMAIL",
	push: "PUSH",
	in_app: "IN_APP",
};

const channelFromPrisma: Record<NotificationChannel, ZodChannel> = {
	EMAIL: "email",
	PUSH: "push",
	IN_APP: "in_app",
};

const urgencyToPrisma: Record<ZodUrgency, NotificationUrgency> = {
	critical: "CRITICAL",
	important: "IMPORTANT",
	informational: "INFORMATIONAL",
};

const urgencyFromPrisma: Record<NotificationUrgency, ZodUrgency> = {
	CRITICAL: "critical",
	IMPORTANT: "important",
	INFORMATIONAL: "informational",
};

const privacyToPrisma: Record<ZodPrivacy, PushPrivacyLevel> = {
	hide_details: "HIDE_DETAILS",
	general_details: "GENERAL_DETAILS",
	show_amounts: "SHOW_AMOUNTS",
};

const privacyFromPrisma: Record<PushPrivacyLevel, ZodPrivacy> = {
	HIDE_DETAILS: "hide_details",
	GENERAL_DETAILS: "general_details",
	SHOW_AMOUNTS: "show_amounts",
};

export function toPrismaSignal(signal: ZodSignal): NotificationSignalType {
	return signalToPrisma[signal];
}

export function fromPrismaSignal(signal: NotificationSignalType): ZodSignal {
	return signalFromPrisma[signal];
}

export function toPrismaChannels(
	channels: ZodChannel[],
): NotificationChannel[] {
	return channels.map((channel) => channelToPrisma[channel]);
}

export function fromPrismaChannels(
	channels: NotificationChannel[],
): ZodChannel[] {
	return channels.map((channel) => channelFromPrisma[channel]);
}

export function toPrismaUrgency(urgency: ZodUrgency): NotificationUrgency {
	return urgencyToPrisma[urgency];
}

export function fromPrismaUrgency(urgency: NotificationUrgency): ZodUrgency {
	return urgencyFromPrisma[urgency];
}

export function toPrismaPrivacy(privacy: ZodPrivacy): PushPrivacyLevel {
	return privacyToPrisma[privacy];
}

export function fromPrismaPrivacy(privacy: PushPrivacyLevel): ZodPrivacy {
	return privacyFromPrisma[privacy];
}
