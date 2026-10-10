import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	authorizeGatewayWrite,
	getBearerToken,
	matchGatewayRoute,
} from "./gateway-routes";
import type { LocalAgentContext } from "./types";

function agent(scopes: LocalAgentContext["scopes"]): LocalAgentContext {
	return {
		tokenId: "ltk_test",
		label: "Test agent",
		scopes,
		userId: "local-user",
	};
}

describe("matchGatewayRoute", () => {
	it("routes MCP methods", () => {
		assert.deepEqual(matchGatewayRoute("POST", "/mcp"), { kind: "mcp" });
		assert.deepEqual(matchGatewayRoute("GET", "/mcp"), { kind: "mcp" });
		assert.deepEqual(matchGatewayRoute("DELETE", "/mcp"), { kind: "mcp" });
	});

	it("routes import POSTs", () => {
		assert.deepEqual(
			matchGatewayRoute("POST", "/import/transactions/preview"),
			{
				kind: "import-preview",
			},
		);
		assert.deepEqual(matchGatewayRoute("POST", "/import/transactions"), {
			kind: "import-commit",
		});
		assert.deepEqual(matchGatewayRoute("POST", "/import/columns/detect"), {
			kind: "import-detect",
		});
		assert.deepEqual(
			matchGatewayRoute("POST", "/import/transactions/preview/"),
			{ kind: "import-preview" },
		);
	});

	it("returns not-found for unrelated paths", () => {
		assert.deepEqual(matchGatewayRoute("GET", "/import/transactions"), {
			kind: "not-found",
		});
		assert.deepEqual(matchGatewayRoute("POST", "/foo"), { kind: "not-found" });
		assert.deepEqual(matchGatewayRoute("POST", "/mcp/extra"), {
			kind: "not-found",
		});
	});
});

describe("authorizeGatewayWrite", () => {
	it("returns 503 when the vault is locked", () => {
		const result = authorizeGatewayWrite({
			isVaultUnlocked: false,
			agentContext: agent(["mcp:transactions:write"]),
		});
		assert.equal(result.ok, false);
		if (!result.ok) assert.equal(result.status, 503);
	});

	it("returns 401 without a token", () => {
		const result = authorizeGatewayWrite({
			isVaultUnlocked: true,
			agentContext: null,
		});
		assert.equal(result.ok, false);
		if (!result.ok) assert.equal(result.status, 401);
	});

	it("returns 403 without the write scope", () => {
		const result = authorizeGatewayWrite({
			isVaultUnlocked: true,
			agentContext: agent(["mcp:transactions:read"]),
		});
		assert.equal(result.ok, false);
		if (!result.ok) assert.equal(result.status, 403);
	});

	it("allows a token with transactions write", () => {
		const context = agent(["mcp:transactions:write"]);
		const result = authorizeGatewayWrite({
			isVaultUnlocked: true,
			agentContext: context,
		});
		assert.equal(result.ok, true);
		if (result.ok) assert.equal(result.agentContext.tokenId, context.tokenId);
	});
});

describe("getBearerToken", () => {
	it("reads a Bearer token and ignores other schemes", () => {
		assert.equal(getBearerToken("Bearer moat_local_abc"), "moat_local_abc");
		assert.equal(getBearerToken("Basic abc"), "");
		assert.equal(getBearerToken(undefined), "");
	});
});
