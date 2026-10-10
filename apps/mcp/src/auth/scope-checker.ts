import {
	hasRequiredScopes,
	isMcpClientProfile,
	type McpClientProfile,
	type McpScope,
	type McpToolName,
	profileToolAllowlist,
} from "@moat/mcp-contracts";

export class McpAuthorizationError extends Error {
	statusCode = 403;
	errorCode = "MCP_FORBIDDEN";

	constructor(message = "Insufficient MCP scopes") {
		super(message);
	}
}

export function resolveClientProfile(
	value: string | null | undefined,
): McpClientProfile {
	if (value && isMcpClientProfile(value)) return value;
	return "local-dev";
}

export function assertToolAllowedForProfile(
	profile: McpClientProfile,
	toolName: McpToolName,
): void {
	if (!profileToolAllowlist[profile].includes(toolName)) {
		throw new McpAuthorizationError(
			"Tool is not available for this MCP client profile",
		);
	}
}

export function assertScopes(
	grantedScopes: readonly string[],
	requiredScopes: readonly McpScope[],
): void {
	if (!hasRequiredScopes(grantedScopes, requiredScopes)) {
		throw new McpAuthorizationError();
	}
}
