import { McpAuthorizationError } from "~/auth/scope-checker";
import type { DbClient } from "~/lib/db";

type ProfileLinkRow = {
	profileUserId: string;
};

/**
 * Resolves a client-supplied profile id to a ledger the caller is allowed to
 * read. The id is never used until this check passes.
 */
export async function resolveMcpReadProfileUserId(input: {
	db: DbClient;
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
	requestedProfileId: string;
}): Promise<string> {
	const requestedProfileId = input.requestedProfileId.trim();
	if (!requestedProfileId) {
		throw new McpAuthorizationError("profileId is required");
	}

	if (
		requestedProfileId === input.actorUserId ||
		requestedProfileId === input.effectiveUserId
	) {
		return requestedProfileId;
	}

	const owned = await findOwnedProfile(
		input.db,
		input.actorUserId,
		requestedProfileId,
	);
	if (owned) return owned.profileUserId;

	if (input.isHouseholdMember) {
		const granted = await findGrantedProfile(
			input.db,
			input.actorUserId,
			requestedProfileId,
		);
		if (granted) return granted.profileUserId;
	}

	throw new McpAuthorizationError(
		"That profile is not available on this account",
	);
}

async function findOwnedProfile(
	db: DbClient,
	actorUserId: string,
	profileUserId: string,
): Promise<ProfileLinkRow | null> {
	return db.profileLink.findFirst({
		where: {
			archivedAt: null,
			ownerUserId: actorUserId,
			profileUserId,
		},
		select: { profileUserId: true },
	});
}

async function findGrantedProfile(
	db: DbClient,
	actorUserId: string,
	profileUserId: string,
): Promise<ProfileLinkRow | null> {
	const grant = await db.householdProfileAccess.findFirst({
		where: {
			membership: { memberUserId: actorUserId, status: "ACTIVE" },
			profileLink: { archivedAt: null, profileUserId },
		},
		select: { profileLink: { select: { profileUserId: true } } },
	});
	return grant?.profileLink ?? null;
}

export function readRequestedProfileId(args: unknown): string | undefined {
	if (!args || typeof args !== "object" || Array.isArray(args))
		return undefined;
	const value = (args as { profileId?: unknown }).profileId;
	if (typeof value !== "string") return undefined;
	const trimmed = value.trim();
	return trimmed.length > 0 ? trimmed : undefined;
}

export function argumentsWithoutProfileId(args: unknown): unknown {
	if (!args || typeof args !== "object" || Array.isArray(args))
		return args ?? {};
	const rest = { ...(args as Record<string, unknown>) };
	delete rest.profileId;
	return rest;
}
