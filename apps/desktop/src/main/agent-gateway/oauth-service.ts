import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import { localAgentScopes } from "./local-token-service";
import { LOCAL_MCP_RESOURCE } from "./oauth-metadata";
import { isLocalOAuthRedirectUri } from "./oauth-redirect";
import { loadOAuthStore, saveOAuthStore } from "./oauth-store";
import type { LocalOAuthConnection, LocalOAuthStore } from "./oauth-types";
import type { LocalAgentContext } from "./types";

const AUTHORIZATION_CODE_TTL_MS = 10 * 60 * 1000;
const ACCESS_TOKEN_TTL_MS = 60 * 60 * 1000;
const REFRESH_TOKEN_TTL_MS = 30 * 24 * 60 * 60 * 1000;
export const ACCESS_TOKEN_EXPIRES_IN_SECONDS = 3600;

export class LocalOAuthError extends Error {
	readonly error: string;

	constructor(error: string, message: string) {
		super(message);
		this.name = "LocalOAuthError";
		this.error = error;
	}
}

function hashValue(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

function hashesEqual(left: string, right: string): boolean {
	const a = Buffer.from(left, "hex");
	const b = Buffer.from(right, "hex");
	if (a.length !== b.length) return false;
	return timingSafeEqual(a, b);
}

function createOpaqueToken(): string {
	return `moat_oauth_${randomBytes(32).toString("base64url")}`;
}

function createAuthorizationCode(): string {
	return randomBytes(32).toString("base64url");
}

function createClientId(): string {
	return `moat_finance_mcp_${randomBytes(16).toString("base64url")}`;
}

function createTokenId(): string {
	return `otk_${randomBytes(8).toString("hex")}`;
}

export function verifyPkce(input: {
	verifier: string;
	challenge: string;
}): boolean {
	const digest = createHash("sha256")
		.update(input.verifier)
		.digest("base64url");
	return digest === input.challenge;
}

function findClient(store: LocalOAuthStore, clientId: string) {
	return store.clients.find(
		(client) => client.clientId === clientId && client.revokedAt === null,
	);
}

export function registerLocalOAuthClient(
	userDataPath: string,
	input: {
		clientName?: string;
		redirectUris: readonly string[];
		tokenEndpointAuthMethod?: string;
	},
) {
	if (
		input.tokenEndpointAuthMethod &&
		input.tokenEndpointAuthMethod !== "none"
	) {
		throw new LocalOAuthError(
			"invalid_client_metadata",
			"Local MCP OAuth only supports public clients",
		);
	}
	if (input.redirectUris.length < 1 || input.redirectUris.length > 10) {
		throw new LocalOAuthError(
			"invalid_client_metadata",
			"redirect_uris must contain between 1 and 10 URIs",
		);
	}
	for (const redirectUri of input.redirectUris) {
		if (!isLocalOAuthRedirectUri(redirectUri)) {
			throw new LocalOAuthError(
				"invalid_client_metadata",
				"Redirect URI is not allowed for the local gateway",
			);
		}
	}

	const now = new Date().toISOString();
	const client = {
		clientId: createClientId(),
		clientName: (input.clientName?.trim() || "MCP client").slice(0, 80),
		redirectUris: [...input.redirectUris],
		scopes: [...localAgentScopes],
		createdAt: now,
		revokedAt: null,
	};
	const store = loadOAuthStore(userDataPath);
	saveOAuthStore(userDataPath, {
		...store,
		clients: [...store.clients, client],
	});

	return {
		client_id: client.clientId,
		client_id_issued_at: Math.floor(Date.parse(now) / 1000),
		client_name: client.clientName,
		redirect_uris: client.redirectUris,
		token_endpoint_auth_method: "none" as const,
		grant_types: ["authorization_code", "refresh_token"],
		response_types: ["code"],
		scope: client.scopes.join(" "),
	};
}

export function validateLocalAuthorizationRequest(
	userDataPath: string,
	input: {
		clientId: string;
		redirectUri: string;
		codeChallenge: string;
		codeChallengeMethod: string;
		responseType: string;
		resource?: string;
	},
): { clientName: string } {
	if (input.responseType !== "code") {
		throw new LocalOAuthError(
			"unsupported_response_type",
			"response_type must be code",
		);
	}
	if (input.codeChallengeMethod !== "S256") {
		throw new LocalOAuthError(
			"invalid_request",
			"code_challenge_method must be S256",
		);
	}
	if (!input.codeChallenge) {
		throw new LocalOAuthError("invalid_request", "code_challenge is required");
	}
	if (input.resource && input.resource !== LOCAL_MCP_RESOURCE) {
		throw new LocalOAuthError(
			"invalid_target",
			"resource must match the local MCP resource",
		);
	}

	const store = loadOAuthStore(userDataPath);
	const client = findClient(store, input.clientId);
	if (!client) {
		throw new LocalOAuthError("invalid_client", "Unknown MCP OAuth client");
	}
	if (!client.redirectUris.includes(input.redirectUri)) {
		throw new LocalOAuthError("invalid_request", "invalid_redirect_uri");
	}
	return { clientName: client.clientName };
}

export function createLocalAuthorizationCode(
	userDataPath: string,
	input: {
		clientId: string;
		redirectUri: string;
		codeChallenge: string;
		codeChallengeMethod: string;
		responseType: string;
		resource?: string;
	},
): { code: string; stateRedirect: string } {
	if (input.responseType !== "code") {
		throw new LocalOAuthError(
			"unsupported_response_type",
			"response_type must be code",
		);
	}
	if (input.codeChallengeMethod !== "S256") {
		throw new LocalOAuthError(
			"invalid_request",
			"code_challenge_method must be S256",
		);
	}
	if (!input.codeChallenge) {
		throw new LocalOAuthError("invalid_request", "code_challenge is required");
	}

	const store = loadOAuthStore(userDataPath);
	const client = findClient(store, input.clientId);
	if (!client) {
		throw new LocalOAuthError("invalid_client", "Unknown MCP OAuth client");
	}
	if (!client.redirectUris.includes(input.redirectUri)) {
		throw new LocalOAuthError("invalid_request", "invalid_redirect_uri");
	}

	const code = createAuthorizationCode();
	const expiresAt = new Date(
		Date.now() + AUTHORIZATION_CODE_TTL_MS,
	).toISOString();
	saveOAuthStore(userDataPath, {
		...store,
		codes: [
			...store.codes,
			{
				codeHash: hashValue(code),
				clientId: client.clientId,
				redirectUri: input.redirectUri,
				codeChallenge: input.codeChallenge,
				codeChallengeMethod: "S256",
				scopes: [...client.scopes],
				expiresAt,
				consumedAt: null,
			},
		],
	});

	return { code, stateRedirect: input.redirectUri };
}

export function exchangeLocalAuthorizationCode(
	userDataPath: string,
	input: {
		code: string;
		clientId: string;
		redirectUri: string;
		codeVerifier: string;
	},
) {
	const store = loadOAuthStore(userDataPath);
	const codeHash = hashValue(input.code);
	const record = store.codes.find((code) =>
		hashesEqual(code.codeHash, codeHash),
	);
	if (!record) {
		throw new LocalOAuthError("invalid_grant", "Invalid authorization code");
	}
	if (record.consumedAt) {
		throw new LocalOAuthError(
			"invalid_grant",
			"Authorization code already used",
		);
	}
	if (Date.parse(record.expiresAt) <= Date.now()) {
		throw new LocalOAuthError("invalid_grant", "Authorization code expired");
	}
	if (record.redirectUri !== input.redirectUri) {
		throw new LocalOAuthError("invalid_grant", "Redirect URI mismatch");
	}
	if (record.clientId !== input.clientId) {
		throw new LocalOAuthError("invalid_grant", "Client mismatch");
	}
	if (
		!verifyPkce({
			verifier: input.codeVerifier,
			challenge: record.codeChallenge,
		})
	) {
		throw new LocalOAuthError("invalid_grant", "Invalid PKCE verifier");
	}

	const client = findClient(store, record.clientId);
	if (!client) {
		throw new LocalOAuthError("invalid_client", "Unknown MCP OAuth client");
	}

	const accessToken = createOpaqueToken();
	const refreshToken = createOpaqueToken();
	const now = Date.now();
	const nextCodes = store.codes.map((code) =>
		code.codeHash === record.codeHash
			? { ...code, consumedAt: new Date(now).toISOString() }
			: code,
	);
	saveOAuthStore(userDataPath, {
		...store,
		codes: nextCodes,
		tokens: [
			...store.tokens,
			{
				id: createTokenId(),
				clientId: client.clientId,
				tokenHash: hashValue(accessToken),
				refreshTokenHash: hashValue(refreshToken),
				scopes: [...record.scopes],
				expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
				refreshTokenExpiresAt: new Date(
					now + REFRESH_TOKEN_TTL_MS,
				).toISOString(),
				revokedAt: null,
				lastUsedAt: null,
			},
		],
	});

	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		token_type: "Bearer" as const,
		expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
		scope: record.scopes.join(" "),
	};
}

