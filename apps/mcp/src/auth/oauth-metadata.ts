import { advertisedMcpScopes, readScopes } from "@moat/mcp-contracts";
import type { McpEnv } from "~/config/env";

export const protectedResourcePath = "/.well-known/oauth-protected-resource";
export const pathSpecificProtectedResourcePath = `${protectedResourcePath}/mcp`;
export const authorizationServerMetadataPath =
	"/.well-known/oauth-authorization-server";
export const pathSpecificAuthorizationServerMetadataPath = `${authorizationServerMetadataPath}/mcp`;

export function stripTrailingSlash(url: string): string {
	if (url.length > 1 && url.endsWith("/")) return url.slice(0, -1);
	return url;
}

export function getMcpBaseUrl(env: McpEnv): string {
	return stripTrailingSlash(env.MCP_BASE_URL);
}

export function getOAuthIssuer(env: McpEnv): string {
	return stripTrailingSlash(env.MCP_OAUTH_ISSUER ?? env.MCP_BASE_URL);
}

export function getMcpResource(env: McpEnv): string {
	return `${getMcpBaseUrl(env)}/mcp`;
}

export function getProtectedResourceMetadata(env: McpEnv) {
	return {
		resource: getMcpResource(env),
		resource_name: "Moat Finance",
		bearer_methods_supported: ["header"],
		authorization_servers: [getOAuthIssuer(env)],
		scopes_supported: advertisedMcpScopes(),
		resource_documentation: "https://moatfinance.ai/support",
	};
}

export function getAuthorizationServerMetadata(env: McpEnv) {
	const baseUrl = getMcpBaseUrl(env);
	const issuer = getOAuthIssuer(env);
	return {
		issuer,
		authorization_endpoint: `${baseUrl}/oauth/authorize`,
		token_endpoint: `${baseUrl}/oauth/token`,
		revocation_endpoint: `${baseUrl}/oauth/revoke`,
		registration_endpoint: `${baseUrl}/oauth/register`,
		response_types_supported: ["code"],
		grant_types_supported: ["authorization_code", "refresh_token"],
		code_challenge_methods_supported: ["S256"],
		token_endpoint_auth_methods_supported: ["none", "client_secret_post"],
		scopes_supported: advertisedMcpScopes(),
	};
}

export function getAuthChallenge(
	env: McpEnv,
	options?: { invalidToken?: boolean },
): string {
	const resourceMetadataUrl = `${getMcpBaseUrl(env)}${protectedResourcePath}`;
	const scope = advertisedMcpScopes(readScopes).join(" ");
	const parts = [`Bearer resource_metadata="${resourceMetadataUrl}"`];
	if (options?.invalidToken) {
		parts.push('error="invalid_token"');
	}
	parts.push(`scope="${scope}"`);
	return parts.join(", ");
}
