import { z } from "zod";

export const SETTINGS_CHANNELS = {
	getFinancialProfile: "settings:getFinancialProfile",
	updateFinancialProfile: "settings:updateFinancialProfile",
} as const;

export const FinancialProfileSchema = z.object({
	monthlyIncome: z.number().nullable(),
	monthlyExpenses: z.number().nullable(),
	savingsGoal: z.number().nullable(),
	currency: z.string().default("USD"),
});

export const UpdateFinancialProfileInputSchema = FinancialProfileSchema.partial();

export type IpcFinancialProfile = z.infer<typeof FinancialProfileSchema>;
