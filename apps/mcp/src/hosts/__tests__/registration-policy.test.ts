import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	advertisedMcpScopes,
	readScopes,
	writeScopes,
} from "@moat/mcp-contracts";
import type { McpEnv } from "~/config/env";
import {
	isTrustedRedirectUriForProfile,
	OAuthClientRegistrationPolicyError,
	resolveOAuthClientRegistration,
} from "../registration-policy";

const baseEnv = {
	DATABASE_URL: "postgresql://localhost/test",
	MCP_BASE_URL: "https://mcp.moatfinance.ai",
	WEB_APP_URL: "https://app.moatfinance.ai",
	MCP_PORT: 3010,
	MCP_OAUTH_CHATGPT_REDIRECT_HOSTS: "chatgpt.com",
	NODE_ENV: "test",
} as McpEnv;

describe("resolveOAuthClientRegistration", () => {
	it("registers ChatGPT clients with read-only scopes", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
				clientName: "ChatGPT",
				scope: "mcp:accounts:read mcp:transactions:read",
			},
			env: baseEnv,
		});

		assert.equal(resolved.clientProfile, "chatgpt");
		assert.equal(resolved.registrationKind, "hosted");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes(readScopes));
		for (const scope of writeScopes) {
			assert.equal(
				(resolved.scopes as readonly string[]).includes(scope),
				false,
			);
		}
	});

	it("ignores ChatGPT write-scope requests and stores read-only allowlist", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["https://chatgpt.com/connector/oauth/callback"],
				scope: "mcp:transactions:write mcp:accounts:read",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "chatgpt");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes(readScopes));
		assert.equal(
			(resolved.scopes as readonly string[]).includes("mcp:transactions:write"),
			false,
		);
	});

	it("rejects untrusted hosted redirect hosts", () => {
		assert.throws(
			() =>
				resolveOAuthClientRegistration({
					metadata: {
						redirectUris: ["https://evil.example/oauth/callback"],
					},
					env: baseEnv,
				}),
			OAuthClientRegistrationPolicyError,
		);
	});

	it("keeps standard MCP loopback on inferred profile, not Cursor", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://127.0.0.1:54321/oauth/callback"],
				clientName: "Claude",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "claude-desktop");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
		assert.ok(
			(resolved.scopes as readonly string[]).includes("mcp:feedback:write"),
		);
	});

	it("registers unnamed loopback clients as local-dev with write scopes", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://127.0.0.1:54321/oauth/callback"],
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "local-dev");
		assert.equal(resolved.registrationKind, "loopback");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("infers Cursor from client name on standard MCP loopback", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://127.0.0.1:54321/oauth/callback"],
				clientName: "Cursor",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.equal(resolved.registrationKind, "loopback");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("registers Cursor Desktop's localhost:8787/callback as cursor loopback", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://localhost:8787/callback"],
				clientName: "Cursor",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.equal(resolved.registrationKind, "loopback");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("registers Cursor Web's agents OAuth callback as cursor hosted", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["https://www.cursor.com/agents/mcp/oauth/callback"],
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.equal(resolved.registrationKind, "hosted");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("registers mixed Cursor Desktop + Web redirects as cursor", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: [
					"http://localhost:8787/callback",
					"https://www.cursor.com/agents/mcp/oauth/callback",
					"cursor://anysphere.cursor-mcp/oauth/callback",
				],
				clientName: "Cursor",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.equal(resolved.registrationKind, "hosted");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("stores the full Cursor allowlist including writes when writes are requested", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://localhost:8787/callback"],
				scope: "mcp:transactions:write mcp:accounts:read",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
		assert.ok(
			(resolved.scopes as readonly string[]).includes("mcp:transactions:write"),
		);
		assert.ok(
			(resolved.scopes as readonly string[]).includes("mcp:feedback:write"),
		);
	});

	it("registers hosted Claude.ai callbacks with the full write catalog", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["https://claude.ai/api/mcp/auth_callback"],
				clientName: "Claude",
				scope: "mcp:accounts:read mcp:transactions:write",
			},
			env: baseEnv,
		});

		assert.equal(resolved.clientProfile, "claude");
		assert.equal(resolved.registrationKind, "hosted");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
		for (const scope of advertisedMcpScopes(writeScopes)) {
			assert.ok((resolved.scopes as readonly string[]).includes(scope));
		}
	});

	it("registers hosted Claude.com callbacks with write scopes", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["https://claude.com/api/mcp/auth_callback"],
			},
			env: baseEnv,
		});

		assert.equal(resolved.clientProfile, "claude");
		assert.equal(resolved.registrationKind, "hosted");
		assert.deepEqual(resolved.scopes, advertisedMcpScopes());
	});

	it("rejects untrusted Claude hosted callback paths", () => {
		assert.throws(
			() =>
				resolveOAuthClientRegistration({
					metadata: {
						redirectUris: ["https://claude.ai/oauth/callback"],
					},
					env: baseEnv,
				}),
			OAuthClientRegistrationPolicyError,
		);
	});
});

describe("isTrustedRedirectUriForProfile", () => {
	it("trusts Cursor Desktop and Web callbacks for an existing cursor client", () => {
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "http://127.0.0.1:8787/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "https://cursor.com/agents/mcp/oauth/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "https://evil.example/agents/mcp/oauth/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			false,
		);
	});

	it("trusts Claude hosted auth callbacks for an existing claude client", () => {
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "https://claude.ai/api/mcp/auth_callback",
				clientProfile: "claude",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "https://claude.com/api/mcp/auth_callback",
				clientProfile: "claude",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "https://claude.ai/oauth/callback",
				clientProfile: "claude",
				env: baseEnv,
			}),
			false,
		);
	});

	it("trusts RFC 8252 any-port loopback Cursor callbacks", () => {
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "http://localhost:5555/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "http://127.0.0.1:9999/oauth/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			true,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "http://localhost:8787/evil",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			false,
		);
		assert.equal(
			isTrustedRedirectUriForProfile({
				redirectUri: "http://localhost/callback",
				clientProfile: "cursor",
				env: baseEnv,
			}),
			false,
		);
	});
});

describe("resolveOAuthClientRegistration Cursor loopback ports", () => {
	it("registers Cursor Desktop ephemeral loopback ports as cursor", () => {
		const resolved = resolveOAuthClientRegistration({
			metadata: {
				redirectUris: ["http://localhost:5555/callback"],
				clientName: "Cursor",
			},
			env: baseEnv,
		});
		assert.equal(resolved.clientProfile, "cursor");
		assert.equal(resolved.registrationKind, "loopback");
	});
});
