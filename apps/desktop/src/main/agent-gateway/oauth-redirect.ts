const CURSOR_CUSTOM_SCHEME_HOST = "anysphere.cursor-mcp";
const CURSOR_CUSTOM_SCHEME_PATH = "/oauth/callback";
const CURSOR_HTTPS_HOSTS = new Set(["cursor.com", "www.cursor.com"]);
const CURSOR_WEB_CALLBACK_PATH = "/agents/mcp/oauth/callback";
const CURSOR_WEB_CALLBACK_PATH_PREFIX = "/agents/mcp/oauth/";

function parseRedirectUri(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function hasUnsafeRedirectParts(url: URL): boolean {
	return Boolean(url.username || url.password || url.search || url.hash);
}

export function isCursorCustomSchemeRedirect(value: string): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	return (
		url.protocol === "cursor:" &&
		url.hostname.toLowerCase() === CURSOR_CUSTOM_SCHEME_HOST &&
		url.pathname === CURSOR_CUSTOM_SCHEME_PATH
	);
}

export function isRfc8252LoopbackRedirect(value: string): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	return (
		url.protocol === "http:" &&
		["localhost", "127.0.0.1"].includes(url.hostname) &&
		Boolean(url.port) &&
		url.pathname.length > 0 &&
		!hasUnsafeRedirectParts(url)
	);
}

function normalizePath(path: string): string {
	if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
	return path;
}

export function isCursorHttpsRedirect(value: string): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	const path = normalizePath(url.pathname);
	return (
		url.protocol === "https:" &&
		CURSOR_HTTPS_HOSTS.has(url.hostname.toLowerCase()) &&
		(path === CURSOR_WEB_CALLBACK_PATH ||
			path.startsWith(CURSOR_WEB_CALLBACK_PATH_PREFIX)) &&
		!url.username &&
		!url.password &&
		!url.hash
	);
}

export function isLocalOAuthRedirectUri(value: string): boolean {
	return (
		isRfc8252LoopbackRedirect(value) ||
		isCursorCustomSchemeRedirect(value) ||
		isCursorHttpsRedirect(value)
	);
}

export function isLoopbackHostHeader(hostHeader: string | undefined): boolean {
	const host = (hostHeader ?? "").split(":")[0]?.toLowerCase() ?? "";
	return host === "127.0.0.1" || host === "localhost";
}
