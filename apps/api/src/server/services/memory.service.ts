import { logger } from "~/lib/logger";
import type { Prisma, PrismaClient } from "../../../generated/prisma";

export type MemoryRow = {
	id: string;
	userId: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	metadata: unknown;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};

type CreateMemoryArgs = {
	userId: string;
	title: string;
	content: string;
	category?: string | null;
	source: string;
	metadata?: Prisma.InputJsonValue | null;
};

type UpdateMemoryArgs = {
	id: string;
	userId: string;
	title?: string;
	content?: string;
	category?: string | null;
};

type ListMemoriesArgs = {
	userId: string;
	category?: string;
	search?: string;
};

function normalizeTitle(title: string): string {
	return title.trim().toLowerCase().replace(/\s+/g, " ");
}

export async function createMemory(
	db: PrismaClient,
	args: CreateMemoryArgs,
): Promise<MemoryRow> {
	const normalizedTitle = normalizeTitle(args.title);

	// Check all non-deleted memories for duplicate normalized title
	const existingMemories = await db.memory.findMany({
		where: {
			userId: args.userId,
			deletedAt: null,
		},
		select: { id: true, title: true },
	});

	const duplicate = existingMemories.find(
		(m) => normalizeTitle((m as { title: string }).title) === normalizedTitle,
	);

	if (duplicate) {
		// Update the existing memory instead of creating a duplicate
		const updated = await db.memory.update({
			where: { id: duplicate.id },
			data: {
				content: args.content,
				category: args.category ?? null,
				source: args.source,
				metadata:
					args.metadata != null
						? (args.metadata as Prisma.InputJsonValue)
						: undefined,
				updatedAt: new Date(),
			},
		});
		return updated as MemoryRow;
	}

	const memory = await db.memory.create({
		data: {
			userId: args.userId,
			title: args.title.trim(),
			content: args.content,
			category: args.category ?? null,
			source: args.source,
			metadata:
				args.metadata != null
					? (args.metadata as Prisma.InputJsonValue)
					: undefined,
		},
	});

	return memory as MemoryRow;
}

export async function updateMemory(
	db: PrismaClient,
	args: UpdateMemoryArgs,
): Promise<MemoryRow> {
	const memory = await db.memory.findFirst({
		where: { id: args.id, userId: args.userId, deletedAt: null },
	});

	if (!memory) {
		throw new Error("Memory not found");
	}

	const updated = await db.memory.update({
		where: { id: args.id },
		data: {
			...(args.title !== undefined ? { title: args.title.trim() } : {}),
			...(args.content !== undefined ? { content: args.content } : {}),
			...(args.category !== undefined ? { category: args.category } : {}),
		},
	});

	return updated as MemoryRow;
}

export async function getMemoryById(
	db: PrismaClient,
	id: string,
	userId: string,
): Promise<MemoryRow | null> {
	const memory = await db.memory.findFirst({
		where: { id, userId, deletedAt: null },
	});
	return (memory as MemoryRow | null) ?? null;
}

export async function listMemories(
	db: PrismaClient,
	args: ListMemoriesArgs,
): Promise<MemoryRow[]> {
	const memories = await db.memory.findMany({
		where: {
			userId: args.userId,
			deletedAt: null,
			...(args.category ? { category: args.category } : {}),
			...(args.search
				? {
						OR: [
							{ title: { contains: args.search, mode: "insensitive" } },
							{ content: { contains: args.search, mode: "insensitive" } },
						],
					}
				: {}),
		},
		orderBy: { createdAt: "desc" },
	});
	return memories as MemoryRow[];
}

export async function deleteMemory(
	db: PrismaClient,
	id: string,
	userId: string,
): Promise<void> {
	const memory = await db.memory.findFirst({
		where: { id, userId, deletedAt: null },
	});

	if (!memory) {
		throw new Error("Memory not found");
	}

	await db.memory.update({
		where: { id },
		data: { deletedAt: new Date() },
	});
}

export async function deleteAllMemories(
	db: PrismaClient,
	userId: string,
): Promise<number> {
	const result = await db.memory.updateMany({
		where: { userId, deletedAt: null },
		data: { deletedAt: new Date() },
	});
	logger.info("All memories deleted", { userId, count: result.count });
	return result.count;
}
