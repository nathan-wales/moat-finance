import { logger } from "~/lib/logger";

import { AgentError, agentErrorFromAbortSignal } from "../errors";
import type { MoatStreamEvent } from "../events";
import type { ToolCallStore } from "../persistence/tool-call-store";
import type {
	AgentToolCall,
	AgentToolOutput,
} from "../providers/model-provider";
import type { MoatToolDefinition } from "./types";

export type ToolExecutorOptions = {
	maxToolTimeMs?: number;
};

export class ToolExecutor {
	constructor(
		private readonly tools: Record<string, MoatToolDefinition>,
		private readonly toolCallStore: ToolCallStore,
		private readonly options: ToolExecutorOptions = {},
	) {}

	async executeToolCalls(input: {
		userId: string;
		householdId?: string;
		conversationId: string;
		runId: string;
		stepId: string;
		toolCalls: AgentToolCall[];
		signal?: AbortSignal;
		emit?: (event: MoatStreamEvent) => void | Promise<void>;
	}): Promise<AgentToolOutput[]> {
		const outputs: AgentToolOutput[] = [];

		for (const toolCall of input.toolCalls) {
			const abortError = agentErrorFromAbortSignal(input.signal);
			if (abortError) throw abortError;

			const tool = this.tools[toolCall.name];
			const persistedToolCall = await this.toolCallStore.createToolCall({
				runId: input.runId,
				stepId: input.stepId,
				toolCallId: toolCall.id,
				toolName: toolCall.name,
				input: toolCall.arguments,
			});

			logger.info("agent.tool.started", {
				feature: "agent",
				operation: "tool_execution",
				userId: input.userId,
				householdId: input.householdId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: input.stepId,
				toolCallId: toolCall.id,
				toolName: toolCall.name,
			});

			if (!tool?.enabled) {
				await this.toolCallStore.failToolCall({
					id: persistedToolCall.id,
					code: "TOOL_ERROR",
					error: new Error(`Tool ${toolCall.name} is not available.`),
				});
				logger.warn("agent.tool.failed", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					errorCode: "TOOL_ERROR",
				});

				outputs.push({
					toolCallId: toolCall.id,
					output: {
						status: "error",
						message: `Tool ${toolCall.name} is not available.`,
					},
				});
				continue;
			}

			const safetyError = getToolSafetyError(tool);
			if (safetyError) {
				await this.toolCallStore.failToolCall({
					id: persistedToolCall.id,
					code: "TOOL_ERROR",
					error: safetyError,
				});
				logger.warn("agent.tool.failed", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					errorCode: "TOOL_ERROR",
				});

				outputs.push({
					toolCallId: toolCall.id,
					output: {
						status: "error",
						message: "Tool execution is not allowed.",
					},
				});
				continue;
			}

			const parsedInput = tool.inputSchema.safeParse(toolCall.arguments);

			if (!parsedInput.success) {
				await this.toolCallStore.failToolCall({
					id: persistedToolCall.id,
					code: "VALIDATION_ERROR",
					error: parsedInput.error,
				});
				logger.warn("agent.tool.failed", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					errorCode: "VALIDATION_ERROR",
					errorMessage: parsedInput.error.message,
					validationIssues: parsedInput.error.errors,
					toolCallArguments: toolCall.arguments,
				});

