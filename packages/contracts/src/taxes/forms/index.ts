import { z } from "zod";

export const FORM_SCHEMA_VERSION = "2026-09-18";

export const W2FormSchema = z
	.object({
		employerName: z.string().optional(),
		employerEin: z.string().optional(),
		employerAddress: z.string().optional(),
		employeeName: z.string().optional(),
		employeeSsn: z.string().optional(),
		employeeAddress: z.string().optional(),
		wages: z.number().optional(),
		federalWithholding: z.number().optional(),
		socialSecurityWages: z.number().optional(),
		socialSecurityTax: z.number().optional(),
		medicareWages: z.number().optional(),
		medicareTax: z.number().optional(),
		stateWages: z.number().optional(),
		stateTax: z.number().optional(),
		localWages: z.number().optional(),
		localTax: z.number().optional(),
		retirementPlan: z.boolean().optional(),
		dependentCareBenefits: z.number().optional(),
		box12: z
			.array(
				z
					.object({
						code: z.string(),
						amount: z.number().optional(),
					})
					.strict(),
			)
			.optional(),
		box14: z
			.array(
				z
					.object({
						label: z.string(),
						amount: z.number().optional(),
					})
					.strict(),
			)
			.optional(),
	})
	.strict();
export type W2Form = z.infer<typeof W2FormSchema>;

export const Form1099IntSchema = z
	.object({
		payerName: z.string().optional(),
		interestIncome: z.number().optional(),
		earlyWithdrawalPenalty: z.number().optional(),
		usSavingsBondInterest: z.number().optional(),
		federalWithholding: z.number().optional(),
		taxExemptInterest: z.number().optional(),
	})
	.strict();
export type Form1099Int = z.infer<typeof Form1099IntSchema>;

export const Form1099DivSchema = z
	.object({
		payerName: z.string().optional(),
		ordinaryDividends: z.number().optional(),
		qualifiedDividends: z.number().optional(),
		capitalGainDistributions: z.number().optional(),
		section199ADividends: z.number().optional(),
		foreignTaxPaid: z.number().optional(),
		federalWithholding: z.number().optional(),
	})
	.strict();
export type Form1099Div = z.infer<typeof Form1099DivSchema>;

export const Form1099BLotSchema = z
	.object({
		description: z.string().optional(),
		quantity: z.number().optional(),
		acquisitionDate: z.string().optional(),
		dispositionDate: z.string().optional(),
		proceeds: z.number().optional(),
		costBasis: z.number().optional(),
		washSaleAdjustment: z.number().optional(),
		term: z.enum(["short", "long"]).optional(),
		covered: z.enum(["covered", "noncovered"]).optional(),
		gainLoss: z.number().optional(),
		missingBasis: z.boolean().optional(),
	})
	.strict();
export type Form1099BLot = z.infer<typeof Form1099BLotSchema>;

export const Form1099BSchema = z
	.object({
		payerName: z.string().optional(),
		lots: z.array(Form1099BLotSchema).optional(),
		shortTermProceeds: z.number().optional(),
		shortTermBasis: z.number().optional(),
		longTermProceeds: z.number().optional(),
		longTermBasis: z.number().optional(),
		federalWithholding: z.number().optional(),
	})
	.strict();
export type Form1099B = z.infer<typeof Form1099BSchema>;

export const Form1099NecSchema = z
	.object({
		payerName: z.string().optional(),
		nonemployeeCompensation: z.number().optional(),
		federalWithholding: z.number().optional(),
	})
	.strict();
export type Form1099Nec = z.infer<typeof Form1099NecSchema>;

export const Form1099MiscSchema = z
	.object({
		payerName: z.string().optional(),
		rents: z.number().optional(),
		royalties: z.number().optional(),
		otherIncome: z.number().optional(),
		federalWithholding: z.number().optional(),
	})
	.strict();
export type Form1099Misc = z.infer<typeof Form1099MiscSchema>;

export const Form1099KSchema = z
	.object({
		payerName: z.string().optional(),
		grossAmount: z.number().optional(),
		cardNotPresent: z.number().optional(),
		federalWithholding: z.number().optional(),
	})
	.strict();
export type Form1099K = z.infer<typeof Form1099KSchema>;

export const Form1098Schema = z
	.object({
		lenderName: z.string().optional(),
		mortgageInterest: z.number().optional(),
		outstandingPrincipal: z.number().optional(),
		propertyAddress: z.string().optional(),
		points: z.number().optional(),
		propertyTaxes: z.number().optional(),
	})
	.strict();
export type Form1098 = z.infer<typeof Form1098Schema>;

export const Form1098ESchema = z
	.object({
		lenderName: z.string().optional(),
		studentLoanInterest: z.number().optional(),
	})
	.strict();
export type Form1098E = z.infer<typeof Form1098ESchema>;

export const Form5498Schema = z
	.object({
		trusteeName: z.string().optional(),
		iraContributions: z.number().optional(),
		rolloverContributions: z.number().optional(),
		fairMarketValue: z.number().optional(),
	})
	.strict();
export type Form5498 = z.infer<typeof Form5498Schema>;

export const Form5498SaSchema = z
	.object({
		trusteeName: z.string().optional(),
		hsaContributions: z.number().optional(),
		fairMarketValue: z.number().optional(),
	})
	.strict();
export type Form5498Sa = z.infer<typeof Form5498SaSchema>;

export const FormK1Schema = z
	.object({
		entityName: z.string().optional(),
		entityType: z.string().optional(),
		ordinaryIncome: z.number().optional(),
		interestIncome: z.number().optional(),
		dividends: z.number().optional(),
		guaranteedPayments: z.number().optional(),
	})
	.strict();
export type FormK1 = z.infer<typeof FormK1Schema>;

export const TAX_FORM_SCHEMAS = {
	"W-2": W2FormSchema,
	"1099-INT": Form1099IntSchema,
	"1099-DIV": Form1099DivSchema,
	"1099-B": Form1099BSchema,
	"1099-NEC": Form1099NecSchema,
	"1099-MISC": Form1099MiscSchema,
	"1099-K": Form1099KSchema,
	"1098": Form1098Schema,
	"1098-E": Form1098ESchema,
	"5498": Form5498Schema,
	"5498-SA": Form5498SaSchema,
	"K-1": FormK1Schema,
} as const;
