import type { McpScope } from "@moat/mcp-contracts";

export type LocalOAuthClient = {
	clientId: string;
	clientName: string;
	redirectUris: string[];
	scopes: McpScope[];
	createdAt: string;
	revokedAt: string | null;
};

export type LocalOAuthAuthorizationCode = {
	codeHash: string;
	clientId: string;
	redirectUri: string;
	codeChallenge: string;
	codeChallengeMethod: "S256";
	scopes: McpScope[];
	expiresAt: string;
	consumedAt: string | null;
};

export type LocalOAuthAccessToken = {
	id: string;
	clientId: string;
	tokenHash: string;
	refreshTokenHash: string;
	scopes: McpScope[];
	expiresAt: string;
	refreshTokenExpiresAt: string;
	revokedAt: string | null;
	lastUsedAt: string | null;
};

export type LocalOAuthStore = {
	clients: LocalOAuthClient[];
	codes: LocalOAuthAuthorizationCode[];
	tokens: LocalOAuthAccessToken[];
};

export type LocalOAuthConnection = {
	clientId: string;
	clientName: string;
	createdAt: string;
	lastUsedAt: string | null;
};

export type LocalOAuthConsentPrompt = (input: {
	clientName: string;
}) => Promise<"allow" | "deny">;
