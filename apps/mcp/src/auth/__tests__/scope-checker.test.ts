import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	assertScopes,
	assertToolAllowedForProfile,
	McpAuthorizationError,
} from "../scope-checker";

describe("scope-checker", () => {
	it("denies missing scopes", () => {
		assert.throws(
			() => assertScopes(["mcp:accounts:read"], ["mcp:transactions:read"]),
			McpAuthorizationError,
		);
	});

	it("allows mcp:read to satisfy :read scopes", () => {
		assert.doesNotThrow(() =>
			assertScopes(["mcp:read"], ["mcp:transactions:read"]),
		);
	});

	it("blocks write tools for chatgpt profile", () => {
		assert.throws(
			() => assertToolAllowedForProfile("chatgpt", "moat.hideTransaction"),
			(error: unknown) =>
				error instanceof McpAuthorizationError &&
				error.message.includes("not available"),
		);
	});

	it("allows read tools for chatgpt profile", () => {
		assert.doesNotThrow(() =>
			assertToolAllowedForProfile("chatgpt", "moat.listAccounts"),
		);
		assert.doesNotThrow(() =>
			assertToolAllowedForProfile("chatgpt", "moat.getFinancialOverview"),
		);
	});

	it("allows write tools for local-dev", () => {
		assert.doesNotThrow(() =>
			assertToolAllowedForProfile("local-dev", "moat.hideTransaction"),
		);
	});
});
