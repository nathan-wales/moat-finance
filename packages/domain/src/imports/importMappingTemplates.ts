import type {
	CreateImportMappingTemplateInput,
	ImportMappingTemplateRecord,
	UpdateImportMappingTemplateInput,
} from "@moat/data-access";
import type { AppContext } from "../context";
import { TransactionImportError } from "./importTransactions";

function requireTemplates(ctx: AppContext) {
	const repo = ctx.repositories.importMappingTemplates;
	if (!repo) {
		throw new TransactionImportError(
			"TEMPLATES_UNAVAILABLE",
			"Import templates are unavailable",
		);
	}
	return repo;
}

export async function listImportMappingTemplates(
	ctx: AppContext,
): Promise<ImportMappingTemplateRecord[]> {
	return requireTemplates(ctx).list({ userId: ctx.userId });
}

export async function createImportMappingTemplate(
	ctx: AppContext,
	input: CreateImportMappingTemplateInput,
): Promise<ImportMappingTemplateRecord> {
	return requireTemplates(ctx).create({
		userId: ctx.userId,
		...input,
	});
}

export async function updateImportMappingTemplate(
	ctx: AppContext,
	input: { id: string } & UpdateImportMappingTemplateInput,
): Promise<ImportMappingTemplateRecord> {
	const repo = requireTemplates(ctx);
	const existing = await repo.findById({ userId: ctx.userId, id: input.id });
	if (!existing) {
		throw new TransactionImportError(
			"TEMPLATE_NOT_FOUND",
			"Import template not found",
		);
	}
	const { id, ...data } = input;
	return repo.update({
		userId: ctx.userId,
		id,
		data,
	});
}

export async function deleteImportMappingTemplate(
	ctx: AppContext,
	id: string,
): Promise<void> {
	const repo = requireTemplates(ctx);
	const existing = await repo.findById({ userId: ctx.userId, id });
	if (!existing) {
		throw new TransactionImportError(
			"TEMPLATE_NOT_FOUND",
			"Import template not found",
		);
	}
	await repo.delete({ userId: ctx.userId, id });
}

export function toImportMappingTemplateDto(
	record: ImportMappingTemplateRecord,
) {
	return {
		id: record.id,
		name: record.name,
		isDefault: record.isDefault,
		accountId: record.accountId,
		mapping: record.mapping,
	};
}
