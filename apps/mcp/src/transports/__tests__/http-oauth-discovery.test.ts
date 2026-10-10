import assert from "node:assert/strict";
import { createServer, type Server } from "node:http";
import { after, before, describe, it } from "node:test";
import { readScopes } from "@moat/mcp-contracts";
import { getEnv, resetCachedEnv } from "~/config/env";
import { createOAuthDiscoveryApp } from "../oauth-discovery-http";
import { stripVercelApiPrefix } from "../public-path";

describe("stripVercelApiPrefix", () => {
	it("strips /api prefix while preserving public paths", () => {
		assert.equal(stripVercelApiPrefix("/api/mcp"), "/mcp");
		assert.equal(
			stripVercelApiPrefix("/api/.well-known/oauth-protected-resource"),
			"/.well-known/oauth-protected-resource",
		);
		assert.equal(
			stripVercelApiPrefix("/api/oauth/authorize?client_id=abc"),
			"/oauth/authorize?client_id=abc",
		);
		assert.equal(stripVercelApiPrefix("/api"), "/");
		assert.equal(stripVercelApiPrefix("/api?x=1"), "/?x=1");
		assert.equal(stripVercelApiPrefix("/mcp"), "/mcp");
	});
});

describe("HTTP OAuth discovery", () => {
	const baseUrl = "https://mcp.moatfinance.ai";
	let server: Server;
	let origin: string;

	before(async () => {
		process.env.DATABASE_URL ??= "postgresql://localhost/test";
		process.env.MCP_BASE_URL = `${baseUrl}/`;
		process.env.WEB_APP_URL ??= "https://app.moatfinance.ai";
		process.env.NODE_ENV = "test";
		resetCachedEnv();

		const app = createOAuthDiscoveryApp(getEnv());
		server = createServer(app);
		await new Promise<void>((resolve) => {
			server.listen(0, "127.0.0.1", () => resolve());
		});
		const address = server.address();
		assert.ok(address && typeof address === "object");
		origin = `http://127.0.0.1:${address.port}`;
	});

	after(async () => {
		await new Promise<void>((resolve, reject) => {
			server.close((error) => (error ? reject(error) : resolve()));
		});
		resetCachedEnv();
	});

	function assertAuthChallenge(header: string | null, invalidToken = false) {
		assert.ok(header);
		assert.match(
			header,
			new RegExp(
				`Bearer resource_metadata="${baseUrl}/.well-known/oauth-protected-resource"`,
			),
		);
		assert.match(header, /scope="/);
		for (const scope of readScopes.slice(0, 3)) {
			assert.ok(header.includes(scope));
		}
		if (invalidToken) {
			assert.match(header, /error="invalid_token"/);
		} else {
			assert.equal(header.includes('error="invalid_token"'), false);
		}
	}

	it("returns 401 with WWW-Authenticate on unauthenticated GET /mcp", async () => {
		const response = await fetch(`${origin}/mcp`);
		assert.equal(response.status, 401);
		assertAuthChallenge(response.headers.get("www-authenticate"), false);
		const body = (await response.json()) as { error?: string };
		assert.equal(body.error, "MCP_UNAUTHORIZED");
	});

	it("returns 401 with WWW-Authenticate on unauthenticated POST /mcp", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				"content-type": "application/json",
				accept: "application/json, text/event-stream",
			},
			body: JSON.stringify({
				jsonrpc: "2.0",
				id: 1,
				method: "initialize",
				params: {
					protocolVersion: "2025-03-26",
					capabilities: {},
					clientInfo: { name: "cursor", version: "1.0" },
				},
			}),
		});
		assert.equal(response.status, 401);
		assertAuthChallenge(response.headers.get("www-authenticate"), false);
	});

	it("returns 401 for empty Bearer token, not 403", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: {
				authorization: "Bearer ",
				"content-type": "application/json",
			},
			body: "{}",
		});
		assert.equal(response.status, 401);
		assert.notEqual(response.status, 403);
		assertAuthChallenge(response.headers.get("www-authenticate"), true);
	});

	it("serves protected resource metadata at origin and /mcp path", async () => {
		for (const path of [
			"/.well-known/oauth-protected-resource",
			"/.well-known/oauth-protected-resource/mcp",
		]) {
			const response = await fetch(`${origin}${path}`);
			assert.equal(response.status, 200);
			const body = (await response.json()) as {
				resource?: string;
				resource_name?: string;
				authorization_servers?: string[];
				scopes_supported?: string[];
				bearer_methods_supported?: string[];
			};
			assert.equal(body.resource, `${baseUrl}/mcp`);
			assert.equal(body.resource_name, "Moat Finance");
			assert.deepEqual(body.authorization_servers, [baseUrl]);
			assert.ok(Array.isArray(body.scopes_supported));
			assert.ok(body.scopes_supported?.includes("mcp:accounts:read"));
			assert.deepEqual(body.bearer_methods_supported, ["header"]);
		}
	});

	it("serves authorization server metadata with PKCE public-client fields", async () => {
		for (const path of [
			"/.well-known/oauth-authorization-server",
			"/.well-known/oauth-authorization-server/mcp",
		]) {
			const response = await fetch(`${origin}${path}`);
			assert.equal(response.status, 200);
			const body = (await response.json()) as {
				issuer?: string;
				authorization_endpoint?: string;
				token_endpoint?: string;
				registration_endpoint?: string;
				revocation_endpoint?: string;
				response_types_supported?: string[];
				grant_types_supported?: string[];
				code_challenge_methods_supported?: string[];
				token_endpoint_auth_methods_supported?: string[];
			};
			assert.equal(body.issuer, baseUrl);
			assert.equal(body.authorization_endpoint, `${baseUrl}/oauth/authorize`);
			assert.equal(body.token_endpoint, `${baseUrl}/oauth/token`);
			assert.equal(body.registration_endpoint, `${baseUrl}/oauth/register`);
			assert.equal(body.revocation_endpoint, `${baseUrl}/oauth/revoke`);
			assert.deepEqual(body.response_types_supported, ["code"]);
			assert.deepEqual(body.grant_types_supported, [
				"authorization_code",
				"refresh_token",
			]);
			assert.deepEqual(body.code_challenge_methods_supported, ["S256"]);
			assert.equal(body.token_endpoint_auth_methods_supported?.[0], "none");
			assert.ok(
				body.token_endpoint_auth_methods_supported?.includes(
					"client_secret_post",
				),
			);
		}
	});

	it("exposes WWW-Authenticate on CORS preflight for /mcp", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "OPTIONS",
			headers: {
				origin: "https://www.cursor.com",
				"access-control-request-method": "POST",
				"access-control-request-headers": "authorization,content-type",
			},
		});
		assert.equal(response.status, 204);
		assert.equal(response.headers.get("access-control-allow-origin"), "*");
		assert.match(
			response.headers.get("access-control-expose-headers") ?? "",
			/WWW-Authenticate/,
		);
		assert.match(
			response.headers.get("access-control-allow-headers") ?? "",
			/Authorization/i,
		);
	});

	it("returns 401 for Vercel-shaped /api/mcp after prefix rewrite", async () => {
		const response = await fetch(`${origin}/api/mcp`);
		assert.equal(response.status, 401);
		assertAuthChallenge(response.headers.get("www-authenticate"), false);
	});

	it("returns 401 for invalid JSON on /mcp without Authorization", async () => {
		const response = await fetch(`${origin}/mcp`, {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: "{not-json",
		});
		assert.equal(response.status, 401);
		assertAuthChallenge(response.headers.get("www-authenticate"), false);
	});
});
