import { createHash, randomBytes } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import {
	advertisedMcpScopes,
	desktopMcpScopes,
	isMcpScope,
	type McpScope,
} from "@moat/mcp-contracts";
import type { AgentToken, LocalAgentContext } from "./types";

const TOKEN_FILE_NAME = "agent-tokens.json";

export const localAgentScopes: readonly McpScope[] =
	advertisedMcpScopes(desktopMcpScopes);

export const localAgentReadScopes = localAgentScopes.filter((scope) =>
	scope.endsWith(":read"),
);

const localAgentScopeSet = new Set<string>(localAgentScopes);
const DEFAULT_SCOPES: McpScope[] = [...localAgentScopes];

function hashToken(raw: string): string {
	return createHash("sha256").update(raw).digest("hex");
}

export function filterLocalAgentScopes(scopes: readonly unknown[]): McpScope[] {
	const filtered = scopes.filter(
		(scope): scope is McpScope =>
			typeof scope === "string" &&
			isMcpScope(scope) &&
			localAgentScopeSet.has(scope),
	);

	return [...new Set(filtered)];
}

function isAgentToken(value: unknown): value is AgentToken {
	if (!value || typeof value !== "object") return false;
	const token = value as Partial<AgentToken>;
	return (
		typeof token.id === "string" &&
		typeof token.label === "string" &&
		typeof token.tokenHash === "string" &&
		Array.isArray(token.scopes) &&
		typeof token.createdAt === "string" &&
		(token.lastUsedAt === null || typeof token.lastUsedAt === "string")
	);
}

function normalizeToken(token: AgentToken): AgentToken {
	return {
		...token,
		scopes: filterLocalAgentScopes(token.scopes),
	};
}

function loadTokens(userDataPath: string): AgentToken[] {
	const filePath = path.join(userDataPath, TOKEN_FILE_NAME);
	if (!fs.existsSync(filePath)) return [];
	try {
		const raw = fs.readFileSync(filePath, "utf-8");
		const parsed = JSON.parse(raw) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter(isAgentToken).map(normalizeToken);
	} catch {
		return [];
	}
}

function saveTokens(userDataPath: string, tokens: AgentToken[]): void {
	const filePath = path.join(userDataPath, TOKEN_FILE_NAME);
	fs.writeFileSync(
		filePath,
		JSON.stringify(tokens.map(normalizeToken), null, 2),
		{
			encoding: "utf-8",
			mode: 0o600,
		},
	);
	try {
		fs.chmodSync(filePath, 0o600);
	} catch {
		// Best effort on platforms/filesystems that support POSIX permissions.
	}
}

/**
 * Generates a new local agent token, persists it, and returns the plaintext
 * value (shown to the user once — never stored).
 */
export function generateToken(
	userDataPath: string,
	label: string,
	scopes: McpScope[] = DEFAULT_SCOPES,
): { token: AgentToken; plaintext: string } {
	const grantedScopes = filterLocalAgentScopes(scopes);
	if (grantedScopes.length === 0) {
		throw new Error("At least one local agent scope is required.");
	}

	const plaintext = `moat_local_${randomBytes(24).toString("hex")}`;
	const tokenId = `ltk_${randomBytes(8).toString("hex")}`;

	const token: AgentToken = {
		id: tokenId,
		label: label.trim().slice(0, 80),
		tokenHash: hashToken(plaintext),
		scopes: grantedScopes,
		createdAt: new Date().toISOString(),
		lastUsedAt: null,
	};

	const existing = loadTokens(userDataPath);
	saveTokens(userDataPath, [...existing, token]);

	return { token, plaintext };
}

/** Returns all stored tokens (no plaintext values). */
export function listTokens(userDataPath: string): AgentToken[] {
	return loadTokens(userDataPath);
}

/** Revokes a specific token by ID. Returns true if found and removed. */
export function revokeToken(userDataPath: string, tokenId: string): boolean {
	const tokens = loadTokens(userDataPath);
	const next = tokens.filter((t) => t.id !== tokenId);
	if (next.length === tokens.length) return false;
	saveTokens(userDataPath, next);
	return true;
}

/** Revokes all stored tokens. */
export function revokeAllTokens(userDataPath: string): void {
	saveTokens(userDataPath, []);
}

/**
 * Validates a Bearer token value and returns the resolved agent context
 * if valid, or null if invalid/expired/not-found.
 */
export function resolveAgentToken(
	userDataPath: string,
	bearerToken: string,
): LocalAgentContext | null {
	if (!bearerToken || bearerToken.length > 200) return null;

	const tokens = loadTokens(userDataPath);
	const hash = hashToken(bearerToken);
	const match = tokens.find((t) => t.tokenHash === hash);
	if (!match) return null;

	// Update last used timestamp (best-effort — ignore file errors)
	try {
		const updated = tokens.map((t) =>
			t.id === match.id ? { ...t, lastUsedAt: new Date().toISOString() } : t,
		);
		saveTokens(userDataPath, updated);
	} catch {
		// non-critical
	}

	return {
		tokenId: match.id,
		label: match.label,
		scopes: match.scopes,
		userId: "local-user",
	};
}
