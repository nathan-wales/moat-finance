import type { Prisma, PrismaClient } from "../../../generated/prisma";

export const RETAIL_SYNC_TOUR_VERSION = 1;

export type ExtensionMetadata = {
	retailSyncTourCompletedAt?: string;
	retailSyncTourVersion?: number;
};

export type RetailSyncTourState = {
	completed: boolean;
	version: number;
};

type UserSettingsClient = Pick<PrismaClient, "userSettings">;

function toPrismaJson(value: ExtensionMetadata): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

export function parseExtensionMetadata(
	value: Prisma.JsonValue | null | undefined,
): ExtensionMetadata {
	if (!value || typeof value !== "object" || Array.isArray(value)) {
		return {};
	}

	const record = value as Record<string, unknown>;
	const completedAt = record.retailSyncTourCompletedAt;
	const version = record.retailSyncTourVersion;

	return {
		...(typeof completedAt === "string" && completedAt.length > 0
			? { retailSyncTourCompletedAt: completedAt }
			: {}),
		...(typeof version === "number" && Number.isInteger(version)
			? { retailSyncTourVersion: version }
			: {}),
	};
}

export function getRetailSyncTourState(
	metadata: ExtensionMetadata,
	currentVersion = RETAIL_SYNC_TOUR_VERSION,
): RetailSyncTourState {
	const completed =
		Boolean(metadata.retailSyncTourCompletedAt) &&
		(metadata.retailSyncTourVersion ?? 0) >= currentVersion;

	return {
		completed,
		version: currentVersion,
	};
}

export async function getRetailSyncTourStateForUser(
	db: UserSettingsClient,
	userId: string,
): Promise<RetailSyncTourState> {
	const settings = await db.userSettings.findUnique({
		where: { userId },
		select: { extensionMetadata: true },
	});

	return getRetailSyncTourState(
		parseExtensionMetadata(settings?.extensionMetadata),
	);
}

export async function completeRetailSyncTour(
	db: UserSettingsClient,
	userId: string,
	completedAt = new Date().toISOString(),
): Promise<RetailSyncTourState> {
	const settings = await db.userSettings.findUnique({
		where: { userId },
		select: { extensionMetadata: true },
	});
	const current = parseExtensionMetadata(settings?.extensionMetadata);
	const alreadyComplete = getRetailSyncTourState(current).completed;
	const next: ExtensionMetadata = {
		...current,
		retailSyncTourCompletedAt: alreadyComplete
			? current.retailSyncTourCompletedAt
			: completedAt,
		retailSyncTourVersion: Math.max(
			current.retailSyncTourVersion ?? 0,
			RETAIL_SYNC_TOUR_VERSION,
		),
	};

	await db.userSettings.upsert({
		where: { userId },
		create: {
			userId,
			extensionMetadata: toPrismaJson(next),
		},
		update: {
			extensionMetadata: toPrismaJson(next),
		},
	});

	return getRetailSyncTourState(next);
}
