import { z } from "zod";
import { MEMORY_CATEGORIES, MEMORY_SOURCES } from "./types";

export const memoryCategorySchema = z.enum(MEMORY_CATEGORIES).optional();

export const createMemoryInputSchema = z.object({
	title: z.string().min(1).max(200),
	content: z.string().min(1).max(5000),
	category: z.enum(MEMORY_CATEGORIES).optional(),
	source: z.enum(MEMORY_SOURCES).optional().default("manual"),
	metadata: z.record(z.unknown()).optional(),
});

export const updateMemoryInputSchema = z.object({
	title: z.string().min(1).max(200).optional(),
	content: z.string().min(1).max(5000).optional(),
	category: z.enum(MEMORY_CATEGORIES).nullable().optional(),
});

export const listMemoriesInputSchema = z.object({
	category: z.enum(MEMORY_CATEGORIES).optional(),
	search: z.string().min(1).max(200).optional(),
});

export type CreateMemoryInput = z.infer<typeof createMemoryInputSchema>;
export type UpdateMemoryInput = z.infer<typeof updateMemoryInputSchema>;
export type ListMemoriesInput = z.infer<typeof listMemoriesInputSchema>;
