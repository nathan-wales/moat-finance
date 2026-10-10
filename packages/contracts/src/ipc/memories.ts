import { z } from "zod";

export const MEMORY_CHANNELS = {
	list: "memory:list",
	create: "memory:create",
	update: "memory:update",
	delete: "memory:delete",
	deleteAll: "memory:deleteAll",
	getSettings: "memory:getSettings",
	setMemoryEnabled: "memory:setMemoryEnabled",
} as const;

export const MEMORY_CATEGORIES = [
	"preference",
	"financial_goal",
	"account_context",
	"budgeting_rule",
	"tax_context",
	"insurance_context",
	"household_context",
	"business_context",
	"other",
] as const;

export const MemoryCategorySchema = z.enum(MEMORY_CATEGORIES);

export const MemorySchema = z.object({
	id: z.string(),
	userId: z.string(),
	title: z.string(),
	content: z.string(),
	category: MemoryCategorySchema.nullable(),
	source: z.string(),
	metadata: z.unknown().nullable(),
	createdAt: z.coerce.date(),
	updatedAt: z.coerce.date(),
	deletedAt: z.coerce.date().nullable(),
});

export const ListMemoriesInputSchema = z.object({
	category: MemoryCategorySchema.optional(),
	search: z.string().optional(),
});

export const CreateMemoryInputSchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().min(1).max(5000),
	category: MemoryCategorySchema.optional(),
	source: z.string().default("manual"),
});

export const UpdateMemoryInputSchema = z.object({
	id: z.string(),
	title: z.string().min(1).max(200).optional(),
	content: z.string().min(1).max(5000).optional(),
	category: MemoryCategorySchema.nullable().optional(),
});

export const DeleteMemoryInputSchema = z.object({
	id: z.string(),
});

export const SetMemoryEnabledInputSchema = z.object({
	enabled: z.boolean(),
});

export type IpcMemory = z.infer<typeof MemorySchema>;
export type IpcMemoryCategory = z.infer<typeof MemoryCategorySchema>;
export type IpcListMemoriesInput = z.infer<typeof ListMemoriesInputSchema>;
export type IpcCreateMemoryInput = z.infer<typeof CreateMemoryInputSchema>;
export type IpcUpdateMemoryInput = z.infer<typeof UpdateMemoryInputSchema>;
export type IpcDeleteMemoryInput = z.infer<typeof DeleteMemoryInputSchema>;
export type IpcMemorySettings = { memoryEnabled: boolean };
