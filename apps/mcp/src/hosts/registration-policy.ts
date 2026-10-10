import {
	advertisedMcpScopes,
	filterMcpScopes,
	isMcpScope,
	type McpClientProfile,
	type McpScope,
	readScopes,
} from "@moat/mcp-contracts";
import type { McpEnv } from "~/config/env";

type RegistrationMetadata = {
	redirectUris: readonly string[];
	clientName?: string;
	clientUri?: string;
	softwareId?: string;
	softwareVersion?: string;
	scope?: string;
};

export type ResolvedOAuthClientRegistration = {
	clientName: string;
	clientProfile: McpClientProfile;
	redirectUris: readonly string[];
	scopes: McpScope[];
	requestsPerMinute: number;
	registrationKind: "loopback" | "hosted";
};

type HostedClientPolicy = {
	profile: McpClientProfile;
	clientName: string;
	redirectHosts: readonly string[];
	allowedScopes: readonly McpScope[];
	defaultScopes: readonly McpScope[];
	requestsPerMinute: number;
	pathAllowed?: (path: string) => boolean;
};

const DEFAULT_CURSOR_REDIRECT_HOSTS = ["www.cursor.com", "cursor.com"] as const;
const DEFAULT_CLAUDE_REDIRECT_HOSTS = ["claude.ai", "claude.com"] as const;
const CURSOR_DESKTOP_CALLBACK_PATH = "/callback";
const MCP_LOOPBACK_CALLBACK_PATH = "/oauth/callback";
const CURSOR_TRUSTED_LOOPBACK_PATHS = new Set([
	CURSOR_DESKTOP_CALLBACK_PATH,
	MCP_LOOPBACK_CALLBACK_PATH,
]);
const CURSOR_WEB_CALLBACK_PATH = "/agents/mcp/oauth/callback";
const CURSOR_WEB_CALLBACK_PATH_PREFIX = "/agents/mcp/oauth/";
const CURSOR_CUSTOM_SCHEME_HOST = "anysphere.cursor-mcp";
const CURSOR_CUSTOM_SCHEME_PATH = "/oauth/callback";
const CLAUDE_HOSTED_CALLBACK_PATH = "/api/mcp/auth_callback";

export class OAuthClientRegistrationPolicyError extends Error {
	readonly errorCode = "invalid_client_metadata";
}

function registrationPolicyError(message: string) {
	return new OAuthClientRegistrationPolicyError(message);
}

function parseHostList(value: string | undefined): string[] {
	if (!value?.trim()) return [];
	return value
		.split(",")
		.map((item) => item.trim().toLowerCase())
		.filter(Boolean);
}

function parseRedirectUri(value: string): URL | null {
	try {
		return new URL(value);
	} catch {
		return null;
	}
}

function normalizePath(path: string): string {
	if (path.length > 1 && path.endsWith("/")) return path.slice(0, -1);
	return path;
}

function hasUnsafeRedirectParts(url: URL): boolean {
	return Boolean(url.username || url.password || url.search || url.hash);
}

function getCursorRedirectHosts(env: McpEnv): string[] {
	const parsed = parseHostList(env.MCP_OAUTH_CURSOR_REDIRECT_HOSTS);
	return parsed.length > 0 ? parsed : [...DEFAULT_CURSOR_REDIRECT_HOSTS];
}

function getClaudeRedirectHosts(env: McpEnv): string[] {
	const parsed = parseHostList(env.MCP_OAUTH_CLAUDE_REDIRECT_HOSTS);
	return parsed.length > 0 ? parsed : [...DEFAULT_CLAUDE_REDIRECT_HOSTS];
}

function isClaudeHostedCallbackPath(path: string): boolean {
	return normalizePath(path) === CLAUDE_HOSTED_CALLBACK_PATH;
}

function isCursorWebCallbackPath(path: string): boolean {
	const normalized = normalizePath(path);
	return (
		normalized === CURSOR_WEB_CALLBACK_PATH ||
		normalized.startsWith(CURSOR_WEB_CALLBACK_PATH_PREFIX)
	);
}

