import { z } from "zod";

export const SCENARIO_CHANNELS = {
	list: "scenarios:list",
	seedDefaults: "scenarios:seedDefaults",
	create: "scenarios:create",
	update: "scenarios:update",
	delete: "scenarios:delete",
	setActive: "scenarios:setActive",
} as const;

export const ScenarioTypeSchema = z.enum([
	"CONSERVATIVE",
	"STANDARD",
	"AGGRESSIVE",
	"CUSTOM",
]);

export const IpcForecastScenarioSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: ScenarioTypeSchema.or(z.string()),
	investmentReturn: z.number(),
	inflationRate: z.number(),
	salaryGrowth: z.number(),
	contributionChange: z.number(),
	expenseGrowth: z.number(),
	isActive: z.boolean(),
});

export const CreateScenarioInputSchema = z.object({
	name: z.string().min(1),
	type: ScenarioTypeSchema,
	investmentReturn: z.number(),
	inflationRate: z.number(),
	salaryGrowth: z.number(),
	contributionChange: z.number(),
	expenseGrowth: z.number(),
});

export const UpdateScenarioInputSchema = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	investmentReturn: z.number().optional(),
	inflationRate: z.number().optional(),
	salaryGrowth: z.number().optional(),
	contributionChange: z.number().optional(),
	expenseGrowth: z.number().optional(),
	isActive: z.boolean().optional(),
});

export const DeleteScenarioInputSchema = z.object({
	id: z.string(),
});

export const SetActiveScenarioInputSchema = z.object({
	id: z.string().nullable(),
});

export const SeedDefaultScenariosResponseSchema = z.object({
	seeded: z.boolean(),
});

export type IpcScenarioType = z.infer<typeof ScenarioTypeSchema>;
export type IpcForecastScenario = z.infer<typeof IpcForecastScenarioSchema>;
export type IpcCreateScenarioInput = z.infer<typeof CreateScenarioInputSchema>;
export type IpcUpdateScenarioInput = z.infer<typeof UpdateScenarioInputSchema>;
export type IpcDeleteScenarioInput = z.infer<typeof DeleteScenarioInputSchema>;
export type IpcSetActiveScenarioInput = z.infer<
	typeof SetActiveScenarioInputSchema
>;
export type IpcSeedDefaultScenariosResponse = z.infer<
	typeof SeedDefaultScenariosResponseSchema
>;
