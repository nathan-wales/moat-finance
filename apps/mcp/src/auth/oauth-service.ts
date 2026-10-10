import { createHash, randomBytes } from "node:crypto";
import { assertTunnelOAuthResource } from "@moat/contracts";
import {
	filterMcpScopes,
	isMcpScope,
	type McpClientProfile,
	type McpScope,
} from "@moat/mcp-contracts";
import { addDays, addHours, addMinutes } from "date-fns";
import { getEnv } from "~/config/env";
import { isTrustedRedirectUriForProfile } from "~/hosts/registration-policy";
import { db } from "~/lib/db";
import {
	createOpaqueToken,
	hashToken,
	hashTokenCandidates,
	safeCompareHash,
} from "./token-hash";

const AUTHORIZATION_CODE_TTL_MINUTES = 10;
const ACCESS_TOKEN_TTL_HOURS = 1;
const REFRESH_TOKEN_TTL_DAYS = 30;

function hashCode(code: string): string {
	return createHash("sha256").update(code).digest("hex");
}

export function createAuthorizationCodeValue(): string {
	return randomBytes(32).toString("base64url");
}

function parseRequestedScopes(scopeValue: string | undefined): McpScope[] {
	if (!scopeValue?.trim()) return [];
	const rawScopes = scopeValue.split(/\s+/).filter(Boolean);
	const invalidScope = rawScopes.find((scope) => !isMcpScope(scope));
	if (invalidScope) throw new Error(`Unsupported MCP scope: ${invalidScope}`);
	return filterMcpScopes(rawScopes);
}

function resolveRequestedScopes(input: {
	requestedScopes: readonly McpScope[];
	clientScopes: readonly string[];
}): McpScope[] {
	const clientScopes = filterMcpScopes(input.clientScopes);
	if (clientScopes.length === 0) {
		throw new Error("MCP OAuth client has no permitted scopes");
	}

	// OAuth servers may grant a subset of requested scopes. ChatGPT discovers
	// full AS scopes_supported but ChatGPT v1 clients are read-only.
	const requestedScopes =
		input.requestedScopes.length > 0 ? input.requestedScopes : clientScopes;
	const allowedScopes = new Set(clientScopes);
	const grantedScopes = requestedScopes.filter((scope) =>
		allowedScopes.has(scope),
	);
	if (grantedScopes.length === 0) {
		throw new Error("MCP client is not allowed to request the given scopes");
	}
	return [...new Set(grantedScopes)];
}

function assertClientSecret(input: {
	clientSecretHash: string | null;
	clientSecret?: string;
}) {
	if (!input.clientSecretHash) return;
	if (!input.clientSecret) throw new Error("MCP OAuth client secret required");
	if (!safeCompareHash(input.clientSecret, input.clientSecretHash)) {
		throw new Error("Invalid MCP OAuth client secret");
	}
}

export async function getOAuthAuthorizationRequest(input: {
	responseType: string | undefined;
	clientId: string | undefined;
	redirectUri: string | undefined;
	scope: string | undefined;
	state: string | undefined;
	codeChallenge: string | undefined;
	codeChallengeMethod: string | undefined;
}) {
	if (input.responseType !== "code")
		throw new Error("unsupported_response_type");
	if (!input.clientId) throw new Error("missing_client_id");
	if (!input.redirectUri) throw new Error("missing_redirect_uri");
	if (!input.codeChallenge) throw new Error("missing_code_challenge");
	if (input.codeChallengeMethod !== "S256") {
		throw new Error("unsupported_code_challenge_method");
	}

	const client = await db.mcpOAuthClient.findFirst({
		where: { clientId: input.clientId, revokedAt: null },
		select: {
			id: true,
			clientId: true,
			name: true,
			clientProfile: true,
			redirectUris: true,
			scopes: true,
		},
	});
	if (!client) throw new Error("unknown_client");

	let redirectUris = client.redirectUris;
	if (!redirectUris.includes(input.redirectUri)) {
		// ChatGPT connector instances use unique /connector/oauth/* paths per
		// scan. Accept and persist new redirects that still match host policy.
		const trusted = isTrustedRedirectUriForProfile({
			redirectUri: input.redirectUri,
			clientProfile: client.clientProfile as McpClientProfile,
			env: getEnv(),
		});
		if (!trusted) throw new Error("invalid_redirect_uri");

		redirectUris = [...new Set([...redirectUris, input.redirectUri])];
		await db.mcpOAuthClient.update({
			where: { id: client.id },
			data: { redirectUris },
		});
	}

	return {
		client: {
			clientId: client.clientId,
			name: client.name,
			clientProfile: client.clientProfile,
			redirectUris,
			scopes: client.scopes,
		},
		redirectUri: input.redirectUri,
		scopes: resolveRequestedScopes({
			requestedScopes: parseRequestedScopes(input.scope),
			clientScopes: client.scopes,
		}),
		state: input.state,
	};
}

