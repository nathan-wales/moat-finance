import { z } from "zod";
import { csvColumnMappingSchema } from "./transaction-import";

export const importMappingTemplateMappingSchema = csvColumnMappingSchema
	.omit({ account: true })
	.extend({
		description: z.string().min(1),
	})
	.strict();

export const importMappingTemplateSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1).max(80),
		isDefault: z.boolean(),
		accountId: z.string().min(1).nullable(),
		mapping: importMappingTemplateMappingSchema,
	})
	.strict();

export const createImportMappingTemplateInputSchema = z
	.object({
		name: z.string().min(1).max(80),
		mapping: importMappingTemplateMappingSchema,
		accountId: z.string().min(1).nullable().optional(),
		isDefault: z.boolean().optional(),
	})
	.strict();

export const updateImportMappingTemplateInputSchema = z
	.object({
		id: z.string().min(1),
		name: z.string().min(1).max(80).optional(),
		mapping: importMappingTemplateMappingSchema.optional(),
		accountId: z.string().min(1).nullable().optional(),
		isDefault: z.boolean().optional(),
	})
	.strict();

export const deleteImportMappingTemplateInputSchema = z
	.object({
		id: z.string().min(1),
	})
	.strict();

export const emptyImportMappingTemplateInputSchema = z.object({}).strict();

export type ImportMappingTemplateDto = z.infer<
	typeof importMappingTemplateSchema
>;
export type CreateImportMappingTemplateInput = z.infer<
	typeof createImportMappingTemplateInputSchema
>;
export type UpdateImportMappingTemplateInput = z.infer<
	typeof updateImportMappingTemplateInputSchema
>;