function isLoopbackHttpRedirect(url: URL, allowedPaths: ReadonlySet<string>) {
	return (
		url.protocol === "http:" &&
		["localhost", "127.0.0.1"].includes(url.hostname) &&
		Boolean(url.port) &&
		allowedPaths.has(normalizePath(url.pathname)) &&
		!hasUnsafeRedirectParts(url)
	);
}

export function isCursorDesktopLoopbackRedirect(value: string): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	return isLoopbackHttpRedirect(url, new Set([CURSOR_DESKTOP_CALLBACK_PATH]));
}

function isRfc8252LoopbackRedirect(value: string): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	return isLoopbackHttpRedirect(url, CURSOR_TRUSTED_LOOPBACK_PATHS);
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

function isCursorWebRedirect(value: string, env: McpEnv): boolean {
	const url = parseRedirectUri(value);
	if (!url) return false;
	return (
		url.protocol === "https:" &&
		getCursorRedirectHosts(env).includes(url.hostname.toLowerCase()) &&
		isCursorWebCallbackPath(url.pathname) &&
		!url.username &&
		!url.password &&
		!url.hash
	);
}

export function isTrustedCursorRedirectUri(
	redirectUri: string,
	env: McpEnv,
): boolean {
	return (
		isRfc8252LoopbackRedirect(redirectUri) ||
		isCursorCustomSchemeRedirect(redirectUri) ||
		isCursorWebRedirect(redirectUri, env)
	);
}

function isDistinctivelyCursorRedirect(redirectUri: string, env: McpEnv) {
	return (
		isCursorDesktopLoopbackRedirect(redirectUri) ||
		isCursorCustomSchemeRedirect(redirectUri) ||
		isCursorWebRedirect(redirectUri, env)
	);
}

function isCursorDynamicRegistration(
	redirectUris: readonly string[],
	env: McpEnv,
) {
	return (
		redirectUris.every((redirectUri) =>
			isTrustedCursorRedirectUri(redirectUri, env),
		) &&
		redirectUris.some((redirectUri) =>
			isDistinctivelyCursorRedirect(redirectUri, env),
		)
	);
}

function oauthScopesForProfile(profile: McpClientProfile): readonly McpScope[] {
	if (profile === "chatgpt") return advertisedMcpScopes(readScopes);
	return advertisedMcpScopes();
}

function getHostedClientPolicies(env: McpEnv): HostedClientPolicy[] {
	return [
		{
			profile: "chatgpt",
			clientName: "ChatGPT",
			redirectHosts: parseHostList(
				env.MCP_OAUTH_CHATGPT_REDIRECT_HOSTS ?? "chatgpt.com",
			),
			// ChatGPT Apps v1 is read-only personal finance. Expand for write tools in v2.
			allowedScopes: oauthScopesForProfile("chatgpt"),
			defaultScopes: oauthScopesForProfile("chatgpt"),
			requestsPerMinute: 60,
			pathAllowed: (path) =>
				path === "/connector_platform_oauth_redirect" ||
				path.startsWith("/connector/oauth/"),
		},
		{
			profile: "cursor",
			clientName: "Cursor",
			redirectHosts: getCursorRedirectHosts(env),
			allowedScopes: oauthScopesForProfile("cursor"),
			defaultScopes: oauthScopesForProfile("cursor"),
			requestsPerMinute: 60,
			pathAllowed: isCursorWebCallbackPath,
		},
		{
			profile: "claude",
			clientName: "Claude",
			redirectHosts: getClaudeRedirectHosts(env),
			allowedScopes: oauthScopesForProfile("claude"),
			defaultScopes: oauthScopesForProfile("claude"),
			requestsPerMinute: 60,
			pathAllowed: isClaudeHostedCallbackPath,
		},
		{
			profile: "gemini",
			clientName: "Gemini",
			redirectHosts: parseHostList(env.MCP_OAUTH_GEMINI_REDIRECT_HOSTS),
			allowedScopes: oauthScopesForProfile("gemini"),
			defaultScopes: oauthScopesForProfile("gemini"),
			requestsPerMinute: 60,
		},
		{
			profile: "consumer",
			clientName: "Consumer MCP App",
			redirectHosts: parseHostList(env.MCP_OAUTH_CONSUMER_REDIRECT_HOSTS),
			allowedScopes: oauthScopesForProfile("consumer"),
			defaultScopes: oauthScopesForProfile("consumer"),
			requestsPerMinute: 30,
		},
	];
}

