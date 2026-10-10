import { z } from "zod";
import { logger } from "~/lib/logger";
import {
	createMemory,
	deleteAllMemories,
	deleteMemory,
	listMemories,
	updateMemory,
} from "~/server/services/memory.service";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

const MEMORY_CATEGORIES = [
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

const listMemoriesInput = z.object({
	category: z.enum(MEMORY_CATEGORIES).optional(),
	search: z.string().min(1).max(200).optional(),
});

const createMemoryInput = z.object({
	title: z.string().min(1).max(200),
	content: z.string().min(1).max(5000),
	category: z.enum(MEMORY_CATEGORIES).optional(),
});

const updateMemoryInput = z.object({
	id: z.string().min(1),
	title: z.string().min(1).max(200).optional(),
	content: z.string().min(1).max(5000).optional(),
	category: z.enum(MEMORY_CATEGORIES).nullable().optional(),
});

const deleteMemoryInput = z.object({
	id: z.string().min(1),
});

function formatMemory(m: {
	id: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	metadata: unknown;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: m.id,
		title: m.title,
		content: m.content,
		category: m.category,
		source: m.source,
		createdAt: m.createdAt.toISOString(),
		updatedAt: m.updatedAt.toISOString(),
	};
}

export const memory = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = listMemoriesInput.parse(body ?? {});
		const memories = await listMemories(ctx.db, {
			userId: ctx.userId,
			category: input.category,
			search: input.search,
		});
		return { memories: memories.map(formatMemory) };
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = createMemoryInput.parse(body);
		const mem = await createMemory(ctx.db, {
			userId: ctx.userId,
			title: input.title,
			content: input.content,
			category: input.category ?? null,
			source: "manual",
		});
		return { memory: formatMemory(mem) };
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = updateMemoryInput.parse(body);
		const mem = await updateMemory(ctx.db, {
			id: input.id,
			userId: ctx.userId,
			title: input.title,
			content: input.content,
			category: input.category,
		});
		return { memory: formatMemory(mem) };
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = deleteMemoryInput.parse(body);
		await deleteMemory(ctx.db, input.id, ctx.userId);
		return { success: true };
	}),

	deleteAll: withAuth(async (ctx: AuthenticatedContext, _body: unknown) => {
		const count = await deleteAllMemories(ctx.db, ctx.userId);
		logger.info("User deleted all memories", { userId: ctx.userId, count });
		return { success: true, count };
	}),

	getSettings: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, _body: unknown) => {
			const settings = await ctx.db.userSettings.findFirst({
				where: { userId: ctx.userId },
				select: { memoryEnabled: true },
			});
			return { memoryEnabled: settings?.memoryEnabled ?? true };
		},
	),

	setMemoryEnabled: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = z.object({ enabled: z.boolean() }).parse(body);
			await ctx.db.userSettings.upsert({
				where: { userId: ctx.userId },
				create: { userId: ctx.userId, memoryEnabled: input.enabled },
				update: { memoryEnabled: input.enabled },
			});
			return { memoryEnabled: input.enabled };
		},
	),
};
