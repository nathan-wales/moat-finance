import { hasRequiredScopes } from "@moat/mcp-contracts";
import type { LocalAgentContext } from "./types";

export type GatewayRoute =
	| { kind: "mcp" }
	| { kind: "import-preview" }
	| { kind: "import-commit" }
	| { kind: "import-detect" }
	| { kind: "oauth-metadata-prm" }
	| { kind: "oauth-metadata-as" }
	| { kind: "oauth-register" }
	| { kind: "oauth-authorize" }
	| { kind: "oauth-token" }
	| { kind: "oauth-revoke" }
	| { kind: "not-found" };

export type GatewayAuthResult =
	| { ok: true; agentContext: LocalAgentContext }
	| { ok: false; status: 401 | 403 | 503; error: string };

export function normalizeGatewayPath(path: string): string {
	if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
	return path;
}

export function matchGatewayRoute(method: string, path: string): GatewayRoute {
	const requestPath = normalizeGatewayPath(path.split("?")[0] ?? "");
	const verb = method.toUpperCase();

	if (
		requestPath === "/mcp" &&
		(verb === "POST" || verb === "GET" || verb === "DELETE")
	) {
		return { kind: "mcp" };
	}
	if (
		verb === "GET" &&
		(requestPath === "/.well-known/oauth-protected-resource" ||
			requestPath === "/.well-known/oauth-protected-resource/mcp")
	) {
		return { kind: "oauth-metadata-prm" };
	}
	if (
		verb === "GET" &&
		(requestPath === "/.well-known/oauth-authorization-server" ||
			requestPath === "/.well-known/oauth-authorization-server/mcp")
	) {
		return { kind: "oauth-metadata-as" };
	}
	if (verb === "POST" && requestPath === "/oauth/register") {
		return { kind: "oauth-register" };
	}
	if (verb === "GET" && requestPath === "/oauth/authorize") {
		return { kind: "oauth-authorize" };
	}
	if (verb === "POST" && requestPath === "/oauth/token") {
		return { kind: "oauth-token" };
	}
	if (verb === "POST" && requestPath === "/oauth/revoke") {
		return { kind: "oauth-revoke" };
	}
	if (verb === "POST" && requestPath === "/import/transactions/preview") {
		return { kind: "import-preview" };
	}
	if (verb === "POST" && requestPath === "/import/transactions") {
		return { kind: "import-commit" };
	}
	if (verb === "POST" && requestPath === "/import/columns/detect") {
		return { kind: "import-detect" };
	}
	return { kind: "not-found" };
}

export function authorizeGatewayWrite(input: {
	isVaultUnlocked: boolean;
	agentContext: LocalAgentContext | null;
}): GatewayAuthResult {
	if (!input.isVaultUnlocked) {
		return { ok: false, status: 503, error: "Local vault is locked" };
	}
	if (!input.agentContext) {
		return { ok: false, status: 401, error: "Invalid or missing agent token" };
	}
	if (
		!hasRequiredScopes(input.agentContext.scopes, ["mcp:transactions:write"])
	) {
		return {
			ok: false,
			status: 403,
			error: `Agent "${input.agentContext.label}" lacks required scopes: mcp:transactions:write`,
		};
	}
	return { ok: true, agentContext: input.agentContext };
}

export function getBearerToken(
	authorizationHeader: string | undefined,
): string {
	const header = authorizationHeader ?? "";
	if (!header.startsWith("Bearer ")) return "";
	return header.slice(7).trim();
}
