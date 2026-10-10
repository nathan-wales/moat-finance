import {
	getAdvertisedInputSchema,
	getAdvertisedToolNames,
} from "@moat/mcp-contracts";
import type { AppRuntime } from "@moat/runtime";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import { appendAuditEntry } from "./audit-log";
import { AgentAuthorizationError, assertScopes } from "./scope-checker";
import { getLocalRegisteredTools } from "./tools/registry";
import type { LocalToolImplementation, LocalToolResult } from "./tools/types";
import { toLocalToolResult } from "./tools/types";
import type { LocalAgentContext } from "./types";

function getAnnotations(tool: LocalToolImplementation): ToolAnnotations {
	const isReadOnly = tool.contract.safetyClass === "read_only_app_data";
	return {
		title: tool.contract.title,
		readOnlyHint: isReadOnly,
		destructiveHint:
			tool.contract.safetyClass === "mutates_user_financial_data",
		idempotentHint: isReadOnly,
		openWorldHint: false,
	};
}

export function createLocalMcpServer(
	agentContext: LocalAgentContext,
	appRuntime: AppRuntime,
	userDataPath: string,
): McpServer {
	const server = new McpServer({
		name: "moat-finance-local",
		version: "0.1.0",
	});

	const ctx = { agentContext, appRuntime };

	for (const tool of getLocalRegisteredTools()) {
		const config = {
			title: tool.contract.title,
			description: tool.contract.description,
			inputSchema: getAdvertisedInputSchema(tool.contract.inputSchema),
			outputSchema: tool.contract.outputSchema,
			annotations: getAnnotations(tool),
		};

		async function handler(args: unknown): Promise<LocalToolResult> {
			const start = Date.now();
			try {
				assertScopes(agentContext, tool.contract.requiredScopes);
				const parsedInput = tool.contract.inputSchema.parse(args ?? {});
				const output = await tool.execute(parsedInput, ctx);
				const durationMs = Date.now() - start;

				appendAuditEntry(userDataPath, {
					ts: new Date().toISOString(),
					tokenId: agentContext.tokenId,
					tokenLabel: agentContext.label,
					tool: tool.contract.name,
					scopes: agentContext.scopes,
					status: "success",
					durationMs,
				});

				return toLocalToolResult(output);
			} catch (err) {
				const durationMs = Date.now() - start;
				const isDenied = err instanceof AgentAuthorizationError;

				appendAuditEntry(userDataPath, {
					ts: new Date().toISOString(),
					tokenId: agentContext.tokenId,
					tokenLabel: agentContext.label,
					tool: tool.contract.name,
					scopes: agentContext.scopes,
					status: isDenied ? "denied" : "error",
					durationMs,
					errorCode: isDenied ? "AGENT_FORBIDDEN" : "TOOL_ERROR",
				});

				if (isDenied) throw err;

				return {
					content: [
						{
							type: "text",
							text: JSON.stringify({
								error:
									err instanceof Error ? err.message : "Tool execution failed",
							}),
						},
					],
					isError: true,
				};
			}
		}

		for (const advertisedName of getAdvertisedToolNames(tool.contract.name)) {
			server.registerTool(advertisedName, config, handler);
		}
	}

	return server;
}
