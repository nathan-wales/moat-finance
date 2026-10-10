import { z } from "zod";

export const notificationSignalTypes = [
	"transaction_appeared",
	"expected_transaction_missing",
	"budget_threshold",
	"balance_threshold",
	"large_transaction",
	"recurring_amount_changed",
	"upcoming_recurring_bill",
	"account_sync_stale",
	"scheduled_summary",
] as const;

export const notificationSignalTypeSchema = z.enum(notificationSignalTypes);
export type NotificationSignalType = z.infer<
	typeof notificationSignalTypeSchema
>;

export const matchCriteriaSchema = z.object({
	merchantContains: z.string().min(1).max(200).optional(),
	descriptionContains: z.string().min(1).max(200).optional(),
	categoryName: z.string().min(1).max(120).optional(),
	hashtag: z.string().min(1).max(80).optional(),
	accountIds: z.array(z.string().min(1)).max(50).optional(),
	amountMin: z.number().finite().optional(),
	amountMax: z.number().finite().optional(),
	recurringLabel: z.string().min(1).max(120).optional(),
});

export type MatchCriteria = z.infer<typeof matchCriteriaSchema>;

export const signalTriggerSchema = z.discriminatedUnion("signalType", [
	z.object({
		signalType: z.literal("transaction_appeared"),
		match: matchCriteriaSchema.default({}),
	}),
	z.object({
		signalType: z.literal("expected_transaction_missing"),
		match: matchCriteriaSchema,
		expectedCadence: z.enum(["weekly", "biweekly", "monthly", "yearly"]),
		expectedWindowStartDay: z.number().int().min(1).max(31),
		expectedWindowEndDay: z.number().int().min(1).max(31),
		missingAfterDay: z.number().int().min(1).max(31),
	}),
	z.object({
		signalType: z.literal("budget_threshold"),
		categoryId: z.string().min(1).optional(),
		categoryName: z.string().min(1).max(120).optional(),
		thresholdPercent: z.number().min(1).max(200).default(80),
	}),
	z.object({
		signalType: z.literal("balance_threshold"),
		accountIds: z.array(z.string().min(1)).max(50).optional(),
		thresholdAmount: z.number().finite(),
		direction: z.enum(["below", "above"]).default("below"),
	}),
	z.object({
		signalType: z.literal("large_transaction"),
		amountThreshold: z.number().positive().default(500),
		excludeRecurring: z.boolean().default(true),
		match: matchCriteriaSchema.default({}),
	}),
	z.object({
		signalType: z.literal("recurring_amount_changed"),
		match: matchCriteriaSchema.default({}),
		percentChange: z.number().positive().default(10),
	}),
	z.object({
		signalType: z.literal("upcoming_recurring_bill"),
		match: matchCriteriaSchema.default({}),
		daysAhead: z.number().int().min(1).max(60).default(7),
	}),
	z.object({
		signalType: z.literal("account_sync_stale"),
		connectionIds: z.array(z.string().min(1)).max(50).optional(),
		staleAfterHours: z.number().positive().default(48),
	}),
	z.object({
		signalType: z.literal("scheduled_summary"),
		reportingPeriod: z
			.enum([
				"previous_calendar_week",
				"last_seven_days",
				"month_to_date",
				"previous_month",
				"custom",
			])
			.default("previous_calendar_week"),
		customPeriodDays: z.number().int().min(1).max(90).optional(),
	}),
]);

export type SignalTrigger = z.infer<typeof signalTriggerSchema>;
