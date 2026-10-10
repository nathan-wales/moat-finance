import {
	mcpCreateNotificationRuleInputSchema,
	mcpDeleteNotificationRuleInputSchema,
	mcpPauseNotificationRuleInputSchema,
	mcpToolContracts,
	mcpUpdateNotificationRuleInputSchema,
} from "@moat/mcp-contracts";
import { notificationRuleSchema } from "@moat/monitoring-rules";
import {
	createLocalNotificationRule,
	deleteLocalNotificationRule,
	listLocalNotificationRules,
	pauseLocalNotificationRule,
	updateLocalNotificationRule,
} from "../../services/local-notification-rules";
import type { LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

async function loadNotificationDb() {
	const { getDesktopDb } = await import("../../db");
	return getDesktopDb().db;
}

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

function summarizeRule(rule: {
	id: string;
	name: string;
	signalType: string;
	channels: string[];
	isActive: boolean;
	isPaused: boolean;
	source: string;
	sourceAttribution: string | null;
	lastEvaluatedAt: string | null;
	plainLanguageSummary: string | null;
}) {
	return {
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
	};
}

export const listNotificationRulesTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listNotificationRules"],
	async execute() {
		const db = await loadNotificationDb();
		const rules = await listLocalNotificationRules(db);
		return localSchemaEnvelope("notifications.list", {
			rules: rules.map(summarizeRule),
		});
	},
};

export const createNotificationRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.createNotificationRule"],
	async execute(input) {
		const parsedInput = mcpCreateNotificationRuleInputSchema.parse(input ?? {});
		const parsed = notificationRuleSchema.parse({
			...parsedInput,
			source: "mcp",
		});
		if (
			requiresSensitiveConfirmation(parsed) &&
			parsedInput.confirmed !== true
		) {
			throw new Error(
				"Confirmation required before creating this notification rule. Re-call with confirmed: true after user approval.",
			);
		}

		const db = await loadNotificationDb();
		const rule = await createLocalNotificationRule(db, {
			name: parsed.name,
			plainLanguageSummary: parsed.plainLanguageSummary,
			signalType: parsed.signalType,
			trigger: parsed.trigger as Record<string, unknown>,
			conditions: parsed.conditions as Array<Record<string, unknown>>,
			schedule: parsed.schedule as Record<string, unknown>,
			watchQuery: (parsed.watchQuery ?? null) as Record<string, unknown> | null,
			channels: parsed.channels,
			urgency: parsed.urgency,
			templateId: parsed.templateId,
			source: "mcp",
			sourceAttribution:
				parsedInput.sourceAttribution ?? "Created with AI assistant",
			isActive: parsed.isActive,
		});

		return localSchemaEnvelope("notifications.create", { rule });
	},
};

export const updateNotificationRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.updateNotificationRule"],
	async execute(input) {
		const parsed = mcpUpdateNotificationRuleInputSchema.parse(input ?? {});
		if (requiresSensitiveConfirmation(parsed) && parsed.confirmed !== true) {
			throw new Error(
				"Confirmation required before updating this notification rule. Re-call with confirmed: true after user approval.",
			);
		}

		const db = await loadNotificationDb();
		const rule = await updateLocalNotificationRule(db, {
			id: parsed.id,
			name: parsed.name,
			plainLanguageSummary: parsed.plainLanguageSummary,
			signalType: parsed.signalType,
			trigger: parsed.trigger as Record<string, unknown> | undefined,
			conditions: parsed.conditions as
				| Array<Record<string, unknown>>
				| undefined,
			schedule: parsed.schedule as Record<string, unknown> | undefined,
			watchQuery: parsed.watchQuery as
				| Record<string, unknown>
				| null
				| undefined,
			channels: parsed.channels,
			urgency: parsed.urgency,
			templateId: parsed.templateId,
			source: parsed.source,
			sourceAttribution: parsed.sourceAttribution,
			isActive: parsed.isActive,
		});

		return localSchemaEnvelope("notifications.update", { rule });
	},
};

export const pauseNotificationRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.setNotificationRulePaused"],
	async execute(input) {
		const parsed = mcpPauseNotificationRuleInputSchema.parse(input ?? {});
		const db = await loadNotificationDb();
		const rule = await pauseLocalNotificationRule(db, parsed.id, parsed.paused);
		return localSchemaEnvelope("notifications.pause", { rule });
	},
};

export const deleteNotificationRuleTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.deleteNotificationRule"],
	async execute(input) {
		const parsed = mcpDeleteNotificationRuleInputSchema.parse(input ?? {});
		const db = await loadNotificationDb();
		await deleteLocalNotificationRule(db, parsed.id);
		return localSchemaEnvelope("notifications.delete", { success: true });
	},
};
