import { z } from "zod";
import { db } from "~/server/db";

import { AgentError, agentErrorFromAbortSignal } from "../errors";
import type { MoatStreamEvent } from "../events";
import { TimelineStore } from "../timeline/timeline-store";
import {
	cancelPendingActionSchema,
	confirmPendingActionSchema,
	type MoatWidgetActionType,
	moatWidgetActionRegistry,
} from "./actions";
import { moatWidgetSchema } from "./schemas";
import type { ConfirmationCardWidget, MoatInteractiveWidget } from "./types";

export const widgetActionStreamInputSchema = z.object({
	conversationId: z.string().min(1),
	widgetId: z.string().min(1),
	actionType: z.string().min(1),
	values: z.record(z.unknown()),
	clientRequestId: z.string().min(1).max(200).optional(),
});

export type WidgetActionStreamInput = z.infer<
	typeof widgetActionStreamInputSchema
>;

export type ExecuteWidgetActionInput = WidgetActionStreamInput & {
	userId: string;
	householdId?: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: MoatStreamEvent) => void | Promise<void>;
};

function isWidgetActionType(value: string): value is MoatWidgetActionType {
	return value in moatWidgetActionRegistry;
}

function getActionLabel(widget: MoatInteractiveWidget, actionType: string) {
	return widget.actions.find((action) => action.type === actionType)?.label;
}

function formatValue(value: unknown): string {
	if (Array.isArray(value)) return value.join(", ");
	if (typeof value === "string") return value;
	if (typeof value === "number" || typeof value === "boolean") {
		return String(value);
	}
	return JSON.stringify(value ?? null);
}

function buildConfirmationWidget(input: {
	actionId: string;
	actionType: MoatWidgetActionType;
	label?: string;
	values: Record<string, unknown>;
}): ConfirmationCardWidget {
	return {
		id: `confirmation_${input.actionId}`,
		type: "confirmation_card",
		widgetSchemaVersion: "1",
		title: input.label ? `Confirm ${input.label}` : "Confirm action",
		summary: "Review this action before Moat changes your financial data.",
		source: "actual_user_data",
		generatedAt: new Date().toISOString(),
		interactionLevel: "server_action",
		confirmationId: input.actionId,
		details: Object.entries(input.values)
			.slice(0, 12)
			.map(([label, value]) => ({
				label,
				value: formatValue(value),
			})),
		confirmAction: {
			id: "confirm",
			label: input.label ?? "Confirm",
			actionType: "confirm_pending_action",
		},
		cancelAction: {
			id: "cancel",
			label: "Cancel",
		},
	};
}

async function validateWidgetActionPair(input: ExecuteWidgetActionInput) {
	const timelineStore = new TimelineStore(db);
	const found = await timelineStore.findWidgetBlock({
		conversationId: input.conversationId,
		widgetId: input.widgetId,
	});
	if (!found) {
		throw new AgentError("VALIDATION_ERROR", "Widget not found.");
	}

	const widget = moatWidgetSchema.parse(found.widget);
	if (widget.interactionLevel !== "server_action") {
		throw new AgentError("VALIDATION_ERROR", "Widget is not actionable.");
	}
	if (!("actions" in widget)) {
		throw new AgentError("VALIDATION_ERROR", "Widget has no actions.");
	}

	const action = widget.actions.find(
		(candidate) => candidate.type === input.actionType,
	);
	if (!action) {
		throw new AgentError(
			"VALIDATION_ERROR",
			"Action is not available on widget.",
		);
	}

	return {
		timelineStore,
		widget,
		actionLabel: getActionLabel(widget, input.actionType),
	};
}

async function createOrReuseAction(input: {
	conversationId: string;
	widgetId: string;
	runId: string;
	stepId: string;
	userId: string;
	householdId?: string;
	actionType: MoatWidgetActionType;
	values: unknown;
	status: string;
	clientRequestId?: string;
}) {
	if (input.clientRequestId) {
		const existing = await db.agentWidgetAction.findUnique({
			where: {
				widgetId_actionType_clientRequestId: {
					widgetId: input.widgetId,
					actionType: input.actionType,
					clientRequestId: input.clientRequestId,
				},
			},
		});
		if (existing) return existing;
	}

	return db.agentWidgetAction.create({
		data: {
			conversationId: input.conversationId,
			widgetId: input.widgetId,
			runId: input.runId,
			stepId: input.stepId,
			userId: input.userId,
			householdId: input.householdId ?? null,
			actionType: input.actionType,
			input: input.values as object,
			status: input.status,
			clientRequestId: input.clientRequestId ?? null,
		},
	});
}

