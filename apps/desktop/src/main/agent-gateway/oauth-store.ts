import fs from "node:fs";
import path from "node:path";
import { filterLocalAgentScopes } from "./local-token-service";
import type {
	LocalOAuthAccessToken,
	LocalOAuthAuthorizationCode,
	LocalOAuthClient,
	LocalOAuthStore,
} from "./oauth-types";

const OAUTH_FILE_NAME = "agent-oauth.json";

function emptyStore(): LocalOAuthStore {
	return { clients: [], codes: [], tokens: [] };
}

function isClient(value: unknown): value is LocalOAuthClient {
	if (!value || typeof value !== "object") return false;
	const client = value as Partial<LocalOAuthClient>;
	return (
		typeof client.clientId === "string" &&
		typeof client.clientName === "string" &&
		Array.isArray(client.redirectUris) &&
		Array.isArray(client.scopes) &&
		typeof client.createdAt === "string" &&
		(client.revokedAt === null || typeof client.revokedAt === "string")
	);
}

function isCode(value: unknown): value is LocalOAuthAuthorizationCode {
	if (!value || typeof value !== "object") return false;
	const code = value as Partial<LocalOAuthAuthorizationCode>;
	return (
		typeof code.codeHash === "string" &&
		typeof code.clientId === "string" &&
		typeof code.redirectUri === "string" &&
		typeof code.codeChallenge === "string" &&
		code.codeChallengeMethod === "S256" &&
		Array.isArray(code.scopes) &&
		typeof code.expiresAt === "string" &&
		(code.consumedAt === null || typeof code.consumedAt === "string")
	);
}

function isToken(value: unknown): value is LocalOAuthAccessToken {
	if (!value || typeof value !== "object") return false;
	const token = value as Partial<LocalOAuthAccessToken>;
	return (
		typeof token.id === "string" &&
		typeof token.clientId === "string" &&
		typeof token.tokenHash === "string" &&
		typeof token.refreshTokenHash === "string" &&
		Array.isArray(token.scopes) &&
		typeof token.expiresAt === "string" &&
		typeof token.refreshTokenExpiresAt === "string" &&
		(token.revokedAt === null || typeof token.revokedAt === "string") &&
		(token.lastUsedAt === null || typeof token.lastUsedAt === "string")
	);
}

function normalizeClient(client: LocalOAuthClient): LocalOAuthClient {
	return {
		...client,
		scopes: filterLocalAgentScopes(client.scopes),
		redirectUris: client.redirectUris.filter(
			(uri): uri is string => typeof uri === "string",
		),
	};
}

function normalizeCode(
	code: LocalOAuthAuthorizationCode,
): LocalOAuthAuthorizationCode {
	return {
		...code,
		scopes: filterLocalAgentScopes(code.scopes),
	};
}

function normalizeToken(token: LocalOAuthAccessToken): LocalOAuthAccessToken {
	return {
		...token,
		scopes: filterLocalAgentScopes(token.scopes),
	};
}

export function loadOAuthStore(userDataPath: string): LocalOAuthStore {
	const filePath = path.join(userDataPath, OAUTH_FILE_NAME);
	if (!fs.existsSync(filePath)) return emptyStore();
	try {
		const parsed = JSON.parse(fs.readFileSync(filePath, "utf-8")) as unknown;
		if (!parsed || typeof parsed !== "object") return emptyStore();
		const raw = parsed as Partial<LocalOAuthStore>;
		return {
			clients: Array.isArray(raw.clients)
				? raw.clients.filter(isClient).map(normalizeClient)
				: [],
			codes: Array.isArray(raw.codes)
				? raw.codes.filter(isCode).map(normalizeCode)
				: [],
			tokens: Array.isArray(raw.tokens)
				? raw.tokens.filter(isToken).map(normalizeToken)
				: [],
		};
	} catch {
		return emptyStore();
	}
}

export function saveOAuthStore(
	userDataPath: string,
	store: LocalOAuthStore,
): void {
	const filePath = path.join(userDataPath, OAUTH_FILE_NAME);
	const next: LocalOAuthStore = {
		clients: store.clients.map(normalizeClient),
		codes: store.codes.map(normalizeCode),
		tokens: store.tokens.map(normalizeToken),
	};
	fs.writeFileSync(filePath, JSON.stringify(next, null, 2), {
		encoding: "utf-8",
		mode: 0o600,
	});
	try {
		fs.chmodSync(filePath, 0o600);
	} catch {
		// Best effort on platforms/filesystems that support POSIX permissions.
	}
}
