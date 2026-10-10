import { z } from "zod";
import {
	TaxAllowedMimeTypeSchema,
	TaxConflictResolutionSchema,
	TaxDocumentCategorySchema,
	TaxFactCategorySchema,
	TaxFactStatusSchema,
	TaxFormTypeSchema,
	TaxValueTypeSchema,
} from "./enums";

export const TaxYearInputSchema = z
	.object({
		taxYear: z.coerce.number().int().min(1980).max(2100),
	})
	.strict();
export type TaxYearInput = z.infer<typeof TaxYearInputSchema>;

export const TaxListFactsInputSchema = z
	.object({
		taxYear: z.coerce.number().int().min(1980).max(2100),
		category: TaxFactCategorySchema.optional(),
		status: TaxFactStatusSchema.optional(),
		documentId: z.string().min(1).optional(),
	})
	.strict();
export type TaxListFactsInput = z.infer<typeof TaxListFactsInputSchema>;

export const TaxIdInputSchema = z
	.object({
		id: z.string().min(1),
	})
	.strict();
export type TaxIdInput = z.infer<typeof TaxIdInputSchema>;

export const TaxGetDocumentInputSchema = z
	.object({
		id: z.string().min(1),
		includeParsedText: z.coerce.boolean().optional(),
		includeOriginal: z.coerce.boolean().optional(),
	})
	.strict();
export type TaxGetDocumentInput = z.infer<typeof TaxGetDocumentInputSchema>;

export const TaxUploadDocumentInputSchema = z
	.object({
		taxYear: z.coerce.number().int().min(1980).max(2100),
		filename: z.string().min(1).max(260),
		mimeType: TaxAllowedMimeTypeSchema,
		data: z.string().min(1),
		documentCategory: TaxDocumentCategorySchema.optional(),
		formType: TaxFormTypeSchema.optional(),
	})
	.strict();
export type TaxUploadDocumentInput = z.infer<
	typeof TaxUploadDocumentInputSchema
>;

export const TaxParseDocumentInputSchema = z
	.object({
		filename: z.string().min(1).max(260),
		mimeType: TaxAllowedMimeTypeSchema,
		data: z.string().min(1),
	})
	.strict();
export type TaxParseDocumentInput = z.infer<typeof TaxParseDocumentInputSchema>;

export const TaxRenameDocumentInputSchema = z
	.object({
		id: z.string().min(1),
		displayName: z.string().trim().min(1).max(120),
	})
	.strict();
export type TaxRenameDocumentInput = z.infer<
	typeof TaxRenameDocumentInputSchema
>;

export const TaxCreateManualFactInputSchema = z
	.object({
		taxYear: z.number().int().min(1980).max(2100),
		category: TaxFactCategorySchema,
		type: z.string().min(1).max(80),
		value: z.unknown(),
		valueType: TaxValueTypeSchema,
		unit: z.string().optional(),
		currency: z.literal("USD").optional(),
		sourceForm: z.string().optional(),
		sourceBox: z.string().optional(),
		sourceRealEstateId: z.string().min(1).optional(),
		metadata: z.record(z.string(), z.unknown()).optional(),
	})
	.strict();
export type TaxCreateManualFactInput = z.infer<
	typeof TaxCreateManualFactInputSchema
>;

export const TaxUpdateFactInputSchema = z
	.object({
		id: z.string().min(1),
		value: z.unknown().optional(),
		status: TaxFactStatusSchema.optional(),
		userConfirmed: z.boolean().optional(),
		taxYear: z.number().int().min(1980).max(2100).optional(),
	})
	.strict();
export type TaxUpdateFactInput = z.infer<typeof TaxUpdateFactInputSchema>;

export const TaxConfirmFactInputSchema = z
	.object({
		id: z.string().min(1),
		confirmed: z.boolean(),
	})
	.strict();
export type TaxConfirmFactInput = z.infer<typeof TaxConfirmFactInputSchema>;

export const TaxResolveConflictInputSchema = z
	.object({
		id: z.string().min(1),
		resolutionState: TaxConflictResolutionSchema,
		preferredFactId: z.string().min(1).optional(),
	})
	.strict();
export type TaxResolveConflictInput = z.infer<
	typeof TaxResolveConflictInputSchema
>;

export const TaxSearchInputSchema = z
	.object({
		taxYear: z.coerce.number().int().min(1980).max(2100),
		query: z.string().min(1).max(200),
	})
	.strict();
export type TaxSearchInput = z.infer<typeof TaxSearchInputSchema>;
