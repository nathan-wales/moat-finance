import { randomUUID } from "node:crypto";
import type {
	CreateImportMappingTemplateInput,
	ImportMappingTemplateMapping,
	ImportMappingTemplateRecord,
	ImportMappingTemplateRepository,
	UpdateImportMappingTemplateInput,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

type TemplateRow = {
	id: string;
	userId: string;
	name: string;
	isDefault: boolean | number;
	accountId: string | null;
	mapping: string;
	createdAt: Date;
	updatedAt: Date;
};

function isMapping(value: unknown): value is ImportMappingTemplateMapping {
	if (!value || typeof value !== "object") return false;
	const row = value as Record<string, unknown>;
	return (
		typeof row.date === "string" &&
		typeof row.description === "string" &&
		typeof row.amount === "string" &&
		(row.type === undefined || typeof row.type === "string") &&
		(row.category === undefined || typeof row.category === "string") &&
		(row.memo === undefined || typeof row.memo === "string")
	);
}

function toRecord(row: TemplateRow): ImportMappingTemplateRecord {
	const parsed: unknown = JSON.parse(row.mapping);
	if (!isMapping(parsed)) {
		throw new Error("Invalid import mapping template mapping");
	}
	return {
		id: row.id,
		userId: row.userId,
		name: row.name,
		isDefault: Boolean(row.isDefault),
		accountId: row.accountId,
		mapping: parsed,
		createdAt: row.createdAt,
		updatedAt: row.updatedAt,
	};
}

export class SqliteImportMappingTemplateRepository
	implements ImportMappingTemplateRepository
{
	constructor(private db: SqliteDbClient) {}

	async list(input: {
		userId: string;
	}): Promise<ImportMappingTemplateRecord[]> {
		const rows = (await this.db.importMappingTemplate.findMany({
			where: { userId: input.userId },
			orderBy: [{ isDefault: "desc" }, { createdAt: "desc" }],
		})) as TemplateRow[];
		return rows.map(toRecord);
	}

	async findById(input: {
		userId: string;
		id: string;
	}): Promise<ImportMappingTemplateRecord | null> {
		const row = (await this.db.importMappingTemplate.findFirst({
			where: { id: input.id, userId: input.userId },
		})) as TemplateRow | null;
		return row ? toRecord(row) : null;
	}

	async create(
		input: { userId: string } & CreateImportMappingTemplateInput,
	): Promise<ImportMappingTemplateRecord> {
		if (input.isDefault) {
			await this.db.importMappingTemplate.updateMany({
				where: { userId: input.userId, isDefault: true },
				data: { isDefault: false, updatedAt: new Date() },
			});
		}
		const row = (await this.db.importMappingTemplate.create({
			data: {
				id: randomUUID(),
				userId: input.userId,
				name: input.name.trim(),
				isDefault: input.isDefault,
				accountId: input.accountId,
				mapping: JSON.stringify(input.mapping),
				updatedAt: new Date(),
			},
		})) as TemplateRow;
		return toRecord(row);
	}

	async update(input: {
		userId: string;
		id: string;
		data: UpdateImportMappingTemplateInput;
	}): Promise<ImportMappingTemplateRecord> {
		const existing = await this.findById({
			userId: input.userId,
			id: input.id,
		});
		if (!existing) {
			throw new Error("Import template not found");
		}
		if (input.data.isDefault) {
			await this.db.importMappingTemplate.updateMany({
				where: {
					userId: input.userId,
					isDefault: true,
					NOT: { id: input.id },
				},
				data: { isDefault: false, updatedAt: new Date() },
			});
		}
		const row = (await this.db.importMappingTemplate.update({
			where: { id: input.id },
			data: {
				...(input.data.name !== undefined
					? { name: input.data.name.trim() }
					: {}),
				...(input.data.mapping !== undefined
					? { mapping: JSON.stringify(input.data.mapping) }
					: {}),
				...(input.data.accountId !== undefined
					? { accountId: input.data.accountId }
					: {}),
				...(input.data.isDefault !== undefined
					? { isDefault: input.data.isDefault }
					: {}),
				updatedAt: new Date(),
			},
		})) as TemplateRow;
		return toRecord(row);
	}

	async delete(input: { userId: string; id: string }): Promise<void> {
		const existing = await this.findById({
			userId: input.userId,
			id: input.id,
		});
		if (!existing) {
			throw new Error("Import template not found");
		}
		await this.db.importMappingTemplate.delete({
			where: { id: input.id },
		});
	}
}
