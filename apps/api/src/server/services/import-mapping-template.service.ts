import {
	createImportMappingTemplate,
	deleteImportMappingTemplate,
	listImportMappingTemplates,
	TransactionImportError,
	toImportMappingTemplateDto,
	updateImportMappingTemplate,
} from "@moat/domain";
import { logger } from "~/lib/logger";
import { type ApiContext, createApiError } from "../api-context";
import { createApiAppContext } from "../createApiAppContext";

function mapTemplateError(
	error: unknown,
	userId: string,
	operation: string,
): never {
	if (error instanceof TransactionImportError) {
		logger.warn("Import mapping template rejected", {
			feature: "import_mapping_template",
			operation,
			userId,
			code: error.code,
		});
		const status = error.code === "TEMPLATE_NOT_FOUND" ? 404 : 400;
		const apiError = createApiError(error.message, status) as Error & {
			status: number;
			code: string;
		};
		apiError.code = error.code;
		throw apiError;
	}
	logger.error("Import mapping template failed", {
		feature: "import_mapping_template",
		operation,
		userId,
		error: error instanceof Error ? error.message : "unknown",
	});
	throw error;
}

export async function listImportTemplatesForUser(
	ctx: ApiContext & { userId: string },
) {
	try {
		const appCtx = createApiAppContext(ctx.userId, ctx.db);
		const templates = await listImportMappingTemplates(appCtx);
		return { templates: templates.map(toImportMappingTemplateDto) };
	} catch (error) {
		mapTemplateError(error, ctx.userId, "list");
	}
}

export async function createImportTemplateForUser(
	ctx: ApiContext & { userId: string },
	input: {
		name: string;
		mapping: {
			date: string;
			description: string;
			amount: string;
			type?: string;
			category?: string;
		};
		accountId?: string | null;
		isDefault?: boolean;
	},
) {
	try {
		const appCtx = createApiAppContext(ctx.userId, ctx.db);
		const created = await createImportMappingTemplate(appCtx, {
			name: input.name,
			mapping: input.mapping,
			accountId: input.accountId ?? null,
			isDefault: input.isDefault ?? false,
		});
		return toImportMappingTemplateDto(created);
	} catch (error) {
		mapTemplateError(error, ctx.userId, "create");
	}
}

export async function updateImportTemplateForUser(
	ctx: ApiContext & { userId: string },
	input: {
		id: string;
		name?: string;
		mapping?: {
			date: string;
			description: string;
			amount: string;
			type?: string;
			category?: string;
		};
		accountId?: string | null;
		isDefault?: boolean;
	},
) {
	try {
		const appCtx = createApiAppContext(ctx.userId, ctx.db);
		const updated = await updateImportMappingTemplate(appCtx, input);
		return toImportMappingTemplateDto(updated);
	} catch (error) {
		mapTemplateError(error, ctx.userId, "update");
	}
}

export async function deleteImportTemplateForUser(
	ctx: ApiContext & { userId: string },
	id: string,
) {
	try {
		const appCtx = createApiAppContext(ctx.userId, ctx.db);
		await deleteImportMappingTemplate(appCtx, id);
		return { success: true as const };
	} catch (error) {
		mapTemplateError(error, ctx.userId, "delete");
	}
}
