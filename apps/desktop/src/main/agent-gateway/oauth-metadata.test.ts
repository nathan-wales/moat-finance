import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchGatewayRoute } from "./gateway-routes";
import {
	getLocalAuthChallenge,
	getLocalAuthorizationServerMetadata,
	getLocalProtectedResourceMetadata,
	LOCAL_MCP_ISSUER,
	LOCAL_MCP_RESOURCE,
} from "./oauth-metadata";
import {
	isLocalOAuthRedirectUri,
	isLoopbackHostHeader,
} from "./oauth-redirect";

describe("matchGatewayRoute oauth", () => {
	it("routes well-known metadata and oauth endpoints", () => {
		assert.deepEqual(
			matchGatewayRoute("GET", "/.well-known/oauth-protected-resource"),
			{ kind: "oauth-metadata-prm" },
		);
		assert.deepEqual(
			matchGatewayRoute("GET", "/.well-known/oauth-protected-resource/mcp"),
			{ kind: "oauth-metadata-prm" },
		);
		assert.deepEqual(
			matchGatewayRoute("GET", "/.well-known/oauth-authorization-server"),
			{ kind: "oauth-metadata-as" },
		);
		assert.deepEqual(
			matchGatewayRoute("GET", "/.well-known/oauth-authorization-server/mcp"),
			{ kind: "oauth-metadata-as" },
		);
		assert.deepEqual(matchGatewayRoute("POST", "/oauth/register"), {
			kind: "oauth-register",
		});
		assert.deepEqual(matchGatewayRoute("GET", "/oauth/authorize"), {
			kind: "oauth-authorize",
		});
		assert.deepEqual(matchGatewayRoute("POST", "/oauth/token"), {
			kind: "oauth-token",
		});
		assert.deepEqual(matchGatewayRoute("POST", "/oauth/revoke"), {
			kind: "oauth-revoke",
		});
	});
});

describe("local oauth metadata", () => {
	it("advertises the loopback issuer and resource", () => {
		const prm = getLocalProtectedResourceMetadata();
		assert.equal(prm.resource, LOCAL_MCP_RESOURCE);
		assert.deepEqual(prm.authorization_servers, [LOCAL_MCP_ISSUER]);
		assert.ok(prm.scopes_supported.includes("mcp:accounts:read"));

		const as = getLocalAuthorizationServerMetadata();
		assert.equal(as.issuer, LOCAL_MCP_ISSUER);
		assert.equal(
			as.authorization_endpoint,
			`${LOCAL_MCP_ISSUER}/oauth/authorize`,
		);
		assert.deepEqual(as.code_challenge_methods_supported, ["S256"]);
		assert.deepEqual(as.token_endpoint_auth_methods_supported, ["none"]);
	});

	it("builds a WWW-Authenticate challenge with resource_metadata", () => {
		const challenge = getLocalAuthChallenge();
		assert.match(
			challenge,
			/^Bearer resource_metadata="http:\/\/127\.0\.0\.1:3030\/\.well-known\/oauth-protected-resource"/,
		);
		assert.match(challenge, /scope="/);
		assert.doesNotMatch(challenge, /invalid_token/);

		const invalid = getLocalAuthChallenge({ invalidToken: true });
		assert.match(invalid, /error="invalid_token"/);
	});
});

describe("local oauth redirects", () => {
	it("accepts RFC 8252 loopback and the Cursor custom scheme", () => {
		assert.equal(
			isLocalOAuthRedirectUri("http://127.0.0.1:8787/callback"),
			true,
		);
		assert.equal(
			isLocalOAuthRedirectUri("http://localhost:3000/oauth/callback"),
			true,
		);
		assert.equal(
			isLocalOAuthRedirectUri("cursor://anysphere.cursor-mcp/oauth/callback"),
			true,
		);
		assert.equal(
			isLocalOAuthRedirectUri(
				"https://www.cursor.com/agents/mcp/oauth/callback",
			),
			true,
		);
		assert.equal(
			isLocalOAuthRedirectUri("https://cursor.com/agents/mcp/oauth/callback"),
			true,
		);
	});

	it("rejects non-loopback redirects", () => {
		assert.equal(
			isLocalOAuthRedirectUri("https://evil.example/callback"),
			false,
		);
		assert.equal(isLocalOAuthRedirectUri("http://127.0.0.1/callback"), false);
		assert.equal(
			isLocalOAuthRedirectUri("http://127.0.0.1:8787/callback?x=1"),
			false,
		);
	});

	it("accepts loopback Host headers", () => {
		assert.equal(isLoopbackHostHeader("127.0.0.1:3030"), true);
		assert.equal(isLoopbackHostHeader("localhost:3030"), true);
		assert.equal(isLoopbackHostHeader("example.com"), false);
	});
});
