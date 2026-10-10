import { z } from "zod";

export const ONBOARDING_CHANNELS = {
	getState: "onboarding:getState",
	markSeen: "onboarding:markSeen",
	markCompleted: "onboarding:markCompleted",
	markSkipped: "onboarding:markSkipped",
	markRecoveryEmailSkipped: "onboarding:markRecoveryEmailSkipped",
	reset: "onboarding:reset",
	getOnboardingProfile: "onboarding:getOnboardingProfile",
	saveOnboardingProfile: "onboarding:saveOnboardingProfile",
} as const;

export const DESKTOP_ONBOARDING_VERSION = "4" as const;

export const DesktopOnboardingStateSchema = z.object({
	version: z.string(),
	shouldShow: z.boolean(),
	seenAt: z.string().nullable(),
	completedAt: z.string().nullable(),
	skippedAt: z.string().nullable(),
});

export type DesktopOnboardingState = z.infer<
	typeof DesktopOnboardingStateSchema
>;

export const OnboardingActionResultSchema = z.object({
	ok: z.boolean(),
});

export type OnboardingActionResult = z.infer<
	typeof OnboardingActionResultSchema
>;

export const ONBOARDING_AGE_MIN = 0;
export const ONBOARDING_AGE_MAX = 300;

export const onboardingAgeSchema = z
	.number()
	.int()
	.min(ONBOARDING_AGE_MIN)
	.max(ONBOARDING_AGE_MAX);

export const SaveOnboardingProfileInputSchema = z.object({
	currentAge: onboardingAgeSchema.optional(),
	retirementAge: onboardingAgeSchema.optional(),
});

export type SaveOnboardingProfileInput = z.infer<
	typeof SaveOnboardingProfileInputSchema
>;

export const OnboardingProfileSchema = z.object({
	currentAge: onboardingAgeSchema.nullable(),
	retirementAge: onboardingAgeSchema.nullable(),
});

export type OnboardingProfile = z.infer<typeof OnboardingProfileSchema>;
