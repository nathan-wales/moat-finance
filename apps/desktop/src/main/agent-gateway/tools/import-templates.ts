import {
	createImportMappingTemplate,
	deleteImportMappingTemplate,
	listImportMappingTemplates,
	toImportMappingTemplateDto,
	updateImportMappingTemplate,
} from "@moat/domain";
import {
	createImportMappingTemplateInputSchema,
	deleteImportMappingTemplateInputSchema,
	emptyImportMappingTemplateInputSchema,
	mcpToolContracts,
	updateImportMappingTemplateInputSchema,
} from "@moat/mcp-contracts";
import type { LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

export const listImportTemplatesTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listImportTemplates"],
	async execute(input, ctx) {
		emptyImportMappingTemplateInputSchema.parse(input ?? {});
		const templates = await listImportMappingTemplates(ctx.appRuntime);
		return localSchemaEnvelope("import.templates_list", {
			templates: templates.map(toImportMappingTemplateDto),
		});
	},
};

export const createImportTemplateTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.createImportTemplate"],
	async execute(input, ctx) {
		const parsed = createImportMappingTemplateInputSchema.parse(input ?? {});
		const created = await createImportMappingTemplate(ctx.appRuntime, {
			name: parsed.name,
			mapping: parsed.mapping,
			accountId: parsed.accountId ?? null,
			isDefault: parsed.isDefault ?? false,
		});
		return localSchemaEnvelope("import.template_created", {
			template: toImportMappingTemplateDto(created),
		});
	},
};

export const updateImportTemplateTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateImportTemplate"],
	async execute(input, ctx) {
		const parsed = updateImportMappingTemplateInputSchema.parse(input ?? {});
		const updated = await updateImportMappingTemplate(ctx.appRuntime, parsed);
		return localSchemaEnvelope("import.template_updated", {
			template: toImportMappingTemplateDto(updated),
		});
	},
};

export const deleteImportTemplateTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteImportTemplate"],
	async execute(input, ctx) {
		const parsed = deleteImportMappingTemplateInputSchema.parse(input ?? {});
		await deleteImportMappingTemplate(ctx.appRuntime, parsed.id);
		return localSchemaEnvelope("import.template_deleted", {
			success: true as const,
		});
	},
};
