// Shared retirement enums and value primitives.
//
// These live apart from `retirement.ts` so the standing-rule and policy schemas
// in `retirement-policies.ts` can reuse them without importing the lever union,
// which itself depends on the policies. `retirement.ts` re-exports everything
// here, so `@moat/contracts` consumers see one flat surface.

import { z } from "zod";

export const RetirementTaxTreatmentSchema = z.enum([
	"taxable",
	"taxDeferred",
	"taxFree",
]);
export type RetirementTaxTreatment = z.infer<
	typeof RetirementTaxTreatmentSchema
>;

export const RetirementCadenceSchema = z.enum(["monthly", "annual"]);
export type RetirementCadence = z.infer<typeof RetirementCadenceSchema>;

export const RetirementEssentialitySchema = z.enum(["essential", "flexible"]);
export type RetirementEssentiality = z.infer<
	typeof RetirementEssentialitySchema
>;

export const RetirementSpendingTreatmentSchema = z.enum([
	"remains",
	"disappears",
	"changes",
]);
export type RetirementSpendingTreatment = z.infer<
	typeof RetirementSpendingTreatmentSchema
>;

export const RetirementIncomeTaxTreatmentSchema = z.enum([
	"taxable",
	"taxFree",
	"ordinaryIncome",
]);
export type RetirementIncomeTaxTreatment = z.infer<
	typeof RetirementIncomeTaxTreatmentSchema
>;

export const RetirementScenarioSourceSchema = z.enum([
	"USER",
	"SUGGESTED",
	"AI",
	"GOAL_SEEK",
]);
export type RetirementScenarioSource = z.infer<
	typeof RetirementScenarioSourceSchema
>;

export const RetirementLeverCategorySchema = z.enum([
	"work",
	"savings",
	"spending",
	"investments",
	"socialSecurity",
	"housing",
	"lifeEvents",
	"healthcare",
	"insurance",
	"taxes",
	"custom",
]);
export type RetirementLeverCategory = z.infer<
	typeof RetirementLeverCategorySchema
>;

export const retirementAgeSchema = z.number().int().min(0).max(200);
export const retirementLabelSchema = z.string().min(1).max(80);
export const retirementPositiveAmountSchema = z
	.number()
	.positive()
	.max(1_000_000_000);
export const retirementSignedAmountSchema = z
	.number()
	.min(-1_000_000_000)
	.max(1_000_000_000);
export const retirementRateSchema = z.number().min(-1).max(1);
export const retirementShareSchema = z.number().min(0).max(1);

export const RetirementSpendingStageSchema = z.object({
	ageFrom: retirementAgeSchema,
	ageTo: retirementAgeSchema.nullable().optional(),
	monthlyAmount: z.number().min(0).max(10_000_000),
	label: z.string().max(60).optional(),
});
export type RetirementSpendingStage = z.infer<
	typeof RetirementSpendingStageSchema
>;
