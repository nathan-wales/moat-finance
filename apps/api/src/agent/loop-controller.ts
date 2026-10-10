import { logger } from "~/lib/logger";

import { AgentError, agentErrorFromAbortSignal } from "./errors";
import type { MoatStreamEvent } from "./events";
import type { RunStepStore } from "./persistence/run-step-store";
import type {
	AgentMessage,
	AgentModelProvider,
	AgentModelResponse,
	AgentToolCall,
	AgentToolOutput,
} from "./providers/model-provider";
import type { ToolExecutor } from "./tools/executor";
import { getEnabledToolSpecs } from "./tools/registry";

export type AgentLoopResult = {
	finalText: string;
	finalStepId?: string;
	providerResponseId?: string;
	inputTokens?: number;
	outputTokens?: number;
};

type ModelStepResult = AgentModelResponse & { stepId: string };

export type AgentLoopInput = {
	userId: string;
	householdId?: string;
	conversationId: string;
	runId: string;
	initialMessages: AgentMessage[];
	maxSteps?: number;
	signal?: AbortSignal;
	onResult: (result: AgentLoopResult) => Promise<void>;
};

export class AgentLoopController {
	constructor(
		private readonly modelProvider: AgentModelProvider,
		private readonly toolExecutor: ToolExecutor,
		private readonly runStepStore: RunStepStore,
	) {}

	async *runLoop(input: AgentLoopInput): AsyncIterable<MoatStreamEvent> {
		const maxSteps =
			input.maxSteps ??
			Number(
				process.env.MOAT_AGENT_MAX_STEPS ??
					process.env.MOAT_AGENT_MAX_STEPS ??
					8,
			);

		let previousResponseId: string | undefined;
		let pendingToolOutputs: AgentToolOutput[] | undefined;
		let finalAssistantText = "";
		let totalInputTokens = 0;
		let totalOutputTokens = 0;
		let latestProviderResponseId: string | undefined;

		for (let modelIteration = 0; modelIteration < maxSteps; modelIteration++) {
			const abortError = agentErrorFromAbortSignal(input.signal);
			if (abortError) throw abortError;

			const modelStepIndex = modelIteration * 2;

			const modelStepIter = this.runModelStep({
				userId: input.userId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepIndex: modelStepIndex,
				previousResponseId,
				messages: modelIteration === 0 ? input.initialMessages : undefined,
				toolOutputs: pendingToolOutputs,
				signal: input.signal,
			});

			for await (const ev of modelStepIter.events) {
				yield ev;
			}
			const modelStep: ModelStepResult | undefined = await modelStepIter.result;

			if (!modelStep) {
				throw new AgentError("PROVIDER_ERROR", "Model step produced no result");
			}

			previousResponseId = modelStep.providerResponseId || previousResponseId;
			latestProviderResponseId =
				modelStep.providerResponseId || latestProviderResponseId;
			finalAssistantText += modelStep.text;
			totalInputTokens += modelStep.usage?.inputTokens ?? 0;
			totalOutputTokens += modelStep.usage?.outputTokens ?? 0;

			if (modelStep.toolCalls.length === 0) {
				await input.onResult({
					finalText: finalAssistantText,
					finalStepId: modelStep.stepId,
					providerResponseId: latestProviderResponseId,
					inputTokens: totalInputTokens || undefined,
					outputTokens: totalOutputTokens || undefined,
				});
				return;
			}

			pendingToolOutputs = yield* this.runToolStep({
				userId: input.userId,
				householdId: input.householdId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepIndex: modelStepIndex + 1,
				toolCalls: modelStep.toolCalls,
				signal: input.signal,
			});
		}

		throw new AgentError(
			"MAX_STEPS_EXCEEDED",
			"Moat agent exceeded max loop steps.",
		);
	}

