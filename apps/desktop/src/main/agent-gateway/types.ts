import type { McpScope } from "@moat/mcp-contracts";

export const LOCAL_MCP_PORT = 3030;

/** Status of the local MCP gateway server */
export type GatewayStatus = {
	enabled: boolean;
	running: boolean;
	port: number | null;
	/** Whether the gateway should start automatically on app launch */
	autoStart: boolean;
};

/**
 * A local agent access token.
 * Stored on disk in userData/agent-tokens.json.
 * The actual token value is never stored — only its SHA-256 hash.
 */
export type AgentToken = {
	/** Stable identifier shown in the Settings UI */
	id: string;
	/** Human-readable label (e.g. "Claude Desktop") */
	label: string;
	/** SHA-256 hash of the raw token — never store raw value */
	tokenHash: string;
	/** Scopes granted to this token */
	scopes: McpScope[];
	/** ISO timestamp when the token was created */
	createdAt: string;
	/** ISO timestamp of the last successful use (updated on each call) */
	lastUsedAt: string | null;
};

/** Resolved auth context passed into every MCP tool handler */
export type LocalAgentContext = {
	tokenId: string;
	label: string;
	scopes: McpScope[];
	/** Always "local-user" for the single-user desktop app */
	userId: string;
};

/** One entry in the local audit log (agent-audit.jsonl) */
export type LocalAuditEntry = {
	ts: string;
	tokenId: string;
	/** Non-sensitive label copied at call time so logs remain readable after token revocation. */
	tokenLabel?: string;
	tool: string;
	scopes: McpScope[];
	status: "success" | "error" | "denied";
	durationMs: number;
	errorCode?: string;
};
