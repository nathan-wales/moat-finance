import { mcpToolContracts } from "@moat/mcp-contracts";
import type { McpAuthContext } from "~/auth/types";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

type ListedProfile = {
	id: string;
	kind: "PERSONAL" | "FAMILY" | "BUSINESS";
	displayName: string;
	isEntitlementRestricted: boolean;
};

const PROFILE_LINK_SELECT = {
	displayName: true,
	entitlementRestrictedAt: true,
	kind: true,
	profileUserId: true,
} as const;

export const listProfilesTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listProfiles"],
	async execute(_input, context) {
		const profiles = await listAccessibleProfiles(context);
		return schemaEnvelope("profiles.list", {
			count: profiles.length,
			profiles,
		});
	},
};

async function listAccessibleProfiles(
	context: McpAuthContext,
): Promise<ListedProfile[]> {
	if (context.isHouseholdMember) {
		return listGrantedProfiles(context);
	}

	const links = await context.db.profileLink.findMany({
		where: { archivedAt: null, ownerUserId: context.actorUserId },
		select: PROFILE_LINK_SELECT,
		orderBy: { createdAt: "asc" },
	});
	const profiles = links.map(toListedProfile);
	if (!profiles.some((profile) => profile.id === context.actorUserId)) {
		profiles.unshift({
			displayName: "Personal",
			id: context.actorUserId,
			isEntitlementRestricted: false,
			kind: "PERSONAL",
		});
	}
	return profiles;
}

async function listGrantedProfiles(
	context: McpAuthContext,
): Promise<ListedProfile[]> {
	const grants = await context.db.householdProfileAccess.findMany({
		where: {
			membership: { memberUserId: context.actorUserId, status: "ACTIVE" },
			profileLink: { archivedAt: null },
		},
		select: { profileLink: { select: PROFILE_LINK_SELECT } },
	});
	return grants.map((grant) => toListedProfile(grant.profileLink));
}

function toListedProfile(link: {
	profileUserId: string;
	kind: ListedProfile["kind"];
	displayName: string;
	entitlementRestrictedAt: Date | null;
}): ListedProfile {
	return {
		displayName: link.displayName,
		id: link.profileUserId,
		isEntitlementRestricted: link.entitlementRestrictedAt !== null,
		kind: link.kind,
	};
}