	private runModelStep(input: {
		userId: string;
		conversationId: string;
		runId: string;
		stepIndex: number;
		previousResponseId?: string;
		messages?: AgentMessage[];
		toolOutputs?: AgentToolOutput[];
		signal?: AbortSignal;
	}): {
		events: AsyncIterable<MoatStreamEvent>;
		result: Promise<ModelStepResult>;
	} {
		const provider = this.modelProvider;
		const stepStore = this.runStepStore;

		let resolveResult!: (value: ModelStepResult) => void;
		let rejectResult!: (err: unknown) => void;
		const resultPromise = new Promise<ModelStepResult>((resolve, reject) => {
			resolveResult = resolve;
			rejectResult = reject;
		});

		const events = (async function* (): AsyncIterable<MoatStreamEvent> {
			const step = await stepStore.createStep({
				runId: input.runId,
				stepIndex: input.stepIndex,
				type: "model_response",
				input: {
					previousResponseId: input.previousResponseId ?? null,
					hadInitialMessages: Boolean(input.messages?.length),
					hadToolOutputs: Boolean(input.toolOutputs?.length),
				},
			});

			logger.info("agent.step.started", {
				feature: "agent",
				operation: "model_response",
				userId: input.userId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: step.id,
				stepIndex: input.stepIndex,
				provider: provider.providerName,
				model: provider.model,
			});

			yield {
				type: "run_step_started",
				runId: input.runId,
				stepId: step.id,
				stepIndex: input.stepIndex,
				stepType: "model_response",
			};

			let response: AgentModelResponse | undefined;

			try {
				const stream = provider.createResponse({
					userId: input.userId,
					conversationId: input.conversationId,
					runId: input.runId,
					previousResponseId: input.previousResponseId,
					messages: input.messages,
					toolOutputs: input.toolOutputs,
					tools: getEnabledToolSpecs(),
					signal: input.signal,
				});

				for await (const ev of stream) {
					const abortError = agentErrorFromAbortSignal(input.signal);
					if (abortError) throw abortError;
					switch (ev.type) {
						case "text_delta":
							yield {
								type: "message_delta",
								content: ev.content,
								runId: input.runId,
								stepId: step.id,
							};
							break;
						case "tool_call":
							break;
						case "response_done":
							response = ev.response;
							break;
					}
				}

				if (!response) {
					throw new AgentError(
						"PROVIDER_ERROR",
						"Model stream ended without final response",
					);
				}

				await stepStore.completeStep({
					stepId: step.id,
					providerResponseId: response.providerResponseId,
					output: {
						textLength: response.text.length,
						toolCallCount: response.toolCalls.length,
					},
				});

				logger.info("agent.step.completed", {
					feature: "agent",
					operation: "model_response",
					userId: input.userId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: step.id,
					stepIndex: input.stepIndex,
					provider: provider.providerName,
					model: provider.model,
				});

				yield {
					type: "run_step_done",
					runId: input.runId,
					stepId: step.id,
					stepIndex: input.stepIndex,
					stepType: "model_response",
				};

				resolveResult({ ...response, stepId: step.id });
			} catch (error) {
				if (error instanceof AgentError && error.code === "CANCELLED") {
					await stepStore
						.cancelStep({ stepId: step.id, reason: error.message })
						.catch(() => undefined);
					logger.info("agent.step.cancelled", {
						feature: "agent",
						operation: "model_response",
						userId: input.userId,
						conversationId: input.conversationId,
						runId: input.runId,
						stepId: step.id,
						stepIndex: input.stepIndex,
					});
				} else {
					await stepStore
						.failStep({
							stepId: step.id,
							code: error instanceof AgentError ? error.code : "PROVIDER_ERROR",
							error,
						})
						.catch(() => undefined);
					logger.logError("agent.step.failed", error, {
						feature: "agent",
						operation: "model_response",
						userId: input.userId,
						conversationId: input.conversationId,
						runId: input.runId,
						stepId: step.id,
						stepIndex: input.stepIndex,
					});
				}
				rejectResult(error);
				throw error;
			}
		})();

		return { events, result: resultPromise };
	}

	private async *runToolStep(input: {
		userId: string;
		householdId?: string;
		conversationId: string;
		runId: string;
		stepIndex: number;
		toolCalls: AgentToolCall[];
		signal?: AbortSignal;
	}): AsyncGenerator<MoatStreamEvent, AgentToolOutput[], void> {
		const step = await this.runStepStore.createStep({
			runId: input.runId,
			stepIndex: input.stepIndex,
			type: "tool_execution",
			input: { toolCallCount: input.toolCalls.length },
		});

		logger.info("agent.step.started", {
			feature: "agent",
			operation: "tool_execution",
			userId: input.userId,
			conversationId: input.conversationId,
			runId: input.runId,
			stepId: step.id,
			stepIndex: input.stepIndex,
		});

		yield {
			type: "run_step_started",
			runId: input.runId,
			stepId: step.id,
			stepIndex: input.stepIndex,
			stepType: "tool_execution",
		};

		try {
			for (const toolCall of input.toolCalls) {
				yield {
					type: "tool_call_started",
					runId: input.runId,
					stepId: step.id,
					toolCallId: toolCall.id,
					toolName: toolCall.name,
					displayName: toolCall.name,
				};
			}

			const emittedEvents: MoatStreamEvent[] = [];
			const outputs = await this.toolExecutor.executeToolCalls({
				userId: input.userId,
				householdId: input.householdId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: step.id,
				toolCalls: input.toolCalls,
				signal: input.signal,
				emit: (event) => {
					emittedEvents.push(event);
				},
			});

			for (const event of emittedEvents) {
				yield event;
			}

			for (const out of outputs) {
				const tc = input.toolCalls.find((c) => c.id === out.toolCallId);
				yield {
					type: "tool_call_done",
					runId: input.runId,
					stepId: step.id,
					toolCallId: out.toolCallId,
					toolName: tc?.name ?? "unknown",
					summary: summarizeToolOutput(out.output),
				};
			}

			await this.runStepStore.completeStep({
				stepId: step.id,
				output: { toolCallCount: outputs.length },
			});

			logger.info("agent.step.completed", {
				feature: "agent",
				operation: "tool_execution",
				userId: input.userId,
				conversationId: input.conversationId,
				runId: input.runId,
				stepId: step.id,
				stepIndex: input.stepIndex,
			});

			yield {
				type: "run_step_done",
				runId: input.runId,
				stepId: step.id,
				stepIndex: input.stepIndex,
				stepType: "tool_execution",
			};

			return outputs;
		} catch (error) {
			if (error instanceof AgentError && error.code === "CANCELLED") {
				await this.runStepStore
					.cancelStep({ stepId: step.id, reason: error.message })
					.catch(() => undefined);
				logger.info("agent.step.cancelled", {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: step.id,
					stepIndex: input.stepIndex,
				});
			} else {
				await this.runStepStore
					.failStep({
						stepId: step.id,
						code: error instanceof AgentError ? error.code : "TOOL_ERROR",
						error,
					})
					.catch(() => undefined);
				logger.logError("agent.step.failed", error, {
					feature: "agent",
					operation: "tool_execution",
					userId: input.userId,
					conversationId: input.conversationId,
					runId: input.runId,
					stepId: step.id,
					stepIndex: input.stepIndex,
				});
			}
			throw error;
		}
	}
}

function summarizeToolOutput(output: unknown): string {
	if (output && typeof output === "object" && "status" in output) {
		const status = (output as { status?: string }).status;
		return status ? `status=${status}` : "completed";
	}
	return "completed";
}
