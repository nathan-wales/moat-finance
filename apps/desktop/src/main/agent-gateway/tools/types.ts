import type { McpScope, McpToolContract } from "@moat/mcp-contracts";
import type { AppRuntime } from "@moat/runtime";
import type { LocalAgentContext } from "../types";

/** Structured response from a local MCP tool */
export type LocalToolResult = {
	content: Array<{ type: "text"; text: string }>;
	structuredContent?: Record<string, unknown>;
	isError?: boolean;
};

/** Shared execution context injected into every tool handler */
export type LocalToolContext = {
	agentContext: LocalAgentContext;
	appRuntime: AppRuntime;
};

/** Signature every local tool implementation must satisfy */
export type LocalToolImplementation = {
	contract: McpToolContract;
	execute(
		input: unknown,
		ctx: LocalToolContext,
	): Promise<Record<string, unknown>>;
};

export function toLocalToolResult(
	data: Record<string, unknown>,
): LocalToolResult {
	return {
		content: [{ type: "text", text: JSON.stringify(data, null, 2) }],
		structuredContent: data,
	};
}

export function localSchemaEnvelope<TData extends Record<string, unknown>>(
	kind: string,
	data: TData,
): { schemaVersion: string; kind: string } & TData {
	return {
		schemaVersion: "2026-05-04",
		kind,
		...data,
	};
}

/** Scopes required for read-only tools */
export const READ_SCOPES: readonly McpScope[] = [
	"mcp:read",
] satisfies readonly McpScope[];
