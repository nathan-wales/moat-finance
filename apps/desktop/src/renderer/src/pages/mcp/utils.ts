import {
	buildHttpMcpServerConfig,
	DEFAULT_LOCAL_MCP_SERVER_NAME,
} from "@moat/mcp-contracts";
import { format, formatDistanceToNow } from "date-fns";
import type { AccessToken, LocalAuditEntry } from "./types";

export const DEFAULT_LOCAL_MCP_PORT = 3030;

const TOKEN_PLACEHOLDER = "<your-token>";

export function maskBearerToken(token: string): string {
	if (token.length <= 8) return "****";
	return `${token.slice(0, 8)}${"*".repeat(Math.min(token.length - 8, 24))}`;
}

function localMcpUrl(port: number | null): string {
	const resolvedPort = port ?? DEFAULT_LOCAL_MCP_PORT;
	return `http://localhost:${resolvedPort}/mcp`;
}

export function buildLocalMcpServerConfig(options: {
	port: number | null;
	token: string;
}) {
	return buildHttpMcpServerConfig({
		url: localMcpUrl(options.port),
		bearerToken: options.token,
	});
}

export function buildMcpJsonSnippet(options: {
	port: number | null;
	token: string;
}): string {
	const config = buildLocalMcpServerConfig(options);
	return `${JSON.stringify(DEFAULT_LOCAL_MCP_SERVER_NAME)}: ${JSON.stringify(
		config,
		null,
		2,
	)}`;
}

export function buildMcpJsonSnippets(options: {
	port: number | null;
	plaintextToken?: string | null;
}): { display: string; copy: string } {
	const copyToken = options.plaintextToken ?? TOKEN_PLACEHOLDER;
	const displayToken = options.plaintextToken
		? maskBearerToken(options.plaintextToken)
		: TOKEN_PLACEHOLDER;

	return {
		display: buildMcpJsonSnippet({
			port: options.port,
			token: displayToken,
		}),
		copy: buildMcpJsonSnippet({
			port: options.port,
			token: copyToken,
		}),
	};
}

export function formatDate(value: string | null | undefined): string {
	if (!value) return "Never";
	return new Intl.DateTimeFormat(undefined, {
		month: "short",
		day: "numeric",
		year: "numeric",
	}).format(new Date(value));
}

export function formatDateTime(value: string): string {
	return format(new Date(value), "PPpp");
}

export function formatRelativeTime(value: string): string {
	return formatDistanceToNow(new Date(value), { addSuffix: true });
}

export function tokenDisplayPrefix(token: AccessToken): string {
	if (token.id.length <= 12) return token.id;
	return `${token.id.slice(0, 10)}...`;
}

export function auditEntryId(entry: LocalAuditEntry): string {
	return `${entry.tokenId}-${entry.ts}-${entry.tool}`;
}

export function clientNameForLog(
	entry: LocalAuditEntry,
	tokens: AccessToken[],
): string {
	if (entry.tokenLabel) return entry.tokenLabel;
	return (
		tokens.find((token) => token.id === entry.tokenId)?.label ?? "Unknown token"
	);
}
