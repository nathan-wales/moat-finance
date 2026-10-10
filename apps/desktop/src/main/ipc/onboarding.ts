import {
	DesktopOnboardingStateSchema,
	ONBOARDING_CHANNELS,
	OnboardingActionResultSchema,
	OnboardingProfileSchema,
	SaveOnboardingProfileInputSchema,
} from "@moat/contracts";
import {
	getSqliteOnboardingProfile,
	saveSqliteOnboardingProfile,
} from "@moat/db-sqlite";
import { ipcMain } from "electron";
import {
	getDesktopOnboardingState,
	markDesktopOnboardingCompleted,
	markDesktopOnboardingSeen,
	markDesktopOnboardingSkipped,
	markDesktopRecoveryEmailSkipped,
	resetDesktopOnboarding,
} from "../onboarding/desktop-onboarding";
import { getUnlockedDesktopDb } from "./vault-guard";

function getUserMetadataRepo() {
	const { appCtx } = getUnlockedDesktopDb();
	const userMetadata = appCtx.repositories.userMetadata;
	if (!userMetadata) {
		throw new Error("User metadata repository is not available");
	}
	return { userId: appCtx.userId, userMetadata };
}

export function registerOnboardingHandlers(): void {
	ipcMain.handle(ONBOARDING_CHANNELS.getState, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		const state = await getDesktopOnboardingState({ userId, userMetadata });
		return DesktopOnboardingStateSchema.parse(state);
	});

	ipcMain.handle(ONBOARDING_CHANNELS.markSeen, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		await markDesktopOnboardingSeen({ userId, userMetadata });
		return OnboardingActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(ONBOARDING_CHANNELS.markCompleted, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		await markDesktopOnboardingCompleted({ userId, userMetadata });
		return OnboardingActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(ONBOARDING_CHANNELS.markSkipped, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		await markDesktopOnboardingSkipped({ userId, userMetadata });
		return OnboardingActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(ONBOARDING_CHANNELS.markRecoveryEmailSkipped, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		await markDesktopRecoveryEmailSkipped({ userId, userMetadata });
		return OnboardingActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(ONBOARDING_CHANNELS.reset, async () => {
		const { userId, userMetadata } = getUserMetadataRepo();
		await resetDesktopOnboarding({ userId, userMetadata });
		return OnboardingActionResultSchema.parse({ ok: true });
	});

	ipcMain.handle(ONBOARDING_CHANNELS.getOnboardingProfile, async () => {
		const { db, appCtx } = getUnlockedDesktopDb();
		const profile = await getSqliteOnboardingProfile(db, appCtx.userId);
		return OnboardingProfileSchema.parse(profile);
	});

	ipcMain.handle(
		ONBOARDING_CHANNELS.saveOnboardingProfile,
		async (_event, rawInput: unknown) => {
			const input = SaveOnboardingProfileInputSchema.parse(rawInput);
			const { db, appCtx } = getUnlockedDesktopDb();
			const profile = await saveSqliteOnboardingProfile(
				db,
				appCtx.userId,
				input,
			);
			return OnboardingProfileSchema.parse(profile);
		},
	);
}
