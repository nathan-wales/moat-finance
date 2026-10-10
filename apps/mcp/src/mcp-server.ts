import {
	getAdvertisedInputSchema,
	getAdvertisedToolNames,
} from "@moat/mcp-contracts";
import { McpServer } from "@modelcontextprotocol/sdk/server/mcp.js";
import type { ToolAnnotations } from "@modelcontextprotocol/sdk/types.js";
import type { McpAuthContext } from "~/auth/types";
import {
	getInstructionsForProfile,
	MOAT_MCP_INSTRUCTIONS,
} from "~/server-instructions";
import { executeMcpTool, getRegisteredTools } from "~/tools/registry";
import type { McpToolImplementation } from "~/tools/types";

function getToolAnnotations(tool: McpToolImplementation): ToolAnnotations {
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

function getToolMeta(tool: McpToolImplementation): Record<string, unknown> {
	const securitySchemes = [
		{
			type: "oauth2",
			scopes: [...tool.contract.requiredScopes],
		},
	];

	return {
		securitySchemes,
		"openai/toolInvocation/invoking": tool.contract.requiresConfirmation
			? "Awaiting approval..."
			: "Working...",
		"openai/toolInvocation/invoked": tool.contract.requiresConfirmation
			? "Action complete"
			: "Done",
	};
}

export function createMoatMcpServer(context: McpAuthContext): McpServer {
	const server = new McpServer(
		{
			name:
				context.clientProfile === "chatgpt"
					? "Moat Finance"
					: "moat-finance-mcp-gateway",
			version: "0.1.0",
		},
		{
			instructions:
				getInstructionsForProfile(context.clientProfile) ??
				MOAT_MCP_INSTRUCTIONS,
		},
	);

	for (const tool of getRegisteredTools(context.clientProfile)) {
		const config = {
			title: tool.contract.title,
			description: tool.contract.description,
			inputSchema: getAdvertisedInputSchema(tool.contract.inputSchema, {
				includeProfileId: tool.contract.safetyClass === "read_only_app_data",
			}),
			outputSchema: tool.contract.outputSchema,
			annotations: getToolAnnotations(tool),
			_meta: getToolMeta(tool),
		};

		async function handler(args: unknown) {
			return executeMcpTool({
				name: tool.contract.name,
				arguments: args,
				context,
			});
		}

		for (const advertisedName of getAdvertisedToolNames(tool.contract.name, {
			includeCompatibleAlias: context.clientProfile !== "chatgpt",
		})) {
			server.registerTool(advertisedName, config, handler);
		}
	}

	return server;
}