export async function registerOAuthClient(input: {
	clientId: string;
	name: string;
	clientProfile: McpClientProfile;
	redirectUris: readonly string[];
	scopes: readonly string[];
	clientSecret?: string;
	requestsPerMinute?: number;
}) {
	return db.mcpOAuthClient.upsert({
		where: { clientId: input.clientId },
		create: {
			clientId: input.clientId,
			name: input.name,
			clientProfile: input.clientProfile,
			redirectUris: [...input.redirectUris],
			scopes: filterMcpScopes(input.scopes),
			clientSecretHash: input.clientSecret
				? hashToken(input.clientSecret)
				: null,
			requestsPerMinute: input.requestsPerMinute ?? 60,
		},
		update: {
			name: input.name,
			clientProfile: input.clientProfile,
			redirectUris: [...input.redirectUris],
			scopes: filterMcpScopes(input.scopes),
			clientSecretHash: input.clientSecret
				? hashToken(input.clientSecret)
				: undefined,
			requestsPerMinute: input.requestsPerMinute ?? 60,
			revokedAt: null,
		},
	});
}

export async function registerDynamicOAuthClient(input: {
	name: string;
	clientProfile: McpClientProfile;
	redirectUris: readonly string[];
	scopes: readonly string[];
	grants: readonly string[];
	requestsPerMinute?: number;
}) {
	return db.mcpOAuthClient.create({
		data: {
			clientId: `moat_finance_mcp_${randomBytes(16).toString("base64url")}`,
			name: input.name,
			clientProfile: input.clientProfile,
			redirectUris: [...input.redirectUris],
			scopes: filterMcpScopes(input.scopes),
			grants: [...input.grants],
			clientSecretHash: null,
			requestsPerMinute: input.requestsPerMinute ?? 60,
		},
		select: {
			clientId: true,
			name: true,
			redirectUris: true,
			scopes: true,
			grants: true,
			createdAt: true,
		},
	});
}

export async function createAuthorizationCode(input: {
	userId: string;
	clientId: string;
	redirectUri: string;
	scopes: readonly string[];
	codeChallenge: string;
	codeChallengeMethod: "S256";
	ipAddress?: string;
	userAgent?: string;
}): Promise<{ code: string; expiresAt: Date }> {
	const client = await db.mcpOAuthClient.findFirst({
		where: { clientId: input.clientId, revokedAt: null },
		select: { id: true, redirectUris: true, scopes: true },
	});
	if (!client) throw new Error("Unknown MCP OAuth client");
	if (!client.redirectUris.includes(input.redirectUri)) {
		throw new Error("Invalid MCP OAuth redirect URI");
	}

	const requestedScopes = filterMcpScopes(input.scopes);
	const clientScopes = new Set(client.scopes);
	const scopes = requestedScopes.filter((scope) => clientScopes.has(scope));
	const code = createAuthorizationCodeValue();
	const expiresAt = addMinutes(new Date(), AUTHORIZATION_CODE_TTL_MINUTES);

	await db.mcpOAuthAuthorizationCode.create({
		data: {
			userId: input.userId,
			oauthClientId: client.id,
			codeHash: hashCode(code),
			codeChallenge: input.codeChallenge,
			codeChallengeMethod: input.codeChallengeMethod,
			redirectUri: input.redirectUri,
			scopes,
			expiresAt,
			ipAddress: input.ipAddress,
			userAgent: input.userAgent,
		},
	});

	return { code, expiresAt };
}

