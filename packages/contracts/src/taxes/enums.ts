import { z } from "zod";

export const TAX_TABS = ["overview", "documents", "details"] as const;
export const TaxTabSchema = z.enum(TAX_TABS);
export type TaxTab = z.infer<typeof TaxTabSchema>;

export const TAX_FACT_CATEGORIES = [
	"identity",
	"income",
	"withholding",
	"deduction",
	"credit",
	"investment",
	"retirement",
	"real_estate",
	"business",
	"healthcare",
	"education",
	"estimated_payment",
	"prior_year",
] as const;
export const TaxFactCategorySchema = z.enum(TAX_FACT_CATEGORIES);
export type TaxFactCategory = z.infer<typeof TaxFactCategorySchema>;

export const TAX_FACT_SOURCE_TYPES = [
	"reported",
	"document",
	"financial_data",
	"manual",
	"agent_inference",
	"prior_year",
] as const;
export const TaxFactSourceTypeSchema = z.enum(TAX_FACT_SOURCE_TYPES);
export type TaxFactSourceType = z.infer<typeof TaxFactSourceTypeSchema>;

export const TAX_FACT_STATUSES = [
	"candidate",
	"extracted",
	"confirmed",
	"conflicting",
	"superseded",
	"rejected",
] as const;
export const TaxFactStatusSchema = z.enum(TAX_FACT_STATUSES);
export type TaxFactStatus = z.infer<typeof TaxFactStatusSchema>;

export const TAX_VALUE_TYPES = [
	"money",
	"number",
	"percent",
	"boolean",
	"date",
	"string",
	"enum",
] as const;
export const TaxValueTypeSchema = z.enum(TAX_VALUE_TYPES);
export type TaxValueType = z.infer<typeof TaxValueTypeSchema>;

export const TAX_EXTRACTION_METHODS = [
	"parser",
	"classifier",
	"manual",
	"financial_data",
	"agent",
	"llm",
] as const;
export const TaxExtractionMethodSchema = z.enum(TAX_EXTRACTION_METHODS);
export type TaxExtractionMethod = z.infer<typeof TaxExtractionMethodSchema>;

export const TAX_DOCUMENT_PROCESSING_STATES = [
	"uploaded",
	"processing",
	"parsed",
	"needs_review",
	"complete",
	"failed",
] as const;
export const TaxDocumentProcessingStateSchema = z.enum(
	TAX_DOCUMENT_PROCESSING_STATES,
);
export type TaxDocumentProcessingState = z.infer<
	typeof TaxDocumentProcessingStateSchema
>;

export const TAX_DOCUMENT_SOURCES = ["upload", "manual"] as const;
export const TaxDocumentSourceSchema = z.enum(TAX_DOCUMENT_SOURCES);
export type TaxDocumentSource = z.infer<typeof TaxDocumentSourceSchema>;

export const TAX_DOCUMENT_CATEGORIES = [
	"wage",
	"investment",
	"mortgage",
	"education",
	"retirement",
	"healthcare",
	"prior_return",
	"donation",
	"rental",
	"equity",
	"business",
	"other",
] as const;
export const TaxDocumentCategorySchema = z.enum(TAX_DOCUMENT_CATEGORIES);
export type TaxDocumentCategory = z.infer<typeof TaxDocumentCategorySchema>;

export const TAX_FORM_TYPES = [
	"W-2",
	"1099-INT",
	"1099-DIV",
	"1099-B",
	"1099-NEC",
	"1099-MISC",
	"1099-K",
	"1098",
	"1098-E",
	"1098-T",
	"5498",
	"5498-SA",
	"K-1",
	"1040",
	"other",
] as const;
export const TaxFormTypeSchema = z.enum(TAX_FORM_TYPES);
export type TaxFormType = z.infer<typeof TaxFormTypeSchema>;

export const TAX_REVIEW_STATUSES = ["none", "pending", "reviewed"] as const;
export const TaxReviewStatusSchema = z.enum(TAX_REVIEW_STATUSES);
export type TaxReviewStatus = z.infer<typeof TaxReviewStatusSchema>;

export const TAX_CONFLICT_RESOLUTIONS = [
	"open",
	"accepted_document",
	"accepted_manual",
	"accepted_financial",
	"split",
	"dismissed",
] as const;
export const TaxConflictResolutionSchema = z.enum(TAX_CONFLICT_RESOLUTIONS);
export type TaxConflictResolution = z.infer<typeof TaxConflictResolutionSchema>;

export const TAX_ESTIMATE_DIRECTIONS = [
	"refund",
	"owed",
	"even",
	"insufficient",
] as const;
export const TaxEstimateDirectionSchema = z.enum(TAX_ESTIMATE_DIRECTIONS);
export type TaxEstimateDirection = z.infer<typeof TaxEstimateDirectionSchema>;

export const TAX_ALLOWED_MIME_TYPES = [
	"application/pdf",
	"image/png",
	"image/jpeg",
	"image/webp",
	"image/heic",
	"image/heif",
] as const;
export const TaxAllowedMimeTypeSchema = z.enum(TAX_ALLOWED_MIME_TYPES);
export type TaxAllowedMimeType = z.infer<typeof TaxAllowedMimeTypeSchema>;
