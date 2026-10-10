import { defaultClientProfile } from "@moat/mcp-contracts";
import { db, mcpPrismaBase } from "~/lib/db";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	withDatabaseActor,
} from "../../../api/src/server/db-actor";
import { validateOAuthAccessToken } from "./oauth-service";
import { validatePersonalAccessToken } from "./pat-service";
import { resolveHouseholdIdentity } from "./resolve-household-identity";
import { resolveClientProfile } from "./scope-checker";
import { getBearerToken } from "./token-hash";
import type { McpAuthContext } from "./types";

export class McpAuthenticationError extends Error {
	statusCode = 401;
	errorCode = "MCP_UNAUTHORIZED";

	constructor(message = "Unauthorized MCP request") {
		super(message);
	}
}

async function resolveAuthContext(input: {
	token: string;
	requestedClientProfile?: string | null;
}): Promise<McpAuthContext> {
	const pat = await validatePersonalAccessToken(input.token);
	if (pat) {
		const identity = await resolveHouseholdIdentity({
			db,
			actorUserId: pat.userId,
		});
		return {
			db,
			authKind: "pat",
			actorUserId: identity.actorUserId,
			effectiveUserId: identity.effectiveUserId,
			userId: identity.effectiveUserId,
			isHouseholdMember: identity.isHouseholdMember,
			clientName: pat.clientName ?? pat.name,
			clientProfile: resolveClientProfile(input.requestedClientProfile),
			personalAccessTokenId: pat.id,
			scopes: pat.scopes,
		};
	}

	const oauth = await validateOAuthAccessToken(input.token);
	if (oauth?.desktopPublicTunnelId) {
		throw new McpAuthenticationError(
			"Desktop tunnel tokens cannot access the cloud MCP server",
		);
	}
	if (oauth) {
		const identity = await resolveHouseholdIdentity({
			db,
			actorUserId: oauth.userId,
		});
		return {
			db,
			authKind: "oauth",
			actorUserId: identity.actorUserId,
			effectiveUserId: identity.effectiveUserId,
			userId: identity.effectiveUserId,
			isHouseholdMember: identity.isHouseholdMember,
			clientId: oauth.clientId,
			clientName: oauth.clientName,
			clientProfile: oauth.clientProfile ?? defaultClientProfile,
			oauthAccessTokenId: oauth.id,
			oauthClientId: oauth.oauthClientId,
			scopes: oauth.scopes,
		};
	}

	throw new McpAuthenticationError();
}

export async function verifyAuthorizationHeader(input: {
	authorizationHeader: string | undefined;
	requestedClientProfile?: string | null;
}): Promise<McpAuthContext> {
	let token: string;
	try {
		token = getBearerToken(input.authorizationHeader);
	} catch {
		throw new McpAuthenticationError("Missing or invalid MCP bearer token");
	}
	if (!token) {
		throw new McpAuthenticationError("Missing or invalid MCP bearer token");
	}

	if (!isDatabaseActorContextEnabled()) {
		return resolveAuthContext({
			token,
			requestedClientProfile: input.requestedClientProfile,
		});
	}

	return withDatabaseActor(
		serviceDatabaseActor(),
		async () =>
			resolveAuthContext({
				token,
				requestedClientProfile: input.requestedClientProfile,
			}),
		{ client: mcpPrismaBase },
	);
}
