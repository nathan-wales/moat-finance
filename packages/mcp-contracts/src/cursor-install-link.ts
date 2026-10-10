export const DEFAULT_LOCAL_MCP_SERVER_NAME = "moat-finance-local";
export const DEFAULT_CLOUD_MCP_SERVER_NAME = "moat-finance";
export const CLOUD_MCP_HTTP_URL = "https://mcp.moatfinance.ai/mcp";
export const CLAUDE_CUSTOM_CONNECTOR_NAME = "Moat Finance";
export const CLAUDE_CUSTOM_CONNECTOR_SETUP_URL =
	"https://claude.ai/new?modal=add-custom-connector#customize/connectors";

export type CursorMcpInstallScheme = "https" | "deeplink";

export type McpHttpServerConfig = {
	url: string;
	headers: {
		Authorization: string;
	};
};

export type McpUrlOnlyServerConfig = {
	url: string;
};

export function buildHttpMcpServerConfig(options: {
	url: string;
	bearerToken: string;
}): McpHttpServerConfig {
	return {
		url: options.url,
		headers: {
			Authorization: `Bearer ${options.bearerToken}`,
		},
	};
}

export function buildUrlOnlyMcpServerConfig(
	url = CLOUD_MCP_HTTP_URL,
): McpUrlOnlyServerConfig {
	return { url };
}

export function utf8ToBase64(value: string): string {
	const bytes = new TextEncoder().encode(value);
	let binary = "";
	for (const byte of bytes) {
		binary += String.fromCharCode(byte);
	}
	return btoa(binary);
}

export function buildCursorMcpInstallLink(options: {
	name: string;
	config: Record<string, unknown>;
	scheme?: CursorMcpInstallScheme;
}): string {
	const encodedConfig = utf8ToBase64(JSON.stringify(options.config));
	const params = new URLSearchParams({
		name: options.name,
		config: encodedConfig,
	});
	const query = params.toString();
	if (options.scheme === "deeplink") {
		return `cursor://anysphere.cursor-deeplink/mcp/install?${query}`;
	}
	return `https://cursor.com/en/install-mcp?${query}`;
}

export function cursorInstallOpenedMessage(serverName: string): string {
	return `Opened Cursor. Approve the install prompt if it appears, then confirm ${serverName} shows under Connected. If it isn't there, use Copy config and add a custom MCP server.`;
}

export function cursorOauthInstallOpenedMessage(serverName: string): string {
	return `Opened Cursor. Approve the install if it appears, then click Authenticate and sign in to Moat. Confirm ${serverName} shows as connected.`;
}