async function executeConfirmedWidgetAction(input: {
	actionId: string;
	userId: string;
	runId: string;
	stepId: string;
	abortSignal?: AbortSignal;
	emit?: (event: MoatStreamEvent) => void | Promise<void>;
}) {
	const action = await db.agentWidgetAction.findFirst({
		where: { id: input.actionId, userId: input.userId },
	});
	if (!action)
		throw new AgentError("VALIDATION_ERROR", "Pending action not found.");
	if (!isWidgetActionType(action.actionType)) {
		throw new AgentError("VALIDATION_ERROR", "Unknown widget action.");
	}
	if (action.status === "completed") return action;
	if (action.status === "cancelled") {
		throw new AgentError("VALIDATION_ERROR", "Action was cancelled.");
	}

	await db.agentWidgetAction.update({
		where: { id: action.id },
		data: {
			status: "running",
			runId: input.runId,
			stepId: input.stepId,
		},
	});

	await input.emit?.({
		type: "action_started",
		runId: input.runId,
		stepId: input.stepId,
		actionId: action.id,
		actionType: action.actionType,
	});

	const abortError = agentErrorFromAbortSignal(input.abortSignal);
	if (abortError) throw abortError;

	const actionContext = {
		userId: action.userId,
		householdId: action.householdId ?? undefined,
		conversationId: action.conversationId,
		widgetId: action.widgetId,
		runId: input.runId,
		stepId: input.stepId,
		abortSignal: input.abortSignal,
		emit: input.emit,
	};

	let result: unknown;
	try {
		result = await executeRegisteredAction(
			action.actionType,
			action.input,
			actionContext,
		);
	} catch (error) {
		const isCancelled =
			error instanceof AgentError && error.code === "CANCELLED";
		await db.agentWidgetAction
			.update({
				where: { id: action.id },
				data: {
					status: isCancelled ? "cancelled" : "failed",
					completedAt: new Date(),
				},
			})
			.catch(() => undefined);
		throw error;
	}

	await db.agentWidgetAction.update({
		where: { id: action.id },
		data: {
			status: "completed",
			output: (result ?? null) as object,
			completedAt: new Date(),
		},
	});

	const summary = `Completed ${action.actionType}.`;
	const timelineStore = new TimelineStore(db);
	await timelineStore.createActionResultBlock({
		conversationId: action.conversationId,
		actionType: action.actionType,
		summary,
		result,
		runId: input.runId,
		stepId: input.stepId,
	});

	await input.emit?.({
		type: "action_done",
		runId: input.runId,
		stepId: input.stepId,
		actionId: action.id,
		actionType: action.actionType,
		summary,
		result,
	});

	return { status: "completed", actionId: action.id, result };
}

async function executeRegisteredAction(
	actionType: MoatWidgetActionType,
	rawInput: unknown,
	context: Parameters<typeof moatWidgetActionRegistry.create_rule.execute>[1],
) {
	switch (actionType) {
		case "create_rule": {
			const input =
				moatWidgetActionRegistry.create_rule.inputSchema.parse(rawInput);
			return moatWidgetActionRegistry.create_rule.execute(input, context);
		}
		case "save_budget_targets": {
			const input =
				moatWidgetActionRegistry.save_budget_targets.inputSchema.parse(
					rawInput,
				);
			return moatWidgetActionRegistry.save_budget_targets.execute(
				input,
				context,
			);
		}
		case "update_transaction": {
			const input =
				moatWidgetActionRegistry.update_transaction.inputSchema.parse(rawInput);
			return moatWidgetActionRegistry.update_transaction.execute(
				input,
				context,
			);
		}
		case "create_scenario": {
			const input =
				moatWidgetActionRegistry.create_scenario.inputSchema.parse(rawInput);
			return moatWidgetActionRegistry.create_scenario.execute(input, context);
		}
		case "run_scenario": {
			const input =
				moatWidgetActionRegistry.run_scenario.inputSchema.parse(rawInput);
			return moatWidgetActionRegistry.run_scenario.execute(input);
		}
		case "apply_hashtags": {
			const input =
				moatWidgetActionRegistry.apply_hashtags.inputSchema.parse(rawInput);
			return moatWidgetActionRegistry.apply_hashtags.execute(input, context);
		}
		case "cancel_pending_action": {
			const input =
				moatWidgetActionRegistry.cancel_pending_action.inputSchema.parse(
					rawInput,
				);
			return moatWidgetActionRegistry.cancel_pending_action.execute(input);
		}
		case "confirm_pending_action":
			throw new AgentError(
				"VALIDATION_ERROR",
				"confirm_pending_action cannot be executed directly.",
			);
	}
}

