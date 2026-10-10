import { z } from "zod";

export const snapshotTransactionSchema = z.object({
	id: z.string(),
	dateIso: z.string(),
	amount: z.number(),
	/** Unsigned magnitude in Moat storage; use with `type` for direction. */
	merchantName: z.string().nullable().optional(),
	description: z.string().nullable().optional(),
	categoryName: z.string().nullable().optional(),
	categoryId: z.string().nullable().optional(),
	hashtags: z.array(z.string()).default([]),
	accountId: z.string().nullable().optional(),
	pending: z.boolean().default(false),
	isRecurring: z.boolean().default(false),
	/** INCOME | EXPENSE | TRANSFER* — required for direction filters. */
	type: z.string().nullable().optional(),
});

export type SnapshotTransaction = z.infer<typeof snapshotTransactionSchema>;

export const snapshotAccountSchema = z.object({
	id: z.string(),
	name: z.string(),
	currentBalance: z.number().nullable(),
	type: z.string().optional(),
});

export type SnapshotAccount = z.infer<typeof snapshotAccountSchema>;

export const snapshotBudgetSchema = z.object({
	categoryId: z.string(),
	categoryName: z.string(),
	monthlyGoal: z.number(),
	spent: z.number(),
	percentUsed: z.number(),
	percentOfMonthElapsed: z.number(),
});

export type SnapshotBudget = z.infer<typeof snapshotBudgetSchema>;

export const snapshotConnectionSchema = z.object({
	id: z.string(),
	institutionName: z.string().nullable().optional(),
	lastSuccessfulSyncAtIso: z.string().nullable().optional(),
});

export type SnapshotConnection = z.infer<typeof snapshotConnectionSchema>;

export const snapshotRecurringSchema = z.object({
	label: z.string(),
	merchantName: z.string().nullable().optional(),
	categoryName: z.string().nullable().optional(),
	amount: z.number(),
	previousAmount: z.number().nullable().optional(),
	nextExpectedDateIso: z.string().nullable().optional(),
	cadence: z.string().optional(),
});

export type SnapshotRecurring = z.infer<typeof snapshotRecurringSchema>;

const matchCriteriaLooseSchema = z
	.object({
		merchantContains: z.string().optional(),
		descriptionContains: z.string().optional(),
		categoryName: z.string().optional(),
		hashtag: z.string().optional(),
		accountIds: z.array(z.string()).optional(),
		amountMin: z.number().optional(),
		amountMax: z.number().optional(),
		recurringLabel: z.string().optional(),
	})
	.passthrough()
	.default({});

export const snapshotExpectedEventSchema = z.object({
	id: z.string(),
	label: z.string(),
	matchCriteria: matchCriteriaLooseSchema,
	cadence: z.string(),
	expectedWindowStartDay: z.number().int().min(1).max(31).nullable().optional(),
	expectedWindowEndDay: z.number().int().min(1).max(31).nullable().optional(),
	missingAfterDay: z.number().int().min(1).max(31).nullable().optional(),
	amount: z.number().nullable().optional(),
	accountIds: z.array(z.string()).default([]),
	lastMatchedAtIso: z.string().nullable().optional(),
});

export type SnapshotExpectedEvent = z.infer<typeof snapshotExpectedEventSchema>;

export const financialSnapshotSchema = z.object({
	transactions: z.array(snapshotTransactionSchema).default([]),
	accounts: z.array(snapshotAccountSchema).default([]),
	budgets: z.array(snapshotBudgetSchema).default([]),
	connections: z.array(snapshotConnectionSchema).default([]),
	recurring: z.array(snapshotRecurringSchema).default([]),
	expectedEvents: z.array(snapshotExpectedEventSchema).default([]),
	uncategorizedCount: z.number().int().nonnegative().default(0),
	moneyIn: z.number().default(0),
	moneyOut: z.number().default(0),
	previousWeekMoneyOut: z.number().nullable().optional(),
	recentAverageWeeklyMoneyOut: z.number().nullable().optional(),
	upcomingRecurringTotal: z.number().nullable().optional(),
	projectedEndOfMonthCash: z.number().nullable().optional(),
	netWorth: z.number().nullable().optional(),
	previousWeekNetWorth: z.number().nullable().optional(),
});

export type FinancialSnapshot = z.infer<typeof financialSnapshotSchema>;
