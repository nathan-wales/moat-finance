import { z } from "zod";

// ─── Channel Names ────────────────────────────────────────────────────────────

export const INVESTMENT_CHANNELS = {
	list: "investments:list",
	create: "investments:create",
	update: "investments:update",
	delete: "investments:delete",
} as const;

// ─── Schemas ──────────────────────────────────────────────────────────────────

const InvestmentTypeSchema = z.enum([
	"STOCKS",
	"ROTH_IRA",
	"FOUR01K",
	"HSA",
	"REAL_ESTATE",
	"OTHER",
]);

export const IpcInvestmentSchema = z.object({
	id: z.string(),
	type: InvestmentTypeSchema,
	name: z.string(),
	startingBalance: z.number(),
	monthlyContribution: z.number(),
	annualReturnRate: z.number(),
	notes: z.string().nullable().optional(),
	autoUpdateBalance: z.boolean().optional(),
	lastBalanceAccruedAt: z.string().nullable().optional(),
	nextBalanceAccrualDueAt: z.string().nullable().optional(),
	createdAt: z.string(),
	updatedAt: z.string(),
});
export type IpcInvestment = z.infer<typeof IpcInvestmentSchema>;

export const CreateInvestmentInputSchema = z.object({
	id: z.string().min(1).optional(),
	type: InvestmentTypeSchema,
	name: z.string().min(1),
	startingBalance: z.number().nonnegative().optional(),
	monthlyContribution: z.number().nonnegative().optional(),
	annualReturnRate: z.number().nonnegative().optional(),
	notes: z.string().nullable().optional(),
	autoUpdateBalance: z.boolean().optional(),
});
export type IpcCreateInvestmentInput = z.infer<
	typeof CreateInvestmentInputSchema
>;

export const UpdateInvestmentInputSchema = z.object({
	id: z.string(),
	type: InvestmentTypeSchema.optional(),
	name: z.string().min(1).optional(),
	startingBalance: z.number().nonnegative().optional(),
	monthlyContribution: z.number().nonnegative().optional(),
	annualReturnRate: z.number().nonnegative().optional(),
	notes: z.string().nullable().optional(),
	autoUpdateBalance: z.boolean().optional(),
});
export type IpcUpdateInvestmentInput = z.infer<
	typeof UpdateInvestmentInputSchema
>;

export const DeleteInvestmentInputSchema = z.object({
	id: z.string(),
});
export type IpcDeleteInvestmentInput = z.infer<
	typeof DeleteInvestmentInputSchema
>;