				outputs.push({
					toolCallId: toolCall.id,
					output: { status: "error", message: "Invalid tool input." },
				});
				continue;
			}

			if (tool.requiresConfirmation) {
				const output = {
					status: "needs_confirmation" as const,
					message: "This action requires confirmation before it can run.",
				};

				await this.toolCallStore.completeToolCall({
					id: persistedToolCall.id,
					output,
					status: "skipped",
				});
				logger.info("agent.tool.completed", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					status: "skipped",
				});

				outputs.push({ toolCallId: toolCall.id, output });
				continue;
			}

			try {
				const result = await this.runWithTimeout(
					() =>
						tool.execute(parsedInput.data, {
							userId: input.userId,
							householdId: input.householdId,
							conversationId: input.conversationId,
							runId: input.runId,
							stepId: input.stepId,
							abortSignal: input.signal,
							emit: input.emit,
						}),
					this.options.maxToolTimeMs ??
						Number(
							process.env.MOAT_AGENT_MAX_TOOL_TIME_MS ??
								process.env.MOAT_AGENT_MAX_TOOL_TIME_MS ??
								15_000,
						),
					input.signal,
				);

				const output = { status: "success" as const, data: result };

				await this.toolCallStore.completeToolCall({
					id: persistedToolCall.id,
					output,
					status: "completed",
				});

				logger.info("agent.tool.completed", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					status: "completed",
				});

				outputs.push({ toolCallId: toolCall.id, output });
			} catch (error) {
				if (error instanceof AgentError && error.code === "CANCELLED") {
					await this.toolCallStore.cancelToolCall({
						id: persistedToolCall.id,
						reason: error.message,
					});
					logger.info("agent.tool.cancelled", {
						feature: "agent",
						operation: "tool_execution",
						userId: input.userId,
						householdId: input.householdId,
						conversationId: input.conversationId,
						runId: input.runId,
						stepId: input.stepId,
						toolCallId: toolCall.id,
						toolName: toolCall.name,
					});
					throw error;
				}

				await this.toolCallStore.failToolCall({
					id: persistedToolCall.id,
					code: error instanceof AgentError ? error.code : "TOOL_ERROR",
					error,
				});
				logger.logError("agent.tool.failed", error, {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					householdId: input.householdId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: input.stepId,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					errorCode: error instanceof AgentError ? error.code : "TOOL_ERROR",
					toolCallArguments: toolCall.arguments,
				});

				const isValidationError =
					error instanceof AgentError && error.code === "VALIDATION_ERROR";
				outputs.push({
					toolCallId: toolCall.id,
					output: {
						status: "error",
						message: isValidationError
							? error.message
							: "Tool execution failed.",
					},
				});
			}
		}

		return outputs;
	}

	private async runWithTimeout<T>(
		fn: () => Promise<T>,
		timeoutMs: number,
		signal?: AbortSignal,
	): Promise<T> {
		return new Promise<T>((resolve, reject) => {
			let settled = false;
			const timer = setTimeout(() => {
				if (settled) return;
				settled = true;
				reject(new AgentError("TIMEOUT", "Tool execution timed out"));
			}, timeoutMs);

			const onAbort = () => {
				if (settled) return;
				settled = true;
				clearTimeout(timer);
				reject(
					agentErrorFromAbortSignal(signal) ??
						new AgentError("CANCELLED", "Tool execution was cancelled"),
				);
			};

			signal?.addEventListener("abort", onAbort, { once: true });

			fn().then(
				(value) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					resolve(value);
				},
				(err) => {
					if (settled) return;
					settled = true;
					clearTimeout(timer);
					signal?.removeEventListener("abort", onAbort);
					reject(err);
				},
			);
		});
	}
}

function getToolSafetyError(tool: MoatToolDefinition): AgentError | undefined {
	if (
		(tool.safetyClass === "mutates_app_data" ||
			tool.safetyClass === "mutates_user_financial_data") &&
		!tool.requiresConfirmation
	) {
		return new AgentError(
			"TOOL_ERROR",
			`Mutating tool ${tool.name} is missing confirmation gating.`,
		);
	}
	if (tool.safetyClass === "external_network") {
		return new AgentError(
			"TOOL_ERROR",
			`External network tool ${tool.name} is not enabled in V1.`,
		);
	}
	if (tool.safetyClass === "sandboxed_code_execution") {
		return new AgentError(
			"TOOL_ERROR",
			`Sandboxed tool ${tool.name} must run through a SandboxProvider.`,
		);
	}
	if (tool.safetyClass === "unsafe_disabled") {
		return new AgentError(
			"TOOL_ERROR",
			`Unsafe tool ${tool.name} cannot be executed.`,
		);
	}
	return undefined;
}
