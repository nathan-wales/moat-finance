import { zodToJsonSchema } from "zod-to-json-schema";

import type { AgentToolSpec } from "../providers/model-provider";
import { renderWidgetTool } from "../widgets/render-widget-tool";
import { placeholderTools } from "./placeholders";
import type { MoatToolDefinition } from "./types";

export const moatTools: Record<string, MoatToolDefinition> = {
	render_widget: renderWidgetTool,
	...placeholderTools,
};

export function getEnabledToolDefinitions(): MoatToolDefinition[] {
	return Object.values(moatTools).filter(
		(tool) => tool.enabled && tool.safetyClass !== "unsafe_disabled",
	);
}

export function getEnabledToolSpecs(): AgentToolSpec[] {
	return getEnabledToolDefinitions().map((tool) => ({
		name: tool.name,
		description: tool.description,
		parameters: zodToJsonSchema(tool.inputSchema, {
			$refStrategy: "none",
		}) as Record<string, unknown>,
	}));
}

export function getToolDefinition(
	name: string,
): MoatToolDefinition | undefined {
	const tool = moatTools[name];
	if (!tool?.enabled) return undefined;
	return tool;
}
