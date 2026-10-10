import type { AccessToken, LocalOAuthConnection } from "./types";

export const DESKTOP_ASSISTANT_PROVIDERS = [
	"Claude",
	"ChatGPT",
	"Cursor",
] as const;

export type DesktopAssistantProvider =
	(typeof DESKTOP_ASSISTANT_PROVIDERS)[number];

export const DESKTOP_PROVIDER_TOKEN_LABEL: Record<
	DesktopAssistantProvider,
	string
> = {
	Claude: "Claude Desktop",
	ChatGPT: "ChatGPT Desktop",
	Cursor: "Cursor Desktop",
};

export const MCP_LOGS_ELEMENT_ID = "mcp-logs";
export const LOGS_HIGHLIGHT_PARAM = "highlight";
export const LOGS_HIGHLIGHT_VALUE = "logs";

function isDesktopAssistantProvider(
	value: string,
): value is DesktopAssistantProvider {
	return (DESKTOP_ASSISTANT_PROVIDERS as readonly string[]).includes(value);
}

export function parseDesktopLogProvider(
	value: string | null,
): DesktopAssistantProvider | "" {
	if (value && isDesktopAssistantProvider(value)) return value;
	return "";
}

export function tokensForProvider(
	tokens: AccessToken[],
	provider: DesktopAssistantProvider,
): AccessToken[] {
	const label = DESKTOP_PROVIDER_TOKEN_LABEL[provider];
	return tokens.filter((token) => token.label === label);
}

export function latestTokenForProvider(
	tokens: AccessToken[],
	provider: DesktopAssistantProvider,
): AccessToken | null {
	const matches = tokensForProvider(tokens, provider);
	const first = matches[0];
	if (!first) return null;

	let latest = first;
	for (const token of matches) {
		if (token.createdAt > latest.createdAt) latest = token;
	}
	return latest;
}

function providerNameNeedles(
	provider: DesktopAssistantProvider,
): readonly string[] {
	if (provider === "ChatGPT") return ["chatgpt", "codex", "openai"];
	if (provider === "Claude") return ["claude", "anthropic"];
	return ["cursor"];
}

export function oauthConnectionsForProvider(
	connections: LocalOAuthConnection[],
	provider: DesktopAssistantProvider,
): LocalOAuthConnection[] {
	const needles = providerNameNeedles(provider);
	return connections.filter((connection) => {
		const name = connection.clientName.toLowerCase();
		return needles.some((needle) => name.includes(needle));
	});
}

export function latestOAuthConnectionForProvider(
	connections: LocalOAuthConnection[],
	provider: DesktopAssistantProvider,
): LocalOAuthConnection | null {
	const matches = oauthConnectionsForProvider(connections, provider);
	const first = matches[0];
	if (!first) return null;
	let latest = first;
	for (const connection of matches) {
		if (connection.createdAt > latest.createdAt) latest = connection;
	}
	return latest;
}

export function scrollToMcpLogs() {
	if (typeof document === "undefined") return;
	document.getElementById(MCP_LOGS_ELEMENT_ID)?.scrollIntoView({
		behavior: "smooth",
		block: "start",
	});
}
