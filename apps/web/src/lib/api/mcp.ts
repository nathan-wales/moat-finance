import { getCsrfToken } from "@moat/client-ts";
import type { McpClientProfile, McpScope } from "@moat/mcp-contracts";
import { toApiUrl } from "~/lib/api-url";

type ApiEnvelope<T> = { data: T };

type ApiResponse<T> = {
	status: number;
	data: ApiEnvelope<T> | { error?: { message?: string } };
};

export type McpPersonalAccessToken = {
	id: string;
	name: string;
	tokenPrefix: string;
	scopes: McpScope[];
	clientName: string | null;
	expiresAt: string | null;
	revokedAt: string | null;
	lastUsedAt: string | null;
	createdAt: string;
};

export type CreatedMcpPersonalAccessToken = Omit<
	McpPersonalAccessToken,
	"revokedAt" | "lastUsedAt"
> & {
	token: string;
};

export type McpOAuthClientConnection = {
	oauthClientId: string;
	oauthClientIds: string[];
	clientId: string;
	name: string;
	clientProfile: string;
	tokenPrefix: string;
	scopes: McpScope[];
	connectedAt: string;
	lastUsedAt: string | null;
	expiresAt: string;
	refreshTokenExpiresAt: string | null;
	revokedAt: string | null;
};

/** @deprecated Use McpOAuthClientConnection */
export type McpOAuthConnection = McpOAuthClientConnection;

export type McpLogEntry = {
	id: string;
	clientName: string | null;
	clientProfile: string | null;
	toolName: string;
	status: string;
	durationMs: number;
	errorCode: string | null;
	rateLimited: boolean;
	requiredScopes: string[];
	grantedScopes: string[];
	createdAt: string;
	personalAccessTokenId: string | null;
	oauthAccessTokenId: string | null;
};

export type OAuthConsentRequest = {
	client: {
		clientId: string;
		name: string;
		clientProfile: McpClientProfile;
	};
	redirectUri: string;
	scopes: McpScope[];
	state: string | null;
	deviceLabel: string | null;
};

export type OAuthConsentInput = {
	response_type: "code";
	client_id: string;
	redirect_uri: string;
	scope?: string;
	state?: string;
	code_challenge: string;
	code_challenge_method: "S256";
	resource?: string;
};

function isSuccess<T>(response: ApiResponse<T>): response is {
	status: number;
	data: ApiEnvelope<T>;
} {
	return (
		response.status >= 200 && response.status < 300 && "data" in response.data
	);
}

function errorMessage(
	response: ApiResponse<unknown>,
	fallback: string,
): string {
	if ("error" in response.data) {
		return response.data.error?.message ?? fallback;
	}
	return fallback;
}

async function request<T>(
	path: string,
	options: { method?: "GET" | "POST"; body?: unknown } = {},
): Promise<T> {
	const method = options.method ?? "GET";
	const csrfToken = method === "POST" ? await getCsrfToken() : null;
	const response = await fetch(toApiUrl(path), {
		method,
		credentials: "include",
		headers: {
			...(options.body ? { "Content-Type": "application/json" } : {}),
			...(csrfToken ? { "x-csrf-token": csrfToken } : {}),
		},
		body: options.body ? JSON.stringify(options.body) : undefined,
	});
	const data = (await response.json()) as ApiResponse<T>["data"];
	const wrapped = { status: response.status, data } satisfies ApiResponse<T>;
	if (!isSuccess(wrapped)) {
		throw new Error(errorMessage(wrapped, "MCP request failed"));
	}
	return wrapped.data.data;
}

export function listMcpPersonalAccessTokens() {
	return request<{ tokens: McpPersonalAccessToken[] }>(
		"/api/v1/mcp/listPersonalAccessTokens",
	);
}

export function createMcpPersonalAccessToken(input: {
	name: string;
	clientName?: string;
	clientProfile?: McpClientProfile;
	scopes: McpScope[];
	expiresInDays?: number | null;
}) {
	return request<{ token: CreatedMcpPersonalAccessToken }>(
		"/api/v1/mcp/createPersonalAccessToken",
		{ method: "POST", body: input },
	);
}

export function revokeMcpPersonalAccessToken(input: { tokenId: string }) {
	return request<{ success: boolean }>(
		"/api/v1/mcp/revokePersonalAccessToken",
		{ method: "POST", body: input },
	);
}

export function listMcpOAuthConnections() {
	return request<{ connections: McpOAuthClientConnection[] }>(
		"/api/v1/mcp/listOAuthConnections",
	);
}

export function revokeMcpOAuthConnection(input: {
	oauthClientId?: string;
	oauthClientIds?: string[];
}) {
	return request<{ success: boolean }>("/api/v1/mcp/revokeOAuthConnection", {
		method: "POST",
		body: input,
	});
}

export function listMcpLogs(input?: {
	cursor?: string;
	limit?: number;
	status?: string;
	authType?: string;
	clientName?: string;
	clientProfiles?: string[];
	search?: string;
}) {
	const params = new URLSearchParams();
	if (input?.cursor) params.set("cursor", input.cursor);
	if (input?.limit) params.set("limit", String(input.limit));
	if (input?.status) params.set("status", input.status);
	if (input?.authType) params.set("authType", input.authType);
	if (input?.clientName) params.set("clientName", input.clientName);
	if (input?.clientProfiles?.length) {
		for (const profile of input.clientProfiles) {
			params.append("clientProfiles", profile);
		}
	}
	if (input?.search) params.set("search", input.search);
	const qs = params.toString();
	return request<{ logs: McpLogEntry[]; nextCursor: string | null }>(
		`/api/v1/mcp/listMcpLogs${qs ? `?${qs}` : ""}`,
	);
}

export function getMcpOAuthConsentRequest(input: OAuthConsentInput) {
	return request<OAuthConsentRequest>("/api/v1/mcp/getOAuthConsentRequest", {
		method: "POST",
		body: input,
	});
}

export function approveMcpOAuthConsent(
	input: OAuthConsentInput & { grantedScopes?: McpScope[] },
) {
	return request<{ redirectUrl: string; expiresAt: string }>(
		"/api/v1/mcp/approveOAuthConsent",
		{ method: "POST", body: input },
	);
}
