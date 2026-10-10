import {
	onboardingAgeSchema,
	SaveOnboardingProfileInputSchema,
} from "@moat/contracts";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { userDatabaseActor, withElevatedServiceActor } from "../db-actor";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";

const completeInitialOnboardingSchema = z.object({
	goals: z.array(z.string()).optional(),
	experienceLevel: z.string().optional(),
	plaidConnected: z.boolean().default(false),
	currentAge: onboardingAgeSchema.optional(),
	monthlyIncome: z.number().optional(),
	monthlyExpenses: z.number().optional(),
	retirementAge: onboardingAgeSchema.optional(),
	invests: z.boolean().optional(),
	referralSource: z.string().optional(),
	referralSourceOther: z.string().optional(),
});

const saveOnboardingGoalsSchema = z.object({
	goals: z.array(z.string()),
});

const saveOnboardingReferralSchema = z.object({
	referralSource: z.string().optional(),
	referralSourceOther: z.string().optional(),
});

export const onboarding = {
	// ─── Save onboarding goals when user clicks Next on step 1 ───────────────
	saveOnboardingGoals: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { goals } = saveOnboardingGoalsSchema.parse(body);
			const { userId } = ctx;

			await ctx.db.userSettings.upsert({
				where: { userId },
				create: { userId, onboardingGoals: goals },
				update: { onboardingGoals: goals },
			});

			return { success: true };
		},
	),

	// ─── Save profile inputs (age / retirement age) ───────────────────────────────────
	saveOnboardingProfile: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = SaveOnboardingProfileInputSchema.parse(body);
			const { userId } = ctx;

			await ctx.db.userSettings.upsert({
				where: { userId },
				create: {
					userId,
					currentAge: input.currentAge,
					retirementAge: input.retirementAge,
				},
				update: {
					currentAge: input.currentAge,
					retirementAge: input.retirementAge,
				},
			});

			return { success: true };
		},
	),

	// ─── Save referral source ─────────────────────────────────────────────────
	saveOnboardingReferral: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = saveOnboardingReferralSchema.parse(body);
			const { userId } = ctx;

			await ctx.db.userSettings.upsert({
				where: { userId },
				create: {
					userId,
					referralSource: input.referralSource,
					referralSourceOther: input.referralSourceOther,
				},
				update: {
					referralSource: input.referralSource,
					referralSourceOther: input.referralSourceOther,
				},
			});

			return { success: true };
		},
	),

	// ─── Get saved onboarding data ──────────────────────────────────────────────
	getOnboardingData: withAuth(async (ctx: AuthenticatedContext) => {
		const { userId } = ctx;

		const settings = await ctx.db.userSettings.findUnique({
			where: { userId },
			select: {
				hasCompletedInitialOnboarding: true,
				onboardingGoals: true,
				currentAge: true,
				retirementAge: true,
				referralSource: true,
				referralSourceOther: true,
			},
		});

		return {
			hasCompletedInitialOnboarding:
				settings?.hasCompletedInitialOnboarding ?? false,
			goals: settings?.onboardingGoals ?? [],
			currentAge: settings?.currentAge ?? null,
			retirementAge: settings?.retirementAge ?? null,
			referralSource: settings?.referralSource ?? null,
			referralSourceOther: settings?.referralSourceOther ?? null,
		};
	}),

	// ─── Complete initial onboarding flow ─────────────────────────────────────────
	completeInitialOnboarding: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = completeInitialOnboardingSchema.parse(body);
			const { userId } = ctx;

			// Persist all collected onboarding data
			await ctx.db.userSettings.upsert({
				where: { userId },
				create: {
					userId,
					hasCompletedInitialOnboarding: true,
					onboardingGoals: input.goals ?? [],
					currentAge: input.currentAge,
					retirementAge: input.retirementAge,
					referralSource: input.referralSource,
					referralSourceOther: input.referralSourceOther,
				},
				update: {
					hasCompletedInitialOnboarding: true,
					onboardingGoals: input.goals ?? [],
					currentAge: input.currentAge,
					retirementAge: input.retirementAge,
					referralSource: input.referralSource,
					referralSourceOther: input.referralSourceOther,
				},
			});

			logger.info("User completed initial onboarding", {
				userId,
				feature: "onboarding",
				plaidConnected: input.plaidConnected,
				goals: input.goals?.length ?? 0,
			});

			return { success: true };
		},
	),
};
