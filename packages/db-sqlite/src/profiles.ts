import { randomUUID } from "node:crypto";
import {
	type BusinessType,
	BusinessTypeSchema,
	CreateProfileInputSchema,
	type ProfileKind,
	ProfileKindSchema,
} from "@moat/contracts";
import type { SqliteDbClient } from "./db-client";

export type LocalProfileKind = ProfileKind;

function parseKind(value: string): LocalProfileKind {
	const parsed = ProfileKindSchema.safeParse(value);
	if (!parsed.success) return "PERSONAL";
	return parsed.data;
}

function parseBusinessType(value: string | null): BusinessType | null {
	const parsed = BusinessTypeSchema.safeParse(value);
	if (!parsed.success) return null;
	return parsed.data;
}

export type LocalProfileSummary = {
	id: string;
	kind: LocalProfileKind;
	displayName: string;
	profileUserId: string;
	isActive: boolean;
	isPersonal: boolean;
	businessType: BusinessType | null;
};

const OWNER_USER_ID = "local-user";
const ACTIVE_PROFILE_META_KEY = "activeProfileId";

type ProfileRow = {
	id: string;
	kind: string;
	displayName: string;
	profileUserId: string;
	businessType: string | null;
};

function toSummary(
	row: ProfileRow,
	isActive: boolean,
	isPersonal: boolean,
): LocalProfileSummary {
	return {
		id: row.id,
		kind: parseKind(row.kind),
		displayName: row.displayName,
		profileUserId: row.profileUserId,
		isPersonal,
		isActive,
		businessType: parseBusinessType(row.businessType),
	};
}

async function getActiveProfileId(db: SqliteDbClient): Promise<string | null> {
	const rows = await db.$queryRaw<Array<{ valueJson: string }>>`
		SELECT "valueJson" FROM "UserMetadata"
		WHERE "userId" = ${OWNER_USER_ID} AND "key" = ${ACTIVE_PROFILE_META_KEY}
		LIMIT 1
	`;
	const raw = rows[0]?.valueJson;
	if (!raw) return null;
	try {
		const parsed = JSON.parse(raw) as unknown;
		return typeof parsed === "string" ? parsed : null;
	} catch {
		return null;
	}
}

async function setActiveProfileId(
	db: SqliteDbClient,
	profileId: string,
): Promise<void> {
	const now = new Date().toISOString();
	const valueJson = JSON.stringify(profileId);
	const id = `meta_${OWNER_USER_ID}_${ACTIVE_PROFILE_META_KEY}`;
	await db.$executeRaw`
		INSERT INTO "UserMetadata" ("id", "userId", "key", "valueJson", "createdAt", "updatedAt")
		VALUES (${id}, ${OWNER_USER_ID}, ${ACTIVE_PROFILE_META_KEY}, ${valueJson}, ${now}, ${now})
		ON CONFLICT("userId", "key") DO UPDATE SET
			"valueJson" = excluded."valueJson",
			"updatedAt" = excluded."updatedAt"
	`;
}

export async function resolveActiveProfileUserId(
	db: SqliteDbClient,
): Promise<string> {
	const activeId = await getActiveProfileId(db);
	if (!activeId) return OWNER_USER_ID;

	const rows = await db.$queryRaw<Array<{ profileUserId: string }>>`
		SELECT "profileUserId" FROM "ProfileLink"
		WHERE "id" = ${activeId}
			AND "ownerUserId" = ${OWNER_USER_ID}
			AND "archivedAt" IS NULL
		LIMIT 1
	`;
	return rows[0]?.profileUserId ?? OWNER_USER_ID;
}

