import {
	DESKTOP_ONBOARDING_VERSION,
	type DesktopOnboardingState,
} from "@moat/contracts";
import type { UserMetadataRepository } from "@moat/data-access";

export const ONBOARDING_METADATA_KEYS = {
	seenAt: "desktop_onboarding_seen_at",
	completedAt: "desktop_onboarding_completed_at",
	skippedAt: "desktop_onboarding_skipped_at",
	recoveryEmailSkippedAt: "desktop_recovery_email_skipped_at",
	version: "desktop_onboarding_version",
} as const;

function parseJsonValue(raw: string | null): string | null {
	if (raw == null) return null;
	try {
		return JSON.parse(raw) as string;
	} catch {
		return raw;
	}
}

async function getMetadataValue(
	repo: UserMetadataRepository,
	userId: string,
	key: string,
): Promise<string | null> {
	const raw = await repo.get({ userId, key });
	return parseJsonValue(raw);
}

export async function getDesktopOnboardingState(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<DesktopOnboardingState> {
	const { userId, userMetadata } = input;
	const [seenAt, completedAt, skippedAt, version] = await Promise.all([
		getMetadataValue(userMetadata, userId, ONBOARDING_METADATA_KEYS.seenAt),
		getMetadataValue(
			userMetadata,
			userId,
			ONBOARDING_METADATA_KEYS.completedAt,
		),
		getMetadataValue(userMetadata, userId, ONBOARDING_METADATA_KEYS.skippedAt),
		getMetadataValue(userMetadata, userId, ONBOARDING_METADATA_KEYS.version),
	]);

	const resolvedVersion = version ?? DESKTOP_ONBOARDING_VERSION;
	const isCurrentVersion = resolvedVersion === DESKTOP_ONBOARDING_VERSION;
	const hasFinishedOrSkipped = completedAt != null || skippedAt != null;
	const shouldShow = !isCurrentVersion || !hasFinishedOrSkipped;

	return {
		version: resolvedVersion,
		shouldShow,
		seenAt,
		completedAt,
		skippedAt,
	};
}

function jsonValue(value: string): string {
	return JSON.stringify(value);
}

export async function markDesktopOnboardingSeen(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<void> {
	const now = new Date().toISOString();
	await Promise.all([
		input.userMetadata.upsert({
			userId: input.userId,
			key: ONBOARDING_METADATA_KEYS.seenAt,
			valueJson: jsonValue(now),
		}),
		input.userMetadata.upsert({
			userId: input.userId,
			key: ONBOARDING_METADATA_KEYS.version,
			valueJson: jsonValue(DESKTOP_ONBOARDING_VERSION),
		}),
	]);
}

export async function markDesktopOnboardingCompleted(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<void> {
	const now = new Date().toISOString();
	await markDesktopOnboardingSeen(input);
	await input.userMetadata.upsert({
		userId: input.userId,
		key: ONBOARDING_METADATA_KEYS.completedAt,
		valueJson: jsonValue(now),
	});
}

export async function markDesktopOnboardingSkipped(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<void> {
	const now = new Date().toISOString();
	await markDesktopOnboardingSeen(input);
	await input.userMetadata.upsert({
		userId: input.userId,
		key: ONBOARDING_METADATA_KEYS.skippedAt,
		valueJson: jsonValue(now),
	});
}

export async function markDesktopRecoveryEmailSkipped(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<void> {
	const now = new Date().toISOString();
	await markDesktopOnboardingSeen(input);
	await input.userMetadata.upsert({
		userId: input.userId,
		key: ONBOARDING_METADATA_KEYS.recoveryEmailSkippedAt,
		valueJson: jsonValue(now),
	});
}

export async function resetDesktopOnboarding(input: {
	userId: string;
	userMetadata: UserMetadataRepository;
}): Promise<void> {
	await Promise.all(
		Object.values(ONBOARDING_METADATA_KEYS).map((key) =>
			input.userMetadata.delete({ userId: input.userId, key }),
		),
	);
}
