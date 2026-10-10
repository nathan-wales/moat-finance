import {
	advertisedMcpScopes,
	desktopMcpScopes,
	readScopes,
} from "@moat/mcp-contracts";
import { LOCAL_MCP_PORT } from "./types";

export const LOCAL_MCP_ISSUER = `http://127.0.0.1:${LOCAL_MCP_PORT}`;
export const LOCAL_MCP_RESOURCE = `${LOCAL_MCP_ISSUER}/mcp`;
export const protectedResourcePath = "/.well-known/oauth-protected-resource";
export const pathSpecificProtectedResourcePath = `${protectedResourcePath}/mcp`;
export const authorizationServerMetadataPath =
	"/.well-known/oauth-authorization-server";
export const pathSpecificAuthorizationServerMetadataPath = `${authorizationServerMetadataPath}/mcp`;

export function getLocalProtectedResourceMetadata() {
	return {
		resource: LOCAL_MCP_RESOURCE,
		resource_name: "Moat Finance",
		bearer_methods_supported: ["header"],
		authorization_servers: [LOCAL_MCP_ISSUER],
		scopes_supported: advertisedMcpScopes(desktopMcpScopes),
		resource_documentation: "https://moatfinance.ai/support",
	};
}

export function getLocalAuthorizationServerMetadata() {
	return {
		issuer: LOCAL_MCP_ISSUER,
		authorization_endpoint: `${LOCAL_MCP_ISSUER}/oauth/authorize`,
		token_endpoint: `${LOCAL_MCP_ISSUER}/oauth/token`,
		revocation_endpoint: `${LOCAL_MCP_ISSUER}/oauth/revoke`,
		registration_endpoint: `${LOCAL_MCP_ISSUER}/oauth/register`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none"],
		scopes_supported: advertisedMcpScopes(desktopMcpScopes),
	};
}

export function getLocalAuthChallenge(options?: {
	invalidToken?: boolean;
}): string {
	const resourceMetadataUrl = `${LOCAL_MCP_ISSUER}${protectedResourcePath}`;
	const desktopReadScopes = advertisedMcpScopes(desktopMcpScopes).filter(
		(scope) => (readScopes as readonly string[]).includes(scope),
	);
	const scope = desktopReadScopes.join(" ");
	const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
	if (options?.invalidToken) {
		parts.push('error="invalid_token"');
	}
	parts.push(`scope="${scope}"`);
	return parts.join(", ");
}
