import { z } from "zod";
import { TaxDocumentSchema } from "./document";
import { TaxFactStatusSchema } from "./enums";
import { TaxFactProvenanceSchema, TaxFactSchema } from "./fact";

export const TaxProfileRowSchema = z
	.object({
		id: z.string(),
		label: z.string(),
		value: z.unknown(),
		valueType: z.string(),
		displayValue: z.string(),
		status: TaxFactStatusSchema,
		source: z.string(),
		provenance: TaxFactProvenanceSchema,
	})
	.strict();
export type TaxProfileRow = z.infer<typeof TaxProfileRowSchema>;

export const TaxProfileSectionSchema = z
	.object({
		id: z.string(),
		label: z.string(),
		rows: z.array(TaxProfileRowSchema),
	})
	.strict();
export type TaxProfileSection = z.infer<typeof TaxProfileSectionSchema>;

export const TaxYearProfileSchema = z
	.object({
		taxYear: z.number().int(),
		sections: z.array(TaxProfileSectionSchema),
		facts: z.array(TaxFactSchema),
		documents: z.array(TaxDocumentSchema),
		missingInformation: z.array(z.string()),
	})
	.strict();
export type TaxYearProfile = z.infer<typeof TaxYearProfileSchema>;

export const TaxAgentContextSchema = z
	.object({
		taxYear: z.number().int(),
		filingStatus: z.string().nullable(),
		household: z
			.object({
				taxpayer: z.string().nullable(),
				spouse: z.string().nullable(),
				dependentsCount: z.number().int().nullable(),
			})
			.strict(),
		employment: z.array(
			z
				.object({
					issuer: z.string(),
					wages: z.number().nullable(),
					federalWithholding: z.number().nullable(),
				})
				.strict(),
		),
		investments: z.array(
			z
				.object({
					issuer: z.string(),
					dividends: z.number().nullable(),
					interest: z.number().nullable(),
					shortTermGain: z.number().nullable(),
					longTermGain: z.number().nullable(),
				})
				.strict(),
		),
		realEstate: z.array(
			z
				.object({
					label: z.string(),
					usageType: z.string().nullable(),
					mortgageInterest: z.number().nullable(),
				})
				.strict(),
		),
		deductions: z
			.object({
				confirmed: z.number(),
				potential: z.number(),
			})
			.strict(),
		documentsPresent: z.array(z.string()),
		missingExpected: z.array(z.string()),
		unresolvedQuestions: z.array(z.string()),
	})
	.strict();
export type TaxAgentContext = z.infer<typeof TaxAgentContextSchema>;
