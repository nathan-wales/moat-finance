import { CLOUD_MCP_HTTP_URL } from "@moat/mcp-contracts";

/**
 * Public Streamable HTTP MCP endpoint shown in AI-access setup instructions.
 * Self-hosters set `NEXT_PUBLIC_MCP_URL` (build time) to their own MCP server's
 * `/mcp` URL so tokens are never pasted into the hosted endpoint.
 */
export const MCP_HTTP_URL =
	process.env.NEXT_PUBLIC_MCP_URL?.trim().replace(/\/$/, "") ||
	CLOUD_MCP_HTTP_URL;
