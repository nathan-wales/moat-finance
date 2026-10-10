import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { after, describe, it } from "node:test";
import { localAgentScopes } from "./local-token-service";
import {
	createLocalAuthorizationCode,
	exchangeLocalAuthorizationCode,
	listOAuthConnections,
	refreshLocalOAuthAccessToken,
	registerLocalOAuthClient,
	resolveOAuthAccessToken,
	revokeLocalOAuthToken,
	revokeOAuthClient,
} from "./oauth-service";

const tempDirs: string[] = [];

function tempUserDataPath(): string {
	const dir = fs.mkdtempSync(path.join(os.tmpdir(), "moat-agent-oauth-"));
	tempDirs.push(dir);
	return dir;
}

function pkcePair() {
	const verifier = `v${"a".repeat(42)}`;
	const challenge = createHash("sha256").update(verifier).digest("base64url");
	return { verifier, challenge };
}

after(() => {
	for (const dir of tempDirs) {
		fs.rmSync(dir, { recursive: true, force: true });
	}
});

describe("local oauth service", () => {
	it("registers a public client and rejects non-loopback redirects", () => {
		const userDataPath = tempUserDataPath();
		assert.throws(
			() =>
				registerLocalOAuthClient(userDataPath, {
					clientName: "Evil",
					redirectUris: ["https://evil.example/callback"],
				}),
			/not allowed/i,
		);

		const registered = registerLocalOAuthClient(userDataPath, {
			clientName: "Cursor",
			redirectUris: [
				"http://localhost:8787/callback",
				"https://www.cursor.com/agents/mcp/oauth/callback",
				"cursor://anysphere.cursor-mcp/oauth/callback",
			],
		});
		assert.match(registered.client_id, /^moat_finance_mcp_/);
		assert.equal(registered.token_endpoint_auth_method, "none");
		assert.equal(registered.scope.split(" ").length, localAgentScopes.length);
	});

	it("exchanges a PKCE code, refreshes, and resolves the access token", () => {
		const userDataPath = tempUserDataPath();
		const { verifier, challenge } = pkcePair();
		const registered = registerLocalOAuthClient(userDataPath, {
			clientName: "Cursor",
			redirectUris: ["http://127.0.0.1:8787/callback"],
		});
		const { code } = createLocalAuthorizationCode(userDataPath, {
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:8787/callback",
			codeChallenge: challenge,
			codeChallengeMethod: "S256",
			responseType: "code",
		});

		const tokens = exchangeLocalAuthorizationCode(userDataPath, {
			code,
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:8787/callback",
			codeVerifier: verifier,
		});
		assert.match(tokens.access_token, /^moat_oauth_/);
		assert.equal(tokens.token_type, "Bearer");
		assert.equal(tokens.expires_in, 3600);

		const context = resolveOAuthAccessToken(userDataPath, tokens.access_token);
		assert.ok(context);
		assert.equal(context.label, "Cursor");
		assert.deepEqual(context.scopes, [...localAgentScopes]);

		assert.equal(
			resolveOAuthAccessToken(userDataPath, "moat_oauth_deadbeef"),
			null,
		);

		const refreshed = refreshLocalOAuthAccessToken(userDataPath, {
			refreshToken: tokens.refresh_token,
			clientId: registered.client_id,
		});
		assert.notEqual(refreshed.access_token, tokens.access_token);
		assert.equal(
			resolveOAuthAccessToken(userDataPath, tokens.access_token),
			null,
		);
		assert.ok(resolveOAuthAccessToken(userDataPath, refreshed.access_token));
	});

	it("revokes a token and a client", () => {
		const userDataPath = tempUserDataPath();
		const { verifier, challenge } = pkcePair();
		const registered = registerLocalOAuthClient(userDataPath, {
			clientName: "Claude",
			redirectUris: ["http://127.0.0.1:9999/callback"],
		});
		const { code } = createLocalAuthorizationCode(userDataPath, {
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:9999/callback",
			codeChallenge: challenge,
			codeChallengeMethod: "S256",
			responseType: "code",
		});
		const tokens = exchangeLocalAuthorizationCode(userDataPath, {
			code,
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:9999/callback",
			codeVerifier: verifier,
		});

		revokeLocalOAuthToken(userDataPath, { token: tokens.access_token });
		assert.equal(
			resolveOAuthAccessToken(userDataPath, tokens.access_token),
			null,
		);

		const { verifier: verifier2, challenge: challenge2 } = pkcePair();
		const { code: code2 } = createLocalAuthorizationCode(userDataPath, {
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:9999/callback",
			codeChallenge: challenge2,
			codeChallengeMethod: "S256",
			responseType: "code",
		});
		const tokens2 = exchangeLocalAuthorizationCode(userDataPath, {
			code: code2,
			clientId: registered.client_id,
			redirectUri: "http://127.0.0.1:9999/callback",
			codeVerifier: verifier2,
		});

		assert.equal(listOAuthConnections(userDataPath).length, 1);
		assert.equal(revokeOAuthClient(userDataPath, registered.client_id), true);
		assert.equal(listOAuthConnections(userDataPath).length, 0);
		assert.equal(
			resolveOAuthAccessToken(userDataPath, tokens2.access_token),
			null,
		);
	});
});
