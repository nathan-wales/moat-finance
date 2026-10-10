import { z } from "zod";
import { TaxEstimateDirectionSchema } from "./enums";

export const TaxReadinessCategoryIdSchema = z.enum([
	"identity",
	"employment",
	"investment",
	"retirement",
	"real_estate",
	"business",
	"healthcare",
	"education",
	"deductions",
	"credits",
	"estimated_payments",
]);
export type TaxReadinessCategoryId = z.infer<
	typeof TaxReadinessCategoryIdSchema
>;

export const TaxReadinessItemSchema = z
	.object({
		id: z.string().min(1),
		categoryId: TaxReadinessCategoryIdSchema,
		severity: z.enum(["missing", "unresolved", "review"]),
		title: z.string(),
		detail: z.string(),
		reason: z.string(),
	})
	.strict();
export type TaxReadinessItem = z.infer<typeof TaxReadinessItemSchema>;

export const TaxReadinessCategorySchema = z
	.object({
		id: TaxReadinessCategoryIdSchema,
		label: z.string(),
		relevant: z.boolean(),
		complete: z.boolean(),
		relevanceReason: z.string(),
		withheldReason: z.string().optional(),
	})
	.strict();
export type TaxReadinessCategory = z.infer<typeof TaxReadinessCategorySchema>;

export const TaxReadinessSchema = z
	.object({
		taxYear: z.number().int(),
		score: z.number().min(0).max(100),
		formula: z.string(),
		categories: z.array(TaxReadinessCategorySchema),
		missingItems: z.array(TaxReadinessItemSchema),
		unresolvedItems: z.array(TaxReadinessItemSchema),
		reviewItems: z.array(TaxReadinessItemSchema),
	})
	.strict();
export type TaxReadiness = z.infer<typeof TaxReadinessSchema>;

export const TaxEstimateSchema = z
	.object({
		direction: TaxEstimateDirectionSchema,
		amount: z.number().nullable(),
		label: z.string(),
		confidence: z.enum(["low", "medium", "high"]),
	})
	.strict();
export type TaxEstimate = z.infer<typeof TaxEstimateSchema>;
