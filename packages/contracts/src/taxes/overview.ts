import { z } from "zod";
import { TaxDocumentSchema } from "./document";
import { TaxFactStatusSchema } from "./enums";
import { TaxEstimateSchema, TaxReadinessSchema } from "./readiness";
import { TaxDocumentStorageSchema } from "./storage";

export const TAX_OVERVIEW_METRIC_IDS = [
	"incomeIdentified",
	"taxesWithheld",
	"confirmedDeductions",
	"potentialDeductions",
	"capitalGains",
] as const;
export const TaxOverviewMetricIdSchema = z.enum(TAX_OVERVIEW_METRIC_IDS);
export type TaxOverviewMetricId = z.infer<typeof TaxOverviewMetricIdSchema>;

export const TaxAttentionItemSchema = z
	.object({
		id: z.string(),
		title: z.string(),
		detail: z.string(),
		severity: z.enum(["missing", "unresolved", "review"]),
	})
	.strict();
export type TaxAttentionItem = z.infer<typeof TaxAttentionItemSchema>;

export const TaxOverviewBreakdownItemSchema = z
	.object({
		id: z.string().min(1),
		label: z.string().min(1),
		amount: z.number(),
		status: TaxFactStatusSchema,
		source: z.string().min(1),
		documentId: z.string().min(1).optional(),
		transactionId: z.string().min(1).optional(),
	})
	.strict();
export type TaxOverviewBreakdownItem = z.infer<
	typeof TaxOverviewBreakdownItemSchema
>;

export const TaxOverviewBreakdownsSchema = z
	.object({
		incomeIdentified: z.array(TaxOverviewBreakdownItemSchema),
		taxesWithheld: z.array(TaxOverviewBreakdownItemSchema),
		confirmedDeductions: z.array(TaxOverviewBreakdownItemSchema),
		potentialDeductions: z.array(TaxOverviewBreakdownItemSchema),
		capitalGains: z.array(TaxOverviewBreakdownItemSchema),
	})
	.strict();
export type TaxOverviewBreakdowns = z.infer<typeof TaxOverviewBreakdownsSchema>;

export const TaxOverviewSchema = z
	.object({
		taxYear: z.number().int(),
		lastUpdated: z.string().nullable(),
		readiness: TaxReadinessSchema,
		documentsPresent: z.number().int().nonnegative(),
		documentsExpected: z.number().int().nonnegative(),
		incomeIdentified: z.number(),
		taxesWithheld: z.number(),
		potentialDeductions: z.number(),
		confirmedDeductions: z.number(),
		capitalGains: z.number(),
		breakdowns: TaxOverviewBreakdownsSchema,
		estimate: TaxEstimateSchema,
		attention: z.array(TaxAttentionItemSchema),
		recentDocuments: z.array(TaxDocumentSchema),
		hasAnyFacts: z.boolean(),
		hasAnyDocuments: z.boolean(),
		documentStorage: TaxDocumentStorageSchema,
	})
	.strict();
export type TaxOverview = z.infer<typeof TaxOverviewSchema>;

export const TaxYearSummarySchema = z
	.object({
		taxYear: z.number().int(),
		hasDocuments: z.boolean(),
		hasFacts: z.boolean(),
		documentCount: z.number().int().nonnegative(),
		factCount: z.number().int().nonnegative(),
	})
	.strict();
export type TaxYearSummary = z.infer<typeof TaxYearSummarySchema>;

export const TaxYearsResponseSchema = z
	.object({
		defaultYear: z.number().int(),
		years: z.array(TaxYearSummarySchema),
	})
	.strict();
export type TaxYearsResponse = z.infer<typeof TaxYearsResponseSchema>;
