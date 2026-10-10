import type { BusinessType } from "@moat/contracts";
import { logger } from "~/lib/logger";
import type { PrismaClient, ProfileKind } from "../../../../generated/prisma";
import { createApiError } from "../../api-context";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "../../db-actor";
import { sumSnapshotsOnOrBefore } from "../balance-snapshot.service";

export type ProfileSummary = {
	id: string;
	kind: ProfileKind;
	displayName: string;
	profileUserId: string;
	isActive: boolean;
	isPersonal: boolean;
	includeInOwnerNetWorth: boolean;
	businessType: BusinessType | null;
	/**
	 * True when the owner's plan no longer covers this profile. The profile and its
	 * data stay intact and visible; it is read-only until they upgrade again.
	 */
	isEntitlementRestricted: boolean;
};

export type ProfileQuickSummary = ProfileSummary & {
	netWorth: number;
	accountCount: number;
};

const CHILD_KINDS = new Set<ProfileKind>(["FAMILY", "BUSINESS"]);

/**
 * Sanity cap on active business profiles per owner. Not a paid limit — it only
 * guards against runaway profile creation.
 */
export const MAX_BUSINESS_PROFILES_PER_OWNER = 25;

async function assertBusinessProfileCapacityOrThrow(
	db: PrismaClient,
	ownerUserId: string,
): Promise<void> {
	const businessProfileCount = await db.profileLink.count({
		where: { archivedAt: null, kind: "BUSINESS", ownerUserId },
	});
	if (businessProfileCount >= MAX_BUSINESS_PROFILES_PER_OWNER) {
		throw createApiError(
			`You can have up to ${MAX_BUSINESS_PROFILES_PER_OWNER} business profiles.`,
			409,
		);
	}
}

const PROFILE_LINK_SUMMARY_SELECT = {
	id: true,
	kind: true,
	displayName: true,
	profileUserId: true,
	includeInOwnerNetWorth: true,
	businessType: true,
	entitlementRestrictedAt: true,
} as const;

function defaultDisplayName(kind: ProfileKind): string {
	switch (kind) {
		case "FAMILY":
			return "Family";
		case "BUSINESS":
			return "Business";
		default:
			return "Personal";
	}
}

function toSummary(
	link: {
		id: string;
		kind: ProfileKind;
		displayName: string;
		profileUserId: string;
		includeInOwnerNetWorth: boolean;
		businessType: BusinessType | null;
		entitlementRestrictedAt: Date | null;
	},
	ownerUserId: string,
	activeProfileId: string | null,
): ProfileSummary {
	return {
		id: link.id,
		kind: link.kind,
		displayName: link.displayName,
		profileUserId: link.profileUserId,
		includeInOwnerNetWorth: link.includeInOwnerNetWorth,
		businessType: link.businessType,
		isEntitlementRestricted: link.entitlementRestrictedAt !== null,
		isPersonal: link.profileUserId === ownerUserId,
		isActive: link.id === activeProfileId,
	};
}

