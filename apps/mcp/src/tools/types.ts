import type { McpToolContract } from "@moat/mcp-contracts";
import type { CallToolResult } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthContext } from "~/auth/types";

export type McpToolResult = CallToolResult;

export type McpToolImplementation<TInput = unknown> = {
	contract: McpToolContract;
	execute(input: TInput, context: McpAuthContext): Promise<unknown>;
};

function isStructuredContent(data: unknown): data is Record<string, unknown> {
	return Boolean(data) && typeof data === "object" && !Array.isArray(data);
}

export function toMcpToolResult(data: unknown): McpToolResult {
	return {
		content: [
			{ type: "text", text: JSON.stringify(data, null, 2) ?? String(data) },
		],
		structuredContent: isStructuredContent(data)
			? data
			: { value: data ?? null },
	};
}
