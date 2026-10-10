import { z } from "zod";

// ─── Channel Names ────────────────────────────────────────────────────────────

export const REAL_ESTATE_CHANNELS = {
	list: "realEstate:list",
	create: "realEstate:create",
	update: "realEstate:update",
	delete: "realEstate:delete",
} as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const RealEstatePropertyTypeSchema = z.enum([
	"SINGLE_FAMILY",
	"MULTI_FAMILY",
	"CONDO",
	"COMMERCIAL",
	"LAND",
	"OTHER",
]);

const RealEstateUsageTypeSchema = z.enum([
	"PRIMARY_RESIDENCE",
	"RENTAL",
	"VACATION_HOME",
	"MIXED_USE",
]);

const RealEstateForecastScenarioSchema = z.enum([
	"MODERATE",
	"STANDARD",
	"AGGRESSIVE",
]);

const nullableNumber = () => z.number().nullable().optional();
const nullableInt = () => z.number().int().nullable().optional();
const nullableVacancyRate = () =>
	z.number().min(0).max(1).nullable().optional();

export const IpcRealEstateInvestmentSchema = z.object({
	id: z.string(),
	name: z.string(),
	propertyType: RealEstatePropertyTypeSchema,
	usageType: RealEstateUsageTypeSchema,
	purchasePrice: z.number().nullable(),
	purchaseDate: z.string().nullable(),
	downPayment: z.number().nullable(),
	closingCosts: z.number().nullable(),
	rehabCosts: z.number().nullable(),
	currentEstimatedValue: z.number(),
	currentLoanBalance: z.number(),
	interestRate: z.number().nullable(),
	loanTermYears: z.number().int().nullable(),
	remainingTermMonths: z.number().int().nullable(),
	monthlyMortgagePayment: z.number().nullable(),
	monthlyRent: z.number().nullable(),
	otherMonthlyIncome: z.number().nullable(),
	vacancyRate: z.number().nullable(),
	totalMonthlyExpenses: z.number().nullable(),
	monthlyPropertyTax: z.number().nullable(),
	monthlyInsurance: z.number().nullable(),
	monthlyHOA: z.number().nullable(),
	monthlyUtilities: z.number().nullable(),
	monthlyMaintenance: z.number().nullable(),
	monthlyManagement: z.number().nullable(),
	monthlyOtherExpenses: z.number().nullable(),
	appreciationRate: z.number().nullable(),
	expenseGrowthRate: z.number().nullable(),
	forecastScenario: RealEstateForecastScenarioSchema,
	linkedPlaidAccountId: z.string().nullable(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type IpcRealEstateInvestment = z.infer<
	typeof IpcRealEstateInvestmentSchema
>;

export const CreateRealEstateInputSchema = z.object({
	name: z.string().min(1),
	propertyType: RealEstatePropertyTypeSchema,
	usageType: RealEstateUsageTypeSchema,
	currentEstimatedValue: z.number().nonnegative(),
	currentLoanBalance: z.number().nonnegative(),
	purchasePrice: nullableNumber(),
	purchaseDate: z.string().nullable().optional(),
	downPayment: nullableNumber(),
	closingCosts: nullableNumber(),
	rehabCosts: nullableNumber(),
	interestRate: nullableNumber(),
	loanTermYears: nullableInt(),
	remainingTermMonths: nullableInt(),
	monthlyMortgagePayment: nullableNumber(),
	monthlyRent: nullableNumber(),
	otherMonthlyIncome: nullableNumber(),
	vacancyRate: nullableVacancyRate(),
	totalMonthlyExpenses: nullableNumber(),
	monthlyPropertyTax: nullableNumber(),
	monthlyInsurance: nullableNumber(),
	monthlyHOA: nullableNumber(),
	monthlyUtilities: nullableNumber(),
	monthlyMaintenance: nullableNumber(),
	monthlyManagement: nullableNumber(),
	monthlyOtherExpenses: nullableNumber(),
	appreciationRate: nullableNumber(),
	expenseGrowthRate: nullableNumber(),
	forecastScenario: RealEstateForecastScenarioSchema.optional(),
	linkedPlaidAccountId: z.string().nullable().optional(),
});
export type IpcCreateRealEstateInput = z.infer<
	typeof CreateRealEstateInputSchema
>;

export const UpdateRealEstateInputSchema =
	CreateRealEstateInputSchema.partial().extend({ id: z.string() });
export type IpcUpdateRealEstateInput = z.infer<
	typeof UpdateRealEstateInputSchema
>;

export const DeleteRealEstateInputSchema = z.object({
	id: z.string(),
});
export type IpcDeleteRealEstateInput = z.infer<
	typeof DeleteRealEstateInputSchema
>;