function parseRequestedScopes(input: {
	scope: string | undefined;
	allowedScopes: readonly McpScope[];
	defaultScopes: readonly McpScope[];
}): McpScope[] {
	if (!input.scope?.trim()) return [...input.defaultScopes];

	const rawScopes = input.scope.split(/\s+/).filter(Boolean);
	const invalidScope = rawScopes.find((value) => !isMcpScope(value));
	if (invalidScope) {
		throw registrationPolicyError(`Unsupported MCP scope: ${invalidScope}`);
	}
	const requestedScopes = advertisedMcpScopes(filterMcpScopes(rawScopes));
	if (requestedScopes.length === 0) return [...input.defaultScopes];

	const allowedScopes = new Set(input.allowedScopes);
	const deniedScope = requestedScopes.find(
		(value) => !allowedScopes.has(value),
	);
	if (deniedScope) {
		throw registrationPolicyError(
			`MCP client is not allowed to request ${deniedScope}`,
		);
	}

	return [...new Set(requestedScopes)];
}

function getMetadataText(input: RegistrationMetadata): string {
	return [
		input.clientName,
		input.clientUri,
		input.softwareId,
		input.softwareVersion,
	]
		.filter(Boolean)
		.join(" ")
		.toLowerCase();
}

function inferLoopbackProfile(input: RegistrationMetadata): McpClientProfile {
	const metadataText = getMetadataText(input);
	if (metadataText.includes("cursor")) return "cursor";
	if (metadataText.includes("claude")) return "claude-desktop";
	if (metadataText.includes("codex")) return "codex";
	if (metadataText.includes("openclaw")) return "openclaw";
	return "local-dev";
}

function assertLoopbackRedirectUri(value: string) {
	const url = new URL(value);
	if (url.protocol !== "http:") {
		throw registrationPolicyError("Loopback OAuth redirect URI must use http");
	}
	if (!["localhost", "127.0.0.1"].includes(url.hostname)) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must use localhost or 127.0.0.1",
		);
	}
	if (!url.port) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must include a callback port",
		);
	}
	if (url.pathname !== "/oauth/callback") {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI must use /oauth/callback",
		);
	}
	if (url.username || url.password || url.search || url.hash) {
		throw registrationPolicyError(
			"Loopback OAuth redirect URI cannot include credentials, query, or hash",
		);
	}
}

function isRedirectAllowedByPolicy(
	redirectUri: string,
	policy: HostedClientPolicy,
): boolean {
	const url = new URL(redirectUri);
	const hostMatches = policy.redirectHosts.includes(url.hostname.toLowerCase());
	const pathMatches = policy.pathAllowed
		? policy.pathAllowed(url.pathname)
		: true;
	return (
		url.protocol === "https:" &&
		hostMatches &&
		pathMatches &&
		!url.username &&
		!url.password &&
		!url.hash
	);
}

function getHostedPolicyForRedirects(input: {
	redirectUris: readonly string[];
	env: McpEnv;
}): HostedClientPolicy | null {
	const policies = getHostedClientPolicies(input.env).filter(
		(policy) => policy.redirectHosts.length > 0,
	);

	return (
		policies.find((policy) =>
			input.redirectUris.every((redirectUri) =>
				isRedirectAllowedByPolicy(redirectUri, policy),
			),
		) ?? null
	);
}

/** True when a redirect URI is still trusted for an already-registered hosted client. */
export function isTrustedHostedRedirectUri(input: {
	redirectUri: string;
	clientProfile: McpClientProfile;
	env: McpEnv;
}): boolean {
	const policy = getHostedClientPolicies(input.env).find(
		(item) => item.profile === input.clientProfile,
	);
	if (!policy || policy.redirectHosts.length === 0) return false;
	try {
		return isRedirectAllowedByPolicy(input.redirectUri, policy);
	} catch {
		return false;
	}
}

