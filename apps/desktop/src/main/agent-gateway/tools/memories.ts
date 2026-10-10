import {
	getMemoriesInputSchema,
	mcpToolContracts,
	saveMemoryInputSchema,
} from "@moat/mcp-contracts";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, " ");
}

function formatMemory(memory: {
	id: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	createdAt: Date;
	updatedAt: Date;
}) {
	return {
		id: memory.id,
		title: memory.title,
		content: memory.content,
		category: memory.category,
		source: memory.source,
		createdAt: memory.createdAt.toISOString(),
		updatedAt: memory.updatedAt.toISOString(),
	};
}

async function isMemoryEnabled(): Promise<boolean> {
	const { getDesktopDb } = await import("../../db");
	const { db } = getDesktopDb();
	type Row = { memoryEnabled: number };
	const rows = await db.$queryRaw<Row[]>`
		SELECT "memoryEnabled" FROM "UserSettings" WHERE "userId" = 'local-user' LIMIT 1
	`;
	if (rows.length === 0) return true;
	return rows[0].memoryEnabled !== 0;
}

function requireMemoriesRepo(ctx: LocalToolContext) {
	const memories = ctx.appRuntime.repositories.memories;
	if (!memories) {
		throw new Error("Memory repository is not available");
	}
	return memories;
}

export const getMemoriesTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getSavedFinancialContext"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = getMemoriesInputSchema.parse(input ?? {});
		if (!(await isMemoryEnabled())) {
			return localSchemaEnvelope("memories.list", {
				memories: [],
				note: "Memory is disabled. Enable it in Settings → Memories.",
			});
		}

		const memories = requireMemoriesRepo(ctx);
		const rows = await memories.list({
			userId: ctx.appRuntime.userId,
			category: parsed.category,
			search: parsed.search,
		});

		return localSchemaEnvelope("memories.list", {
			memories: rows.map(formatMemory),
		});
	},
};

export const saveMemoryTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.saveFinancialContext"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = saveMemoryInputSchema.parse(input ?? {});
		if (!(await isMemoryEnabled())) {
			return localSchemaEnvelope("memory.saved", {
				saved: false,
				note: "Memory is disabled. Enable it in Settings → Memories.",
			});
		}

		const memories = requireMemoriesRepo(ctx);
		const userId = ctx.appRuntime.userId;
		const existing = await memories.list({ userId });
		const duplicate = existing.find(
			(memory) => normalizeTitle(memory.title) === normalizeTitle(parsed.title),
		);

		const saved = duplicate
			? await memories.update({
					userId,
					id: duplicate.id,
					data: {
						content: parsed.content,
						category: parsed.category ?? null,
					},
				})
			: await memories.create({
					userId,
					title: parsed.title.trim(),
					content: parsed.content,
					category: parsed.category ?? null,
					source: "mcp",
				});

		return localSchemaEnvelope("memory.saved", {
			saved: true,
			memory: formatMemory(saved),
		});
	},
};
