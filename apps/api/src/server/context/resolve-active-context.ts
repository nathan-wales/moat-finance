import type { ApiContext } from "../api-context";
import { db } from "../db";

const DEMO_USER_EMAIL = "demo@internal.system";

let cachedDemoUserId: string | null = null;

/**
 * Resolves the demo system user's ID, with in-process caching.
 * Returns null if the demo user has not been seeded yet.
 */
export async function getDemoUserId(): Promise<string | null> {
	if (cachedDemoUserId) return cachedDemoUserId;

	const demoUser = await db.user.findUnique({
		where: { email: DEMO_USER_EMAIL },
		select: { id: true },
	});

	if (demoUser) {
		cachedDemoUserId = demoUser.id;
		return demoUser.id;
	}

	return null;
}

/**
 * Resolves the active data user ID for a request.
 * In demo mode: returns the seeded demo system user's ID.
 * In personal mode: returns the authenticated user's ID (from session or JWT).
 */
export async function resolveActiveUserId(ctx: {
	isDemoMode: boolean;
	session: { user: { id: string } } | null;
	jwtPayload?: { userId: string } | null;
}): Promise<string | null> {
	if (ctx.isDemoMode) {
		return getDemoUserId();
	}
	// Try session first (web), then JWT (mobile)
	return ctx.session?.user.id ?? ctx.jwtPayload?.userId ?? null;
}

export type ResolvedIdentityContext = {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
	activeProfileId: string | null;
	activeProfileKind: "PERSONAL" | "FAMILY" | "BUSINESS" | null;
};

type GrantedProfileLink = {
	id: string;
	profileUserId: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
	createdAt: Date;
};

type MemberGrantResolution = {
	ownerUserId: string;
	links: GrantedProfileLink[];
};

async function listGrantedProfileLinks(
	requestContext: Pick<ApiContext, "db">,
	memberUserId: string,
): Promise<MemberGrantResolution | null> {
	const membership = await requestContext.db.householdMembership.findFirst({
		where: {
			memberUserId,
			status: "ACTIVE",
		},
		select: {
			ownerUserId: true,
			profileAccess: {
				select: {
					profileLink: {
						select: {
							id: true,
							profileUserId: true,
							kind: true,
							createdAt: true,
							archivedAt: true,
						},
					},
				},
			},
		},
	});

	if (!membership) return null;

	const links: GrantedProfileLink[] = [];
	for (const grant of membership.profileAccess) {
		const link = grant.profileLink;
		if (!link || link.archivedAt !== null) continue;
		links.push({
			id: link.id,
			profileUserId: link.profileUserId,
			kind: link.kind,
			createdAt: link.createdAt,
		});
	}

	links.sort((a, b) => {
		if (a.kind === "PERSONAL" && b.kind !== "PERSONAL") return -1;
		if (b.kind === "PERSONAL" && a.kind !== "PERSONAL") return 1;
		return a.createdAt.getTime() - b.createdAt.getTime();
	});

	return {
		ownerUserId: membership.ownerUserId,
		links,
	};
}

function toMemberIdentity(
	actorUserId: string,
	link: GrantedProfileLink,
): ResolvedIdentityContext {
	return {
		actorUserId,
		effectiveUserId: link.profileUserId,
		isHouseholdMember: true,
		activeProfileId: link.id,
		activeProfileKind: link.kind,
	};
}

function toMemberWithoutGrantAccess(
	actorUserId: string,
): ResolvedIdentityContext {
	// Membership exists but no usable grants — keep member flag so owner-only
	// actions stay blocked, and do not rewrite into the owner's ledger.
	return {
		actorUserId,
		effectiveUserId: actorUserId,
		isHouseholdMember: true,
		activeProfileId: null,
		activeProfileKind: null,
	};
}

function resolveFromGrants(
	actorUserId: string,
	grants: MemberGrantResolution,
	requestedProfileId?: string | null,
): ResolvedIdentityContext {
	if (requestedProfileId) {
		const grantedLink = grants.links.find(
			(link) => link.id === requestedProfileId,
		);
		if (grantedLink) {
			return toMemberIdentity(actorUserId, grantedLink);
		}
	}

	const defaultLink = grants.links[0];
	if (defaultLink) {
		return toMemberIdentity(actorUserId, defaultLink);
	}

	return toMemberWithoutGrantAccess(actorUserId);
}

/**
 * @deprecated Prefer resolveRequestIdentity. Kept for callers that only need
 * household membership without profile grants.
 */
export async function resolveHouseholdIdentity(
	requestContext: Pick<ApiContext, "db">,
	actorUserId: string,
): Promise<ResolvedIdentityContext> {
	const grants = await listGrantedProfileLinks(requestContext, actorUserId);
	if (!grants) {
		return {
			actorUserId,
			effectiveUserId: actorUserId,
			isHouseholdMember: false,
			activeProfileId: null,
			activeProfileKind: null,
		};
	}
	return resolveFromGrants(actorUserId, grants);
}

/**
 * Resolution order:
 * 1. activeProfileId — owner-owned link, or member grant for that link
 * 2. ACTIVE household membership → default granted profile
 * 3. self
 */
export async function resolveRequestIdentity(
	requestContext: Pick<ApiContext, "db" | "activeProfileId">,
	actorUserId: string,
): Promise<ResolvedIdentityContext> {
	const requestedProfileId = requestContext.activeProfileId;
	if (requestedProfileId) {
		const ownedLink = await requestContext.db.profileLink.findFirst({
			where: {
				id: requestedProfileId,
				ownerUserId: actorUserId,
				archivedAt: null,
			},
			select: {
				id: true,
				profileUserId: true,
				kind: true,
			},
		});

		if (ownedLink) {
			return {
				actorUserId,
				effectiveUserId: ownedLink.profileUserId,
				isHouseholdMember: false,
				activeProfileId: ownedLink.id,
				activeProfileKind: ownedLink.kind,
			};
		}

		const grants = await listGrantedProfileLinks(requestContext, actorUserId);
		if (grants) {
			return resolveFromGrants(actorUserId, grants, requestedProfileId);
		}

		return {
			actorUserId,
			effectiveUserId: actorUserId,
			isHouseholdMember: false,
			activeProfileId: null,
			activeProfileKind: null,
		};
	}

	const grants = await listGrantedProfileLinks(requestContext, actorUserId);
	if (grants) {
		return resolveFromGrants(actorUserId, grants);
	}

	return {
		actorUserId,
		effectiveUserId: actorUserId,
		isHouseholdMember: false,
		activeProfileId: null,
		activeProfileKind: null,
	};
}
