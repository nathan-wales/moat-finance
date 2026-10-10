import { randomUUID } from "node:crypto";
import type {
	CreateMemoryInput,
	ListMemoriesInput,
	MemoryItem,
	MemoryRepository,
	UpdateMemoryInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type MemoryRow = {
	id: string;
	userId: string;
	title: string;
	content: string;
	category: string | null;
	source: string;
	metadata: string | null;
	createdAt: Date;
	updatedAt: Date;
	deletedAt: Date | null;
};

function toMemoryItem(row: MemoryRow): MemoryItem {
	return {
		id: row.id,
		userId: row.userId,
		title: row.title,
		content: row.content,
		category: row.category ?? null,
		source: row.source,
		metadata: row.metadata != null ? JSON.parse(row.metadata) : null,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
		deletedAt: row.deletedAt ?? null,
	};
}

export class SqliteMemoryRepository implements MemoryRepository {
	constructor(private db: SqliteDbClient) {}

	async list(
		input: { userId: string } & ListMemoriesInput,
	): Promise<MemoryItem[]> {
		const rows = (await this.db.memory.findMany({
			where: {
				userId: input.userId,
				deletedAt: null,
				...(input.category ? { category: input.category } : {}),
				...(input.search
					? {
							OR: [
								{ title: { contains: input.search } },
								{ content: { contains: input.search } },
							],
						}
					: {}),
			},
			orderBy: { createdAt: "desc" },
		})) as MemoryRow[];
		return rows.map(toMemoryItem);
	}

	async findById(input: {
		userId: string;
		id: string;
	}): Promise<MemoryItem | null> {
		const row = (await this.db.memory.findFirst({
			where: { id: input.id, userId: input.userId, deletedAt: null },
		})) as MemoryRow | null;
		return row ? toMemoryItem(row) : null;
	}

	async findByTitle(input: {
		userId: string;
		title: string;
	}): Promise<MemoryItem | null> {
		const row = (await this.db.memory.findFirst({
			where: { userId: input.userId, title: input.title, deletedAt: null },
		})) as MemoryRow | null;
		return row ? toMemoryItem(row) : null;
	}

	async create(
		input: { userId: string } & CreateMemoryInput,
	): Promise<MemoryItem> {
		const row = (await this.db.memory.create({
			data: {
				id: randomUUID(),
				userId: input.userId,
				title: input.title,
				content: input.content,
				category: input.category ?? null,
				source: input.source ?? "manual",
				metadata:
					input.metadata != null ? JSON.stringify(input.metadata) : null,
				updatedAt: new Date(),
			},
		})) as MemoryRow;
		return toMemoryItem(row);
	}

	async update(input: {
		userId: string;
		id: string;
		data: UpdateMemoryInput;
	}): Promise<MemoryItem> {
		const row = (await this.db.memory.update({
			where: { id: input.id, userId: input.userId },
			data: {
				...(input.data.title !== undefined ? { title: input.data.title } : {}),
				...(input.data.content !== undefined
					? { content: input.data.content }
					: {}),
				...(input.data.category !== undefined
					? { category: input.data.category }
					: {}),
				updatedAt: new Date(),
			},
		})) as MemoryRow;
		return toMemoryItem(row);
	}

	async delete(input: { userId: string; id: string }): Promise<void> {
		await this.db.memory.update({
			where: { id: input.id, userId: input.userId },
			data: { deletedAt: new Date(), updatedAt: new Date() },
		});
	}

	async deleteAll(input: { userId: string }): Promise<number> {
		const result = await this.db.memory.updateMany({
			where: { userId: input.userId, deletedAt: null },
			data: { deletedAt: new Date(), updatedAt: new Date() },
		});
		return result.count;
	}
}
