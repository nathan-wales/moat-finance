import {
	advertisedMcpScopes,
	desktopMcpScopes,
	type McpScope,
	mcpScopeLabel,
} from "@moat/mcp-contracts";

export const desktopAgentAvailableScopes =
	advertisedMcpScopes(desktopMcpScopes);

export const defaultLocalAgentScopes = desktopAgentAvailableScopes;

export function scopeLabel(scope: string): string {
	const isKnownScope = desktopAgentAvailableScopes.some(
		(knownScope) => knownScope === scope,
	);
	if (isKnownScope) {
		return mcpScopeLabel(scope as McpScope);
	}
	return scope;
}
