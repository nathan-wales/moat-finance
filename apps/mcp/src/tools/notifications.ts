import {
	type McpCreateNotificationRuleInput,
	type McpDeleteNotificationRuleInput,
	type McpPauseNotificationRuleInput,
	type McpUpdateNotificationRuleInput,
	mcpToolContracts,
	updateNotificationRuleInputSchema,
} from "@moat/mcp-contracts";
import { notificationRuleSchema } from "@moat/monitoring-rules";
import {
	createNotificationRule,
	deleteNotificationRule,
	listNotificationRules,
	pauseNotificationRule,
	updateNotificationRule,
} from "../../../api/src/server/services/notification-rule.service";
import { schemaEnvelope } from "./format";
import type { McpToolImplementation } from "./types";

function requiresSensitiveConfirmation(input: {
	channels?: string[];
	schedule?: { kind?: string };
	signalType?: string;
	urgency?: string;
	watchQuery?: { source?: { kind?: string } };
}): boolean {
	const channels = input.channels ?? [];
	const hasExternal = channels.includes("email") || channels.includes("push");
	const highFrequency = input.schedule?.kind === "immediate";
	const sensitiveSignal =
		input.signalType === "balance_threshold" ||
		input.signalType === "account_sync_stale" ||
		input.watchQuery?.source?.kind === "balances" ||
		input.watchQuery?.source?.kind === "accounts_sync";
	return hasExternal || highFrequency || sensitiveSignal;
}

export const listNotificationRulesTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listNotificationRules"],
	async execute(_input, context) {
		const rules = await listNotificationRules(context.db, context.userId);
		return schemaEnvelope("notifications.list", {
			rules: rules.map((rule) => ({
				id: rule.id,
				name: rule.name,
				signalType: rule.signalType,
				channels: rule.channels,
				isActive: rule.isActive,
				isPaused: rule.isPaused,
				source: rule.source,
				sourceAttribution: rule.sourceAttribution,
				lastEvaluatedAt: rule.lastEvaluatedAt,
				plainLanguageSummary: rule.plainLanguageSummary,
			})),
		});
	},
};

export const createNotificationRuleTool: McpToolImplementation<McpCreateNotificationRuleInput> =
	{
		contract: mcpToolContracts["moat.createNotificationRule"],
		async execute(input, context) {
			const parsed = notificationRuleSchema.parse({
				...input,
				source: "mcp",
			});
			if (requiresSensitiveConfirmation(parsed) && input.confirmed !== true) {
				throw new Error(
					"Confirmation required before creating this notification rule. Re-call with confirmed: true after user approval.",
				);
			}
			const rule = await createNotificationRule(context.db, {
				userId: context.userId,
				input: parsed,
				sourceAttribution:
					input.sourceAttribution ?? "Created with AI assistant",
			});
			return schemaEnvelope("notifications.create", { rule });
		},
	};

export const updateNotificationRuleTool: McpToolImplementation<McpUpdateNotificationRuleInput> =
	{
		contract: mcpToolContracts["moat.updateNotificationRule"],
		async execute(input, context) {
			const parsed = updateNotificationRuleInputSchema.parse(input);
			if (requiresSensitiveConfirmation(parsed) && input.confirmed !== true) {
				throw new Error(
					"Confirmation required before updating this notification rule. Re-call with confirmed: true after user approval.",
				);
			}
			const rule = await updateNotificationRule(
				context.db,
				context.userId,
				parsed,
			);
			return schemaEnvelope("notifications.update", { rule });
		},
	};

export const pauseNotificationRuleTool: McpToolImplementation<McpPauseNotificationRuleInput> =
	{
		contract: mcpToolContracts["moat.setNotificationRulePaused"],
		async execute(input, context) {
			const rule = await pauseNotificationRule(
				context.db,
				context.userId,
				input.id,
				input.paused,
			);
			return schemaEnvelope("notifications.pause", { rule });
		},
	};

export const deleteNotificationRuleTool: McpToolImplementation<McpDeleteNotificationRuleInput> =
	{
		contract: mcpToolContracts["moat.deleteNotificationRule"],
		async execute(input, context) {
			await deleteNotificationRule(context.db, context.userId, input.id);
			return schemaEnvelope("notifications.delete", { success: true });
		},
	};