async function cancelPendingWidgetAction(input: {
	actionId: string;
	userId: string;
	runId: string;
	stepId: string;
	emit?: (event: MoatStreamEvent) => void | Promise<void>;
}) {
	const action = await db.agentWidgetAction.findFirst({
		where: { id: input.actionId, userId: input.userId },
	});
	if (!action)
		throw new AgentError("VALIDATION_ERROR", "Pending action not found.");
	if (!isWidgetActionType(action.actionType)) {
		throw new AgentError("VALIDATION_ERROR", "Unknown widget action.");
	}
	await db.agentWidgetAction.update({
		where: { id: action.id },
		data: {
			status: "cancelled",
			runId: input.runId,
			stepId: input.stepId,
			completedAt: new Date(),
		},
	});
	const summary = `Cancelled ${action.actionType}.`;
	const timelineStore = new TimelineStore(db);
	await timelineStore.createActionResultBlock({
		conversationId: action.conversationId,
		actionType: action.actionType,
		summary,
		runId: input.runId,
		stepId: input.stepId,
	});
	await input.emit?.({
		type: "action_done",
		runId: input.runId,
		stepId: input.stepId,
		actionId: action.id,
		actionType: action.actionType,
		summary,
	});
	return { status: "cancelled", actionId: action.id };
}

export async function executeWidgetAction(input: ExecuteWidgetActionInput) {
	const abortError = agentErrorFromAbortSignal(input.abortSignal);
	if (abortError) throw abortError;

	if (!isWidgetActionType(input.actionType)) {
		throw new AgentError("VALIDATION_ERROR", "Unknown widget action.");
	}

	if (input.actionType === "confirm_pending_action") {
		const parsed = confirmPendingActionSchema.parse(input.values);
		return executeConfirmedWidgetAction({
			actionId: parsed.actionId,
			userId: input.userId,
			runId: input.runId,
			stepId: input.stepId,
			abortSignal: input.abortSignal,
			emit: input.emit,
		});
	}

	if (input.actionType === "cancel_pending_action") {
		const parsed = cancelPendingActionSchema.parse(input.values);
		return cancelPendingWidgetAction({
			actionId: parsed.actionId,
			userId: input.userId,
			runId: input.runId,
			stepId: input.stepId,
			emit: input.emit,
		});
	}

	const { timelineStore, actionLabel } = await validateWidgetActionPair(input);
	const actionDef = moatWidgetActionRegistry[input.actionType];
	const parsedInput = actionDef.inputSchema.parse(input.values);

	const action = await createOrReuseAction({
		conversationId: input.conversationId,
		widgetId: input.widgetId,
		runId: input.runId,
		stepId: input.stepId,
		userId: input.userId,
		householdId: input.householdId,
		actionType: input.actionType,
		values: parsedInput,
		status: actionDef.requiresConfirmation ? "waiting_for_user" : "running",
		clientRequestId: input.clientRequestId,
	});

	if (action.status === "completed") return action;

	if (actionDef.requiresConfirmation) {
		const confirmationWidget = buildConfirmationWidget({
			actionId: action.id,
			actionType: input.actionType,
			label: actionLabel,
			values: parsedInput as Record<string, unknown>,
		});
		await timelineStore.createWidgetBlock({
			conversationId: input.conversationId,
			widget: confirmationWidget,
			runId: input.runId,
			stepId: input.stepId,
		});
		await input.emit?.({
			type: "widget_started",
			runId: input.runId,
			stepId: input.stepId,
			widgetId: confirmationWidget.id,
			widgetType: confirmationWidget.type,
		});
		await input.emit?.({
			type: "widget_done",
			runId: input.runId,
			stepId: input.stepId,
			widget: confirmationWidget,
		});
		await input.emit?.({
			type: "user_input_required",
			runId: input.runId,
			stepId: input.stepId,
			reason: "confirmation_required",
			payload: { actionId: action.id, actionType: input.actionType },
		});
		return { status: "waiting_for_user", actionId: action.id };
	}

	return executeConfirmedWidgetAction({
		actionId: action.id,
		userId: input.userId,
		runId: input.runId,
		stepId: input.stepId,
		abortSignal: input.abortSignal,
		emit: input.emit,
	});
}
