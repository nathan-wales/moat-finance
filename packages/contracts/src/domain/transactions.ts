import { z } from "zod";

/**
 * Zod schemas for shared domain DTOs.
 *
 * These validate data at system boundaries: IPC channels, API responses,
 * sync payloads, and MCP tool outputs.
 *
 * The TypeScript types in @moat/data-access are the source of truth for shape.
 * These schemas add runtime validation at boundaries where data crosses
 * process or network lines.
 */

export const TransactionTypeSchema = z.enum(["INCOME", "EXPENSE"]);

export const DashboardTransactionSchema = z.object({
	id: z.string(),
	date: z.coerce.date(),
	description: z.string().nullable(),
	originalDescription: z.string().nullable().optional(),
	notes: z.string().nullable().optional(),
	amount: z.number(),
	type: TransactionTypeSchema,
	category: z.string(),
	account: z.string().nullable(),
	amazonRetailEnrichedAt: z.coerce.date().nullable().optional(),
});

export const AccountSummarySchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	subtype: z.string().nullable(),
	currentBalance: z.number().nullable(),
	currency: z.string(),
	mask: z.string().nullable(),
	isHidden: z.boolean(),
	isActive: z.boolean(),
});

export const MonthlyTotalsSchema = z.object({
	month: z.string().regex(/^\d{4}-\d{2}$/, "Must be YYYY-MM"),
	income: z.number(),
	expenses: z.number(),
	net: z.number(),
});

export const CategorySpendSchema = z.object({
	category: z.string(),
	total: z.number(),
});

export type TransactionType = z.infer<typeof TransactionTypeSchema>;
export type DashboardTransaction = z.infer<typeof DashboardTransactionSchema>;
export type AccountSummary = z.infer<typeof AccountSummarySchema>;
export type MonthlyTotals = z.infer<typeof MonthlyTotalsSchema>;
export type CategorySpend = z.infer<typeof CategorySpendSchema>;
