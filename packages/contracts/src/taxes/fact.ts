import { z } from "zod";
import {
	TaxExtractionMethodSchema,
	TaxFactCategorySchema,
	TaxFactSourceTypeSchema,
	TaxFactStatusSchema,
	TaxValueTypeSchema,
} from "./enums";

export const TaxFactProvenanceSchema = z
	.object({
		sourceType: TaxFactSourceTypeSchema,
		documentId: z.string().min(1).optional(),
		documentLabel: z.string().optional(),
		form: z.string().optional(),
		box: z.string().optional(),
		page: z.number().int().optional(),
		transactionId: z.string().min(1).optional(),
		accountId: z.string().min(1).optional(),
		holdingId: z.string().min(1).optional(),
		manualEntryId: z.string().min(1).optional(),
		realEstateId: z.string().min(1).optional(),
		confidenceLabel: z.enum(["low", "medium", "high", "verified"]),
	})
	.strict();
export type TaxFactProvenance = z.infer<typeof TaxFactProvenanceSchema>;

export const TaxFactSchema = z
	.object({
		id: z.string().min(1),
		userId: z.string().min(1),
		taxYear: z.number().int(),
		category: TaxFactCategorySchema,
		type: z.string().min(1),
		key: z.string().min(1),
		value: z.unknown(),
		valueType: TaxValueTypeSchema,
		unit: z.string().optional(),
		currency: z.literal("USD").optional(),
		sourceType: TaxFactSourceTypeSchema,
		sourceDocumentId: z.string().min(1).optional(),
		sourceTransactionId: z.string().min(1).optional(),
		sourceAccountId: z.string().min(1).optional(),
		sourceHoldingId: z.string().min(1).optional(),
		sourceManualEntryId: z.string().min(1).optional(),
		sourceRealEstateId: z.string().min(1).optional(),
		sourceForm: z.string().optional(),
		sourceBox: z.string().optional(),
		sourcePage: z.number().int().optional(),
		sourceText: z.string().optional(),
		confidence: z.number().min(0).max(1),
		extractionMethod: TaxExtractionMethodSchema,
		status: TaxFactStatusSchema,
		userConfirmed: z.boolean(),
		metadata: z.record(z.string(), z.unknown()).optional(),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.strict();
export type TaxFact = z.infer<typeof TaxFactSchema>;

export const TaxFactConflictSchema = z
	.object({
		id: z.string().min(1),
		userId: z.string().min(1),
		taxYear: z.number().int(),
		factKey: z.string().min(1),
		factIds: z.array(z.string().min(1)),
		preferredFactId: z.string().min(1).nullable(),
		resolutionState: z.enum([
			"open",
			"accepted_document",
			"accepted_manual",
			"accepted_financial",
			"split",
			"dismissed",
		]),
		createdAt: z.string(),
		updatedAt: z.string(),
	})
	.strict();
export type TaxFactConflict = z.infer<typeof TaxFactConflictSchema>;
