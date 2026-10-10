import { z } from "zod";
import {
	TaxDocumentCategorySchema,
	TaxDocumentProcessingStateSchema,
	TaxDocumentSourceSchema,
	TaxFormTypeSchema,
	TaxReviewStatusSchema,
} from "./enums";
import { TaxFactSchema } from "./fact";

export const TaxFormExtractionSchema = z
	.object({
		id: z.string().min(1),
		userId: z.string().min(1),
		documentId: z.string().min(1),
		formType: TaxFormTypeSchema,
		schemaVersion: z.string().min(1),
		payload: z.record(z.string(), z.unknown()),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.strict();
export type TaxFormExtraction = z.infer<typeof TaxFormExtractionSchema>;

export const TaxDocumentSchema = z
	.object({
		id: z.string().min(1),
		userId: z.string().min(1),
		taxYear: z.number().int(),
		documentCategory: TaxDocumentCategorySchema,
		formType: TaxFormTypeSchema.nullable(),
		issuer: z.string().nullable(),
		recipient: z.string().nullable(),
		source: TaxDocumentSourceSchema,
		originalFilename: z.string(),
		mimeType: z.string(),
		uploadedAt: z.string(),
		processingState: TaxDocumentProcessingStateSchema,
		parserProvider: z.string().nullable(),
		parserVersion: z.string().nullable(),
		extractionConfidence: z.number().min(0).max(1).nullable(),
		reviewStatus: TaxReviewStatusSchema,
		userConfirmed: z.boolean(),
		factCount: z.number().int().nonnegative(),
		byteSize: z.number().int().nonnegative(),
		displayName: z.string().nullable().optional(),
		failureReason: z.string().nullable().optional(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.strict();
export type TaxDocument = z.infer<typeof TaxDocumentSchema>;

const MANAGEABLE_TAX_DOCUMENT_STATES = [
	"complete",
	"failed",
	"needs_review",
] as const;

const PROCESSING_TAX_DOCUMENT_STATES = [
	"uploaded",
	"processing",
	"parsed",
] as const;

export function isManageableTaxDocument(
	state: z.infer<typeof TaxDocumentProcessingStateSchema>,
): boolean {
	return (MANAGEABLE_TAX_DOCUMENT_STATES as readonly string[]).includes(state);
}

export function isTaxDocumentProcessing(
	state: z.infer<typeof TaxDocumentProcessingStateSchema>,
): boolean {
	return (PROCESSING_TAX_DOCUMENT_STATES as readonly string[]).includes(state);
}

export function taxDocumentTitle(document: {
	displayName?: string | null;
	formType?: string | null;
	issuer?: string | null;
	originalFilename?: string;
}): string {
	const custom = document.displayName?.trim();
	if (custom) return custom;
	const extracted = [document.formType, document.issuer]
		.filter((value): value is string => Boolean(value))
		.join(" — ");
	if (extracted.length > 0) return extracted;
	const filename = document.originalFilename?.trim();
	if (filename) return filename;
	return "Document";
}

export const TaxDocumentDetailSchema = TaxDocumentSchema.extend({
	facts: z.array(TaxFactSchema),
	formExtractions: z.array(TaxFormExtractionSchema),
	hasOriginalFile: z.boolean(),
	hasParsedText: z.boolean(),
	parsedText: z.string().optional(),
}).strict();
export type TaxDocumentDetail = z.infer<typeof TaxDocumentDetailSchema>;
