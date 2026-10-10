import type { GetMemoriesInput, SaveMemoryInput } from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

type MemoryRow = {
	id: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
	userId: string;
};

function formatMemory(m: MemoryRow) {
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

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, " ");
}

async function getMemories(
	input: GetMemoriesInput,
	context: McpAuthContext,
): Promise<unknown> {
	// Check if memory is enabled for this user
	const settings = await context.db.userSettings.findFirst({
		where: { userId: context.userId },
		select: { memoryEnabled: true },
	});

	if (settings && settings.memoryEnabled === false) {
		return schemaEnvelope("memories.list", {
			memories: [],
			note: "Memory is disabled. Enable it in Settings → Memories.",
		});
	}

	const memories = (await context.db.memory.findMany({
		where: {
			userId: context.userId,
			deletedAt: null,
			...(input.category ? { category: input.category } : {}),
			...(input.search
				? {
						OR: [
							{ title: { contains: input.search, mode: "insensitive" } },
							{ content: { contains: input.search, mode: "insensitive" } },
						],
					}
				: {}),
		},
		orderBy: { createdAt: "desc" },
	})) as MemoryRow[];

	return schemaEnvelope("memories.list", {
		memories: memories.map(formatMemory),
	});
}

async function saveMemory(
	input: SaveMemoryInput,
	context: McpAuthContext,
): Promise<unknown> {
	// Check if memory is enabled for this user
	const settings = await context.db.userSettings.findFirst({
		where: { userId: context.userId },
		select: { memoryEnabled: true },
	});

	if (settings && settings.memoryEnabled === false) {
		return schemaEnvelope("memory.saved", {
			saved: false,
			note: "Memory is disabled. Enable it in Settings → Memories.",
		});
	}

	const normalizedTitle = normalizeTitle(input.title);

	const existingMemories = (await context.db.memory.findMany({
		where: { userId: context.userId, deletedAt: null },
		select: { id: true, title: true },
	})) as { id: string; title: string }[];

	const duplicate = existingMemories.find(
		(m) => normalizeTitle(m.title) === normalizedTitle,
	);

	let mem: MemoryRow;

	if (duplicate) {
		mem = (await context.db.memory.update({
			where: { id: duplicate.id },
			data: {
				content: input.content,
				category: input.category ?? null,
				source: "mcp",
				updatedAt: new Date(),
			},
		})) as MemoryRow;
	} else {
		mem = (await context.db.memory.create({
			data: {
				userId: context.userId,
				title: input.title.trim(),
				content: input.content,
				category: input.category ?? null,
				source: "mcp",
			},
		})) as MemoryRow;
	}

	return schemaEnvelope("memory.saved", {
		saved: true,
		memory: formatMemory(mem),
	});
}

export const getMemoriesTool: McpToolImplementation<GetMemoriesInput> = {
	contract: mcpToolContracts["moat.getSavedFinancialContext"],
	execute: getMemories,
};

export const saveMemoryTool: McpToolImplementation<SaveMemoryInput> = {
	contract: mcpToolContracts["moat.saveFinancialContext"],
	execute: saveMemory,
};
