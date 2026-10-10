import { z } from "zod";

export const ACCOUNTS_CHANNELS = {
	list: "accounts:list",
	upsert: "accounts:upsert",
} as const;

export const IpcAccountSummarySchema = z.object({
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

export const UpsertAccountInputSchema = z.object({
	id: z.string().optional(),
	name: z.string().min(1),
	type: z.string().min(1),
	subtype: z.string().optional(),
	institutionName: z.string().optional(),
	currentBalance: z.number().optional(),
	currency: z.string().default("USD"),
});

export type IpcAccountSummary = z.infer<typeof IpcAccountSummarySchema>;
