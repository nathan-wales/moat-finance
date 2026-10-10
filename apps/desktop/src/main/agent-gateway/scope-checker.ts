import { hasRequiredScopes, type McpScope } from "@moat/mcp-contracts";
import type { LocalAgentContext } from "./types";

export class AgentAuthorizationError extends Error {
	readonly statusCode = 403;
	readonly errorCode = "AGENT_FORBIDDEN";
}

/**
 * Asserts that the agent context has all required scopes.
 * Throws AgentAuthorizationError if the check fails.
 */
export function assertScopes(
	context: LocalAgentContext,
	requiredScopes: readonly McpScope[],
): void {
	if (!hasRequiredScopes(context.scopes, requiredScopes)) {
		const missing = requiredScopes
			.filter((scope) => !hasRequiredScopes(context.scopes, [scope]))
			.join(", ");
		throw new AgentAuthorizationError(
			`Agent "${context.label}" lacks required scopes: ${missing}`,
		);
	}
}