/** True when authorize can persist a new redirect for this already-registered client. */
export function isTrustedRedirectUriForProfile(input: {
	redirectUri: string;
	clientProfile: McpClientProfile;
	env: McpEnv;
}): boolean {
	if (input.clientProfile === "cursor") {
		return isTrustedCursorRedirectUri(input.redirectUri, input.env);
	}
	return isTrustedHostedRedirectUri(input);
}

function isDesktopOnlyCursorRegistration(redirectUris: readonly string[]) {
	return redirectUris.every(
		(redirectUri) =>
			isCursorDesktopLoopbackRedirect(redirectUri) ||
			isCursorCustomSchemeRedirect(redirectUri),
	);
}

export function resolveOAuthClientRegistration(input: {
	metadata: RegistrationMetadata;
	env: McpEnv;
}): ResolvedOAuthClientRegistration {
	if (input.metadata.redirectUris.length === 0) {
		throw registrationPolicyError(
			"OAuth client registration requires redirect_uris",
		);
	}

	if (isCursorDynamicRegistration(input.metadata.redirectUris, input.env)) {
		if (input.metadata.scope?.trim()) {
			const rawScopes = input.metadata.scope.split(/\s+/).filter(Boolean);
			const unknownScope = rawScopes.find((value) => !isMcpScope(value));
			if (unknownScope) {
				throw registrationPolicyError(`Unsupported MCP scope: ${unknownScope}`);
			}
		}

		return {
			clientName: input.metadata.clientName ?? "Cursor",
			clientProfile: "cursor",
			redirectUris: input.metadata.redirectUris,
			scopes: [...oauthScopesForProfile("cursor")],
			requestsPerMinute: 60,
			registrationKind: isDesktopOnlyCursorRegistration(
				input.metadata.redirectUris,
			)
				? "loopback"
				: "hosted",
		};
	}

	const loopbackRedirects = input.metadata.redirectUris.every((value) => {
		const url = new URL(value);
		return (
			url.protocol === "http:" &&
			["localhost", "127.0.0.1"].includes(url.hostname)
		);
	});

	if (loopbackRedirects) {
		for (const redirectUri of input.metadata.redirectUris) {
			assertLoopbackRedirectUri(redirectUri);
		}

		const clientProfile = inferLoopbackProfile(input.metadata);
		const loopbackScopes = oauthScopesForProfile(clientProfile);

		return {
			clientName: input.metadata.clientName ?? "MCP Remote",
			clientProfile,
			redirectUris: input.metadata.redirectUris,
			scopes: parseRequestedScopes({
				scope: input.metadata.scope,
				allowedScopes: loopbackScopes,
				defaultScopes: loopbackScopes,
			}),
			requestsPerMinute: 60,
			registrationKind: "loopback",
		};
	}

	const hostedPolicy = getHostedPolicyForRedirects({
		redirectUris: input.metadata.redirectUris,
		env: input.env,
	});
	if (!hostedPolicy) {
		throw registrationPolicyError(
			"Hosted OAuth redirect URI is not trusted for dynamic client registration",
		);
	}

	// Hosted clients may advertise more scopes in AS metadata than this profile
	// allows (e.g. ChatGPT v1 is read-only). Ignore disallowed requested scopes
	// and always store the profile allowlist.
	if (input.metadata.scope?.trim()) {
		const rawScopes = input.metadata.scope.split(/\s+/).filter(Boolean);
		const unknownScope = rawScopes.find((value) => !isMcpScope(value));
		if (unknownScope) {
			throw registrationPolicyError(`Unsupported MCP scope: ${unknownScope}`);
		}
	}

	return {
		clientName: input.metadata.clientName ?? hostedPolicy.clientName,
		clientProfile: hostedPolicy.profile,
		redirectUris: input.metadata.redirectUris,
		scopes: [...hostedPolicy.allowedScopes],
		requestsPerMinute: hostedPolicy.requestsPerMinute,
		registrationKind: "hosted",
	};
}
