import type { DbClient } from "~/lib/db";

export type McpResolvedIdentity = {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
};

export async function resolveHouseholdIdentity(input: {
	db: DbClient;
	actorUserId: string;
}): Promise<McpResolvedIdentity> {
	// Known gap: this picks the household owner as the default profile and does
	// not consult HouseholdProfileAccess. A member token can therefore read the
	// owner's personal ledger even when their grant is a different profile.
	// An explicit profileId on a read tool is checked against grants; this
	// default is intentionally unchanged until household MCP access is redesigned.
	const membership = await input.db.householdMembership.findFirst({
		where: {
			memberUserId: input.actorUserId,
			status: "ACTIVE",
		},
		select: {
			ownerUserId: true,
		},
	});

	return {
		actorUserId: input.actorUserId,
		effectiveUserId: membership?.ownerUserId ?? input.actorUserId,
		isHouseholdMember: Boolean(membership),
	};
}