export function refreshLocalOAuthAccessToken(
	userDataPath: string,
	input: { refreshToken: string; clientId: string },
) {
	const store = loadOAuthStore(userDataPath);
	const refreshHash = hashValue(input.refreshToken);
	const record = store.tokens.find((token) =>
		hashesEqual(token.refreshTokenHash, refreshHash),
	);
	if (!record || record.revokedAt) {
		throw new LocalOAuthError("invalid_grant", "Invalid refresh token");
	}
	if (Date.parse(record.refreshTokenExpiresAt) <= Date.now()) {
		throw new LocalOAuthError("invalid_grant", "Refresh token expired");
	}
	if (record.clientId !== input.clientId) {
		throw new LocalOAuthError("invalid_grant", "Client mismatch");
	}
	const client = findClient(store, record.clientId);
	if (!client) {
		throw new LocalOAuthError("invalid_client", "Unknown MCP OAuth client");
	}

	const accessToken = createOpaqueToken();
	const refreshToken = createOpaqueToken();
	const now = Date.now();
	saveOAuthStore(userDataPath, {
		...store,
		tokens: [
			...store.tokens.map((token) =>
				token.id === record.id
					? { ...token, revokedAt: new Date(now).toISOString() }
					: token,
			),
			{
				id: createTokenId(),
				clientId: client.clientId,
				tokenHash: hashValue(accessToken),
				refreshTokenHash: hashValue(refreshToken),
				scopes: [...record.scopes],
				expiresAt: new Date(now + ACCESS_TOKEN_TTL_MS).toISOString(),
				refreshTokenExpiresAt: new Date(
					now + REFRESH_TOKEN_TTL_MS,
				).toISOString(),
				revokedAt: null,
				lastUsedAt: record.lastUsedAt,
			},
		],
	});

	return {
		access_token: accessToken,
		refresh_token: refreshToken,
		token_type: "Bearer" as const,
		expires_in: ACCESS_TOKEN_EXPIRES_IN_SECONDS,
		scope: record.scopes.join(" "),
	};
}

