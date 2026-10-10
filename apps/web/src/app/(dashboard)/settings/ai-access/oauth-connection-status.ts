import type { McpOAuthClientConnection } from "~/lib/api/mcp";

export type OAuthConnectionStatus = "Active" | "Expired" | "Revoked";

export const ASSISTANT_PROVIDERS = [
	"ChatGPT",
	"Claude",
	"OpenClaw",
	"Cursor",
] as const;

export type AssistantProvider = (typeof ASSISTANT_PROVIDERS)[number];

const PROFILE_TO_PROVIDER: Record<string, AssistantProvider> = {
	chatgpt: "ChatGPT",
	"openai-api": "ChatGPT",
	codex: "ChatGPT",
	claude: "Claude",
	"claude-desktop": "Claude",
	openclaw: "OpenClaw",
	cursor: "Cursor",
};

export function oauthConnectionStatus(
	connection: McpOAuthClientConnection,
): OAuthConnectionStatus {
	if (connection.revokedAt) return "Revoked";
	const connectionExpiresAt =
		connection.refreshTokenExpiresAt ?? connection.expiresAt;
	if (new Date(connectionExpiresAt) <= new Date()) return "Expired";
	return "Active";
}

export function isActiveOAuthConnection(
	connection: McpOAuthClientConnection,
): boolean {
	return oauthConnectionStatus(connection) === "Active";
}

export function assistantProviderForProfile(
	clientProfile: string,
): AssistantProvider | null {
	return PROFILE_TO_PROVIDER[clientProfile] ?? null;
}

const PROVIDER_TO_PROFILES = Object.fromEntries(
	ASSISTANT_PROVIDERS.map((provider) => [
		provider,
		Object.entries(PROFILE_TO_PROVIDER)
			.filter(([, mapped]) => mapped === provider)
			.map(([profile]) => profile),
	]),
) as Record<AssistantProvider, string[]>;

export function clientProfilesForProvider(
	provider: AssistantProvider,
): string[] {
	return PROVIDER_TO_PROFILES[provider];
}

export function connectionsForProvider(
	connections: McpOAuthClientConnection[],
	provider: AssistantProvider,
): McpOAuthClientConnection[] {
	return connections.filter(
		(connection) =>
			isActiveOAuthConnection(connection) &&
			assistantProviderForProfile(connection.clientProfile) === provider,
	);
}

export function latestConnectionForProvider(
	connections: McpOAuthClientConnection[],
	provider: AssistantProvider,
): McpOAuthClientConnection | null {
	const matches = connectionsForProvider(connections, provider);
	const first = matches[0];
	if (!first) return null;

	let latest = first;
	for (const connection of matches) {
		const latestUsed = latest.lastUsedAt ?? latest.connectedAt;
		const candidateUsed = connection.lastUsedAt ?? connection.connectedAt;
		if (candidateUsed > latestUsed) latest = connection;
	}
	return latest;
}

export const MCP_LOGS_HASH = "#mcp-logs";
export const MCP_LOGS_ELEMENT_ID = "mcp-logs";

export const CONNECT_HIGHLIGHT_PARAM = "highlight";
export const CONNECT_HIGHLIGHT_VALUE = "connect";
export const LOGS_HIGHLIGHT_VALUE = "logs";
export const CONNECT_CARD_ELEMENT_ID = "ai-assistant-connect-card";

export function oauthConnectHighlightHref(): string {
	const params = new URLSearchParams({
		[CONNECT_HIGHLIGHT_PARAM]: CONNECT_HIGHLIGHT_VALUE,
	});
	return `/ai-access?${params.toString()}`;
}

export function oauthLogsHref(provider?: AssistantProvider | null): string {
	const params = new URLSearchParams({
		tab: "settings",
		authType: "OAuth",
		[CONNECT_HIGHLIGHT_PARAM]: LOGS_HIGHLIGHT_VALUE,
	});
	if (provider) params.set("provider", provider);
	return `/ai-access?${params.toString()}${MCP_LOGS_HASH}`;
}

export function patLogsHref(): string {
	const params = new URLSearchParams({
		tab: "settings",
		authType: "PAT",
		[CONNECT_HIGHLIGHT_PARAM]: LOGS_HIGHLIGHT_VALUE,
	});
	return `/ai-access?${params.toString()}${MCP_LOGS_HASH}`;
}

export function scrollToMcpLogs() {
	if (typeof document === "undefined") return;
	document.getElementById(MCP_LOGS_ELEMENT_ID)?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
}

/**
 * Scroll after View logs navigation. Covers same-URL clicks and hash-only
 * updates where the logs card is already mounted and filter props don't change.
 */
export function onMcpLogsLinkClick() {
	if (typeof window === "undefined") return;
	window.setTimeout(() => {
		if (window.location.hash !== MCP_LOGS_HASH) return;
		requestAnimationFrame(() => {
			requestAnimationFrame(() => {
				scrollToMcpLogs();
			});
		});
	}, 50);
}

export function parseAiAccessTab(value: string | null): "connect" | "settings" {
	if (value === "settings") return "settings";
	return "connect";
}

export function parseMcpLogAuthType(value: string | null): string {
	if (value === "OAuth" || value === "PAT") return value;
	return "";
}

function isAssistantProvider(value: string): value is AssistantProvider {
	return (ASSISTANT_PROVIDERS as readonly string[]).includes(value);
}

export function parseMcpLogProvider(
	value: string | null,
): AssistantProvider | "" {
	if (value && isAssistantProvider(value)) return value;
	return "";
}