export async function ensurePersonalProfile(
	db: PrismaClient,
	ownerUserId: string,
): Promise<void> {
	const existing = await db.profileLink.findFirst({
		where: {
			ownerUserId,
			profileUserId: ownerUserId,
			archivedAt: null,
		},
		select: { id: true },
	});
	if (existing) return;

	const owner = await db.user.findUnique({
		where: { id: ownerUserId },
		select: { name: true, email: true },
	});

	const displayName =
		owner?.name?.trim() ||
		owner?.email?.trim() ||
		defaultDisplayName("PERSONAL");

	try {
		await db.profileLink.create({
			data: {
				ownerUserId,
				profileUserId: ownerUserId,
				kind: "PERSONAL",
				displayName,
			},
		});
	} catch (error) {
		const race = await db.profileLink.findFirst({
			where: {
				ownerUserId,
				profileUserId: ownerUserId,
				archivedAt: null,
			},
			select: { id: true },
		});
		if (race) return;
		logger.error("profile.ensure_personal_failed", {
			feature: "profiles",
			operation: "ensurePersonalProfile",
			userId: ownerUserId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function listProfilesForActor(
	db: PrismaClient,
	input: {
		actorUserId: string;
		activeProfileId: string | null;
		isHouseholdMember: boolean;
	},
): Promise<{
	profiles: ProfileSummary[];
	canCreateProfile: boolean;
	canCreateBusinessProfile: boolean;
	businessProfileLimit: number;
	businessProfileCount: number;
}> {
	if (input.isHouseholdMember) {
		const membership = await db.householdMembership.findFirst({
			where: {
				memberUserId: input.actorUserId,
				status: "ACTIVE",
			},
			select: {
				ownerUserId: true,
				profileAccess: {
					select: {
						profileLink: {
							select: {
								...PROFILE_LINK_SUMMARY_SELECT,
								archivedAt: true,
								createdAt: true,
							},
						},
					},
				},
			},
		});

		if (!membership) {
			return {
				businessProfileCount: 0,
				businessProfileLimit: 0,
				canCreateBusinessProfile: false,
				canCreateProfile: false,
				profiles: [],
			};
		}

		const links = membership.profileAccess
			.map((grant) => grant.profileLink)
			.filter((link) => link && link.archivedAt === null)
			.sort((a, b) => {
				if (a.kind === "PERSONAL" && b.kind !== "PERSONAL") return -1;
				if (b.kind === "PERSONAL" && a.kind !== "PERSONAL") return 1;
				return a.createdAt.getTime() - b.createdAt.getTime();
			});

		const effectiveActiveId =
			input.activeProfileId &&
			links.some((link) => link.id === input.activeProfileId)
				? input.activeProfileId
				: (links[0]?.id ?? null);

		return {
			businessProfileCount: links.filter((link) => link.kind === "BUSINESS")
				.length,
			businessProfileLimit: 0,
			canCreateBusinessProfile: false,
			canCreateProfile: false,
			profiles: links.map((link) =>
				toSummary(link, membership.ownerUserId, effectiveActiveId),
			),
		};
	}

	await ensurePersonalProfile(db, input.actorUserId);

	const links = await db.profileLink.findMany({
		where: {
			ownerUserId: input.actorUserId,
			archivedAt: null,
		},
		orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
		select: PROFILE_LINK_SUMMARY_SELECT,
	});

	const personal = links.find(
		(link) => link.profileUserId === input.actorUserId,
	);
	const effectiveActiveId =
		input.activeProfileId &&
		links.some((link) => link.id === input.activeProfileId)
			? input.activeProfileId
			: (personal?.id ?? null);

	const businessProfileCount = links.filter(
		(link) => link.kind === "BUSINESS",
	).length;

	return {
		businessProfileCount,
		businessProfileLimit: MAX_BUSINESS_PROFILES_PER_OWNER,
		canCreateBusinessProfile:
			businessProfileCount < MAX_BUSINESS_PROFILES_PER_OWNER,
		canCreateProfile: true,
		profiles: links.map((link) =>
			toSummary(link, input.actorUserId, effectiveActiveId),
		),
	};
}

/** @deprecated Use listProfilesForActor */
export async function listProfiles(
	db: PrismaClient,
	ownerUserId: string,
	activeProfileId: string | null,
): Promise<ProfileSummary[]> {
	const result = await listProfilesForActor(db, {
		actorUserId: ownerUserId,
		activeProfileId,
		isHouseholdMember: false,
	});
	return result.profiles;
}

export async function createChildProfile(
	db: PrismaClient,
	input: {
		ownerUserId: string;
		kind: ProfileKind;
		displayName?: string;
		businessType?: BusinessType;
	},
): Promise<ProfileSummary> {
	if (!CHILD_KINDS.has(input.kind)) {
		throw createApiError(
			"Only FAMILY or BUSINESS profiles can be created",
			400,
		);
	}

	if (input.kind === "BUSINESS" && !input.businessType) {
		throw createApiError("Business type is required", 400);
	}

	if (input.kind !== "BUSINESS" && input.businessType) {
		throw createApiError(
			"Business type is only valid for business profiles",
			400,
		);
	}

	if (input.kind === "BUSINESS") {
		await assertBusinessProfileCapacityOrThrow(db, input.ownerUserId);
	}

	await ensurePersonalProfile(db, input.ownerUserId);

	const displayName =
		input.displayName?.trim() || defaultDisplayName(input.kind);

	const create = async (client: PrismaClient) => {
		// Not a sign-up: a login-less profile owned by an existing user, so the
		// instance sign-up policy (lib/signup-policy.ts) does not apply.
		const profileUser = await client.user.create({
			data: {
				name: displayName,
				email: null,
				password: null,
			},
			select: { id: true },
		});

		const link = await client.profileLink.create({
			data: {
				ownerUserId: input.ownerUserId,
				profileUserId: profileUser.id,
				kind: input.kind,
				displayName,
				businessType: input.businessType ?? null,
			},
		});

		return toSummary(link, input.ownerUserId, link.id);
	};

	try {
		if (!isDatabaseActorContextEnabled()) {
			return await create(db);
		}

		return await withDatabaseActor(serviceDatabaseActor(), async (serviceDb) =>
			create(serviceDb),
		);
	} catch (error) {
		logger.error("profile.create_failed", {
			feature: "profiles",
			operation: "createChildProfile",
			userId: input.ownerUserId,
			error: error instanceof Error ? error.message : String(error),
		});
		throw error;
	}
}

export async function getAccessibleProfile(
	db: PrismaClient,
	input: {
		actorUserId: string;
		profileId: string;
		isHouseholdMember: boolean;
	},
): Promise<ProfileSummary | null> {
	if (input.isHouseholdMember) {
		const grant = await db.householdProfileAccess.findFirst({
			where: {
				profileLinkId: input.profileId,
				membership: {
					memberUserId: input.actorUserId,
					status: "ACTIVE",
				},
				profileLink: {
					archivedAt: null,
				},
			},
			select: {
				membership: {
					select: { ownerUserId: true },
				},
				profileLink: {
					select: PROFILE_LINK_SUMMARY_SELECT,
				},
			},
		});

		if (!grant?.profileLink) return null;
		return toSummary(
			grant.profileLink,
			grant.membership.ownerUserId,
			grant.profileLink.id,
		);
	}

	const link = await db.profileLink.findFirst({
		where: {
			id: input.profileId,
			ownerUserId: input.actorUserId,
			archivedAt: null,
		},
		select: PROFILE_LINK_SUMMARY_SELECT,
	});

	if (!link) return null;
	return toSummary(link, input.actorUserId, link.id);
}

export async function getOwnedProfile(
	db: PrismaClient,
	ownerUserId: string,
	profileId: string,
): Promise<ProfileSummary | null> {
	return getAccessibleProfile(db, {
		actorUserId: ownerUserId,
		profileId,
		isHouseholdMember: false,
	});
}

export async function updateProfile(
	db: PrismaClient,
	input: {
		actorUserId: string;
		profileId: string;
		isHouseholdMember: boolean;
		displayName?: string;
		includeInOwnerNetWorth?: boolean;
		businessType?: BusinessType;
	},
): Promise<ProfileSummary> {
	const existing = await getAccessibleProfile(db, {
		actorUserId: input.actorUserId,
		profileId: input.profileId,
		isHouseholdMember: input.isHouseholdMember,
	});
	if (!existing) {
		throw createApiError("Profile not found", 404);
	}

	if (input.includeInOwnerNetWorth !== undefined) {
		if (input.isHouseholdMember) {
			throw createApiError(
				"Only the account owner can change net worth inclusion",
				403,
			);
		}
		if (existing.isPersonal) {
			throw createApiError(
				"Personal profiles cannot be included in personal net worth",
				400,
			);
		}
	}

	if (input.businessType !== undefined && existing.kind !== "BUSINESS") {
		throw createApiError(
			"Business type is only valid for business profiles",
			400,
		);
	}

	const data: {
		displayName?: string;
		includeInOwnerNetWorth?: boolean;
		businessType?: BusinessType;
	} = {};

	if (input.displayName !== undefined) {
		const trimmed = input.displayName.trim();
		if (!trimmed) {
			throw createApiError("Display name is required", 400);
		}
		data.displayName = trimmed;
	}

	if (input.includeInOwnerNetWorth !== undefined) {
		data.includeInOwnerNetWorth = input.includeInOwnerNetWorth;
	}

	if (input.businessType !== undefined) {
		data.businessType = input.businessType;
	}

	if (Object.keys(data).length === 0) {
		throw createApiError("No updates provided", 400);
	}

	const updated = await db.profileLink.update({
		where: { id: input.profileId },
		data,
		select: {
			...PROFILE_LINK_SUMMARY_SELECT,
			ownerUserId: true,
		},
	});

	if (data.displayName && updated.profileUserId !== updated.ownerUserId) {
		await db.user.update({
			where: { id: updated.profileUserId },
			data: { name: data.displayName },
		});
	}

	return toSummary(updated, updated.ownerUserId, updated.id);
}

export async function renameProfile(
	db: PrismaClient,
	ownerUserId: string,
	profileId: string,
	displayName: string,
): Promise<ProfileSummary> {
	return updateProfile(db, {
		actorUserId: ownerUserId,
		profileId,
		isHouseholdMember: false,
		displayName,
	});
}

export async function getProfileQuickSummary(
	db: PrismaClient,
	input: {
		actorUserId: string;
		profileId: string;
		isHouseholdMember: boolean;
	},
): Promise<ProfileQuickSummary> {
	const profile = await getAccessibleProfile(db, input);
	if (!profile) {
		throw createApiError("Profile not found", 404);
	}

	const userId = profile.profileUserId;

	const [netWorth, plaidCount, investmentCount, realEstateCount] =
		await Promise.all([
			sumSnapshotsOnOrBefore(db, userId),
			db.plaidAccount.count({
				where: { userId, isActive: true },
			}),
			db.investment.count({ where: { userId } }),
			db.realEstateInvestment.count({ where: { userId } }),
		]);

	return {
		...profile,
		netWorth,
		accountCount: plaidCount + investmentCount + realEstateCount,
	};
}

export async function listIncludedChildProfiles(
	db: PrismaClient,
	ownerUserId: string,
): Promise<
	Array<{
		id: string;
		displayName: string;
		profileUserId: string;
		kind: ProfileKind;
	}>
> {
	return db.profileLink.findMany({
		where: {
			ownerUserId,
			archivedAt: null,
			includeInOwnerNetWorth: true,
			NOT: { profileUserId: ownerUserId },
		},
		orderBy: [{ kind: "asc" }, { createdAt: "asc" }],
		select: {
			id: true,
			displayName: true,
			profileUserId: true,
			kind: true,
		},
	});
}

export function isOwnerPersonalActive(input: {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
}): boolean {
	return (
		!input.isHouseholdMember && input.actorUserId === input.effectiveUserId
	);
}