export function revokeLocalOAuthToken(
	userDataPath: string,
	input: { token: string; clientId?: string },
): void {
	const store = loadOAuthStore(userDataPath);
	const hash = hashValue(input.token);
	const now = new Date().toISOString();
	saveOAuthStore(userDataPath, {
		...store,
		tokens: store.tokens.map((token) => {
			const matchesAccess = hashesEqual(token.tokenHash, hash);
			const matchesRefresh = hashesEqual(token.refreshTokenHash, hash);
			if (!matchesAccess && !matchesRefresh) return token;
			if (input.clientId && token.clientId !== input.clientId) return token;
			return { ...token, revokedAt: now };
		}),
	});
}

export function listOAuthConnections(
	userDataPath: string,
): LocalOAuthConnection[] {
	const store = loadOAuthStore(userDataPath);
	return store.clients
		.filter((client) => client.revokedAt === null)
		.map((client) => {
			const lastUsedAt = store.tokens
				.filter((token) => token.clientId === client.clientId)
				.reduce<string | null>((latest, token) => {
					if (!token.lastUsedAt) return latest;
					if (!latest || token.lastUsedAt > latest) return token.lastUsedAt;
					return latest;
				}, null);
			return {
				clientId: client.clientId,
				clientName: client.clientName,
				createdAt: client.createdAt,
				lastUsedAt,
			};
		});
}

export function revokeOAuthClient(
	userDataPath: string,
	clientId: string,
): boolean {
	const store = loadOAuthStore(userDataPath);
	const exists = store.clients.some(
		(client) => client.clientId === clientId && client.revokedAt === null,
	);
	if (!exists) return false;
	const now = new Date().toISOString();
	saveOAuthStore(userDataPath, {
		clients: store.clients.map((client) =>
			client.clientId === clientId ? { ...client, revokedAt: now } : client,
		),
		codes: store.codes,
		tokens: store.tokens.map((token) =>
			token.clientId === clientId ? { ...token, revokedAt: now } : token,
		),
	});
	return true;
}

export function resolveOAuthAccessToken(
	userDataPath: string,
	bearerToken: string,
): LocalAgentContext | null {
	if (!bearerToken.startsWith("moat_oauth_")) return null;
	const store = loadOAuthStore(userDataPath);
	const hash = hashValue(bearerToken);
	const match = store.tokens.find((token) =>
		hashesEqual(token.tokenHash, hash),
	);
	if (!match || match.revokedAt) return null;
	if (Date.parse(match.expiresAt) <= Date.now()) return null;
	const client = findClient(store, match.clientId);
	if (!client) return null;

	try {
		saveOAuthStore(userDataPath, {
			...store,
			tokens: store.tokens.map((token) =>
				token.id === match.id
					? { ...token, lastUsedAt: new Date().toISOString() }
					: token,
			),
		});
	} catch {
		// non-critical
	}

	return {
		tokenId: match.id,
		label: client.clientName,
		scopes: match.scopes,
		userId: "local-user",
	};
}
