import { z } from "zod";
import { mergeScenarios } from "~/server/services/demo/demo-merge.service";
import {
	deleteOverlayScenario,
	getScenariosOverlay,
	setActiveOverlayScenario,
	upsertOverlayScenario,
} from "~/server/services/demo/demo-overlay.service";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";

const ScenarioTypeEnum = z.enum([
	"CONSERVATIVE",
	"STANDARD",
	"AGGRESSIVE",
	"CUSTOM",
]);

const createScenarioInput = z.object({
	name: z.string().min(1),
	type: ScenarioTypeEnum,
	investmentReturn: z.number(),
	inflationRate: z.number(),
	salaryGrowth: z.number(),
	contributionChange: z.number(),
	expenseGrowth: z.number(),
});

const updateScenarioInput = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	investmentReturn: z.number().optional(),
	inflationRate: z.number().optional(),
	salaryGrowth: z.number().optional(),
	contributionChange: z.number().optional(),
	expenseGrowth: z.number().optional(),
	isActive: z.boolean().optional(),
});

const deleteScenarioInput = z.object({ id: z.string() });

const setActiveInput = z.object({ id: z.string().nullable() });

export const scenario = {
	getAll: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;
		if (ctx.isDemoMode) {
			const seeded = await ctx.db.forecastScenario.findMany({
				where: { userId },
				orderBy: { createdAt: "asc" },
			});
			if (!ctx.demoOverlaySessionKey) return seeded;
			const overlay = await getScenariosOverlay(ctx.demoOverlaySessionKey);
			return mergeScenarios(seeded, overlay);
		}
		return ctx.db.forecastScenario.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = createScenarioInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const now = new Date();
			const overlayScenario = {
				id: crypto.randomUUID(),
				userId: demoUserId,
				...input,
				isActive: false,
				createdAt: now,
				updatedAt: now,
				_isOverlay: true as const,
			};
			return upsertOverlayScenario(ctx.demoOverlaySessionKey, overlayScenario);
		}

		const userId = ctx.userId;
		return ctx.db.forecastScenario.create({
			data: { ...input, userId },
		});
	}),

	update: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = updateScenarioInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const seeded = await ctx.db.forecastScenario.findMany({
				where: { userId: demoUserId },
			});
			const overlay = await getScenariosOverlay(ctx.demoOverlaySessionKey);
			const merged = mergeScenarios(seeded, overlay);
			const existing = merged.find((s) => s.id === input.id);
			if (!existing) throw new Error("Scenario not found");
			const { id, ...data } = input;
			const updated = { ...existing, ...data, updatedAt: new Date() };
			return upsertOverlayScenario(ctx.demoOverlaySessionKey, updated);
		}

		const userId = ctx.userId;
		const { id, ...data } = input;
		return ctx.db.forecastScenario.update({
			where: { id, userId },
			data,
		});
	}),

	delete: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = deleteScenarioInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			await deleteOverlayScenario(ctx.demoOverlaySessionKey, input.id);
			return { id: input.id };
		}

		const userId = ctx.userId;
		return ctx.db.forecastScenario.delete({
			where: { id: input.id, userId },
		});
	}),

	setActive: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = setActiveInput.parse(body);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			await setActiveOverlayScenario(ctx.demoOverlaySessionKey, input.id);
			return { success: true };
		}

		const userId = ctx.userId;

		// Deactivate all
		await ctx.db.forecastScenario.updateMany({
			where: { userId },
			data: { isActive: false },
		});

		// Activate selected
		if (input.id) {
			await ctx.db.forecastScenario.update({
				where: { id: input.id, userId },
				data: { isActive: true },
			});
		}

		return { success: true };
	}),

	seedDefaults: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) {
			// Demo workspace already has seeded scenarios — nothing to do
			return { seeded: false };
		}

		const userId = ctx.userId;

		const existing = await ctx.db.forecastScenario.count({
			where: { userId },
		});

		if (existing > 0) return { seeded: false };

		await ctx.db.forecastScenario.createMany({
			data: [
				{
					userId,
					name: "Conservative",
					type: "CONSERVATIVE",
					investmentReturn: 0.04,
					inflationRate: 0.04,
					salaryGrowth: 0.01,
					contributionChange: 0,
					expenseGrowth: 0.04,
				},
				{
					userId,
					name: "Standard",
					type: "STANDARD",
					investmentReturn: 0.07,
					inflationRate: 0.03,
					salaryGrowth: 0.03,
					contributionChange: 0.02,
					expenseGrowth: 0.03,
					isActive: true,
				},
				{
					userId,
					name: "Aggressive",
					type: "AGGRESSIVE",
					investmentReturn: 0.1,
					inflationRate: 0.02,
					salaryGrowth: 0.06,
					contributionChange: 0.05,
					expenseGrowth: 0.02,
				},
			],
		});

		return { seeded: true };
	}),
};