export function verifyPkce(input: {
	verifier: string;
	challenge: string;
	method: string;
}): boolean {
	if (input.method !== "S256") return false;
	const digest = createHash("sha256")
		.update(input.verifier)
		.digest("base64url");
	return digest === input.challenge;
}

export async function exchangeAuthorizationCode(input: {
	code: string;
	clientId: string;
	clientSecret?: string;
	redirectUri: string;
	codeVerifier: string;
	resource?: string;
}) {
	const codeHash = hashCode(input.code);
	const record = await db.mcpOAuthAuthorizationCode.findUnique({
		where: { codeHash },
		include: { oauthClient: true },
	});

	if (!record) throw new Error("Invalid MCP OAuth authorization code");
	if (record.consumedAt)
		throw new Error("MCP OAuth authorization code was already used");
	if (record.expiresAt <= new Date())
		throw new Error("MCP OAuth authorization code expired");
	if (record.redirectUri !== input.redirectUri) {
		throw new Error("MCP OAuth redirect URI mismatch");
	}
	if (record.oauthClient.clientId !== input.clientId) {
		throw new Error("MCP OAuth client mismatch");
	}
	assertClientSecret({
		clientSecretHash: record.oauthClient.clientSecretHash,
		clientSecret: input.clientSecret,
	});
	if (
		!verifyPkce({
			verifier: input.codeVerifier,
			challenge: record.codeChallenge,
			method: record.codeChallengeMethod,
		})
	) {
		throw new Error("Invalid MCP OAuth PKCE verifier");
	}
	assertTunnelOAuthResource({
		resource: input.resource,
		desktopPublicTunnelId: record.desktopPublicTunnelId,
	});

	const accessToken = createOpaqueToken("moat_oauth");
	const refreshToken = createOpaqueToken("moat_oauth");
	const expiresAt = addHours(new Date(), ACCESS_TOKEN_TTL_HOURS);
	const refreshTokenExpiresAt = addDays(new Date(), REFRESH_TOKEN_TTL_DAYS);

	await db.$transaction([
		db.mcpOAuthAuthorizationCode.update({
			where: { id: record.id },
			data: { consumedAt: new Date() },
		}),
		db.mcpOAuthAccessToken.create({
			data: {
				userId: record.userId,
				oauthClientId: record.oauthClientId,
				tokenPrefix: accessToken.tokenPrefix,
				tokenHash: accessToken.tokenHash,
				refreshTokenHash: refreshToken.tokenHash,
				refreshTokenExpiresAt,
				scopes: record.scopes,
				desktopPublicTunnelId: record.desktopPublicTunnelId,
				expiresAt,
			},
		}),
	]);

	return {
		accessToken: accessToken.token,
		refreshToken: refreshToken.token,
		tokenType: "Bearer" as const,
		expiresIn: ACCESS_TOKEN_TTL_HOURS * 60 * 60,
		scopes: filterMcpScopes(record.scopes),
	};
}

