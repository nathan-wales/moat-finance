import type { McpClientProfile, McpScope } from "@moat/mcp-contracts";
import type { DbClient } from "~/lib/db";

export type McpAuthKind = "pat" | "oauth";

export type McpAuthContext = {
	db: DbClient;
	authKind: McpAuthKind;
	actorUserId: string;
	effectiveUserId: string;
	userId: string;
	isHouseholdMember: boolean;
	householdId?: string;
	clientId?: string;
	clientName?: string;
	clientProfile: McpClientProfile;
	personalAccessTokenId?: string;
	oauthAccessTokenId?: string;
	oauthClientId?: string;
	scopes: McpScope[];
};
