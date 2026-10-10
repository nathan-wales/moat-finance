import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { readScopes } from "@moat/mcp-contracts";

// Exercise the same grant subset logic used by getOAuthAuthorizationRequest.
function resolveRequestedScopes(input: {
	requestedScopes: readonly string[];
	clientScopes: readonly string[];
}): string[] {
	const allowed = new Set(input.clientScopes);
	const requested =
		input.requestedScopes.length > 0
			? input.requestedScopes
			: input.clientScopes;
	const granted = requested.filter((scope) => allowed.has(scope));
	if (granted.length === 0) {
		throw new Error("MCP client is not allowed to request the given scopes");
	}
	return [...new Set(granted)];
}

describe("OAuth authorize scope granting", () => {
	it("grants a read-only subset when ChatGPT asks for write scopes", () => {
		const granted = resolveRequestedScopes({
			requestedScopes: [
				"mcp:accounts:read",
				"mcp:transactions:read",
				"mcp:transactions:write",
				"mcp:rules:write",
			],
			clientScopes: [...readScopes],
		});
		assert.deepEqual(granted, ["mcp:accounts:read", "mcp:transactions:read"]);
		assert.equal(granted.includes("mcp:transactions:write"), false);
	});
});