export async function refreshOAuthAccessToken(input: {
	refreshToken: string;
	clientId: string;
	clientSecret?: string;
	resource?: string;
}) {
	const refreshTokenHashes = hashTokenCandidates(input.refreshToken);
	const record = await db.mcpOAuthAccessToken.findFirst({
		where: { refreshTokenHash: { in: refreshTokenHashes } },
		include: { oauthClient: true },
	});

	if (!record?.refreshTokenHash)
		throw new Error("Invalid MCP OAuth refresh token");
	if (record.revokedAt) throw new Error("MCP OAuth token was revoked");
	if (
		record.refreshTokenExpiresAt &&
		record.refreshTokenExpiresAt <= new Date()
	) {
		throw new Error("MCP OAuth refresh token expired");
	}
	if (record.oauthClient.revokedAt) throw new Error("MCP OAuth client revoked");
	if (record.oauthClient.clientId !== input.clientId) {
		throw new Error("MCP OAuth client mismatch");
	}
	assertClientSecret({
		clientSecretHash: record.oauthClient.clientSecretHash,
		clientSecret: input.clientSecret,
	});
	assertTunnelOAuthResource({
		resource: input.resource,
		desktopPublicTunnelId: record.desktopPublicTunnelId,
	});

	const accessToken = createOpaqueToken("moat_oauth");
	const refreshToken = createOpaqueToken("moat_oauth");
	const expiresAt = addHours(new Date(), ACCESS_TOKEN_TTL_HOURS);
	const refreshTokenExpiresAt = addDays(new Date(), REFRESH_TOKEN_TTL_DAYS);

	await db.$transaction([
		db.mcpOAuthAccessToken.update({
			where: { id: record.id },
			data: { revokedAt: new Date() },
		}),
		db.mcpOAuthAccessToken.create({
			data: {
				userId: record.userId,
				oauthClientId: record.oauthClientId,
				tokenPrefix: accessToken.tokenPrefix,
				tokenHash: accessToken.tokenHash,
				refreshTokenHash: refreshToken.tokenHash,
				refreshTokenExpiresAt,
				scopes: record.scopes,
				desktopPublicTunnelId: record.desktopPublicTunnelId,
				expiresAt,
			},
		}),
	]);

	return {
		accessToken: accessToken.token,
		refreshToken: refreshToken.token,
		tokenType: "Bearer" as const,
		expiresIn: ACCESS_TOKEN_TTL_HOURS * 60 * 60,
		scopes: filterMcpScopes(record.scopes),
	};
}

export async function revokeOAuthToken(input: {
	token: string;
	clientId?: string;
	clientSecret?: string;
}): Promise<void> {
	const tokenHashes = hashTokenCandidates(input.token);
	const record = await db.mcpOAuthAccessToken.findFirst({
		where: {
			OR: [
				{ tokenHash: { in: tokenHashes } },
				{ refreshTokenHash: { in: tokenHashes } },
			],
		},
		include: { oauthClient: true },
	});
	if (!record) return;
	if (input.clientId && record.oauthClient.clientId !== input.clientId) {
		throw new Error("MCP OAuth client mismatch");
	}
	assertClientSecret({
		clientSecretHash: record.oauthClient.clientSecretHash,
		clientSecret: input.clientSecret,
	});

	await db.mcpOAuthAccessToken.update({
		where: { id: record.id },
		data: { revokedAt: new Date() },
	});
}

export async function validateOAuthAccessToken(token: string): Promise<{
	id: string;
	userId: string;
	oauthClientId: string;
	clientId: string;
	clientName: string;
	clientProfile: McpClientProfile;
	scopes: McpScope[];
	desktopPublicTunnelId: string | null;
} | null> {
	const tokenHashes = hashTokenCandidates(token);
	const record = await db.mcpOAuthAccessToken.findFirst({
		where: { tokenHash: { in: tokenHashes } },
		include: { oauthClient: true },
	});
	if (!record) return null;
	if (record.revokedAt) return null;
	if (record.expiresAt <= new Date()) return null;
	if (record.oauthClient.revokedAt) return null;

	await db.mcpOAuthAccessToken.update({
		where: { id: record.id },
		data: { lastUsedAt: new Date() },
	});

	return {
		id: record.id,
		userId: record.userId,
		oauthClientId: record.oauthClientId,
		clientId: record.oauthClient.clientId,
		clientName: record.oauthClient.name,
		clientProfile: record.oauthClient.clientProfile as McpClientProfile,
		scopes: filterMcpScopes(record.scopes),
		desktopPublicTunnelId: record.desktopPublicTunnelId,
	};
}