export async function listLocalProfiles(
	db: SqliteDbClient,
): Promise<LocalProfileSummary[]> {
	const rows = await db.$queryRaw<ProfileRow[]>`
		SELECT "id", "kind", "displayName", "profileUserId", "businessType"
		FROM "ProfileLink"
		WHERE "ownerUserId" = ${OWNER_USER_ID}
			AND "archivedAt" IS NULL
		ORDER BY
			CASE "kind"
				WHEN 'PERSONAL' THEN 0
				WHEN 'FAMILY' THEN 1
				ELSE 2
			END,
			"createdAt" ASC
	`;

	const activeId = await getActiveProfileId(db);
	const personalRow = rows.find((row) => row.profileUserId === OWNER_USER_ID);
	const childRows = rows.filter((row) => row.profileUserId !== OWNER_USER_ID);
	const activeChildId =
		activeId && childRows.some((row) => row.id === activeId) ? activeId : null;

	const personal: LocalProfileSummary = personalRow
		? toSummary(personalRow, activeChildId === null, true)
		: {
				id: `pf_${OWNER_USER_ID}`,
				kind: "PERSONAL",
				displayName: "Personal",
				profileUserId: OWNER_USER_ID,
				isPersonal: true,
				isActive: activeChildId === null,
				businessType: null,
			};

	const children = childRows.map((row) =>
		toSummary(row, row.id === activeChildId, false),
	);

	return [personal, ...children];
}

export async function createLocalChildProfile(
	db: SqliteDbClient,
	input: {
		kind: Exclude<LocalProfileKind, "PERSONAL">;
		displayName: string;
		businessType?: BusinessType;
	},
): Promise<LocalProfileSummary> {
	const parsed = CreateProfileInputSchema.parse(input);
	const displayName = parsed.displayName;
	const profileUserId = `local-pf-${randomUUID()}`;
	const linkId = randomUUID();
	const now = new Date().toISOString();
	const businessType = parsed.businessType ?? null;

	await db.$executeRaw`
		INSERT INTO "LocalUser" ("id", "createdAt", "updatedAt")
		VALUES (${profileUserId}, ${now}, ${now})
	`;
	await db.$executeRaw`
		INSERT INTO "ProfileLink" (
			"id", "ownerUserId", "profileUserId", "kind", "displayName",
			"businessType", "createdAt"
		)
		VALUES (
			${linkId}, ${OWNER_USER_ID}, ${profileUserId}, ${parsed.kind}, ${displayName},
			${businessType}, ${now}
		)
	`;
	await setActiveProfileId(db, linkId);

	return {
		id: linkId,
		kind: parsed.kind,
		displayName,
		profileUserId,
		isPersonal: false,
		isActive: true,
		businessType,
	};
}

export async function updateLocalProfile(
	db: SqliteDbClient,
	input: {
		id: string;
		businessType?: BusinessType;
	},
): Promise<LocalProfileSummary> {
	const profiles = await listLocalProfiles(db);
	const existing = profiles.find((profile) => profile.id === input.id);
	if (!existing) {
		throw new Error("Profile not found");
	}

	if (input.businessType !== undefined && existing.kind !== "BUSINESS") {
		throw new Error("Business type is only valid for business profiles");
	}

	if (input.businessType !== undefined) {
		await db.$executeRaw`
			UPDATE "ProfileLink"
			SET "businessType" = ${input.businessType}
			WHERE "id" = ${input.id}
				AND "ownerUserId" = ${OWNER_USER_ID}
				AND "archivedAt" IS NULL
		`;
	}

	const updated = (await listLocalProfiles(db)).find(
		(profile) => profile.id === input.id,
	);
	if (!updated) {
		throw new Error("Profile not found");
	}
	return updated;
}

export async function switchLocalProfile(
	db: SqliteDbClient,
	profileId: string,
): Promise<LocalProfileSummary> {
	const personalPlaceholderId = `pf_${OWNER_USER_ID}`;
	if (profileId === personalPlaceholderId || profileId === OWNER_USER_ID) {
		await setActiveProfileId(db, personalPlaceholderId);
		return {
			id: personalPlaceholderId,
			kind: "PERSONAL",
			displayName: "Personal",
			profileUserId: OWNER_USER_ID,
			isPersonal: true,
			isActive: true,
			businessType: null,
		};
	}

	const rows = await db.$queryRaw<ProfileRow[]>`
		SELECT "id", "kind", "displayName", "profileUserId", "businessType"
		FROM "ProfileLink"
		WHERE "id" = ${profileId}
			AND "ownerUserId" = ${OWNER_USER_ID}
			AND "archivedAt" IS NULL
		LIMIT 1
	`;
	const row = rows[0];
	if (!row) {
		throw new Error("Profile not found");
	}

	await setActiveProfileId(db, row.id);

	return toSummary(row, true, row.profileUserId === OWNER_USER_ID);
}
