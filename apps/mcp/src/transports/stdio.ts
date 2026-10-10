import { StdioServerTransport } from "@modelcontextprotocol/sdk/server/stdio.js";
import { verifyAuthorizationHeader } from "~/auth/verify-token";
import { createMoatMcpServer } from "~/mcp-server";

export async function startStdioTransport() {
	const token = process.env.MOAT_MCP_TOKEN;
	if (!token) {
		throw new Error("MOAT_MCP_TOKEN is required for MCP stdio transport");
	}

	const context = await verifyAuthorizationHeader({
		authorizationHeader: `Bearer ${token}`,
		requestedClientProfile: process.env.MOAT_MCP_CLIENT_PROFILE ?? "local-dev",
	});
	const server = createMoatMcpServer(context);
	const transport = new StdioServerTransport();
	await server.connect(transport);
}
