import { logger } from "~/lib/logger";
import { db as defaultDb } from "~/server/db";

import { ContextBuilder } from "./context-builder";
import { ConversationTitleService } from "./conversation-title-service";
import { AgentError, toAgentError } from "./errors";
import type { MoatStreamEvent } from "./events";
import { AgentLoopController } from "./loop-controller";
import { ConversationStore } from "./persistence/conversation-store";
import { MessageStore } from "./persistence/message-store";
import { RunStepStore } from "./persistence/run-step-store";
import { RunStore } from "./persistence/run-store";
import { ToolCallStore } from "./persistence/tool-call-store";
import type { AgentModelProvider } from "./providers/model-provider";
import { OpenAIResponsesProvider } from "./providers/openai-responses-provider";
import type { MoatAgentRunInput, MoatAgentRunner } from "./runner";
import { TimelineStore } from "./timeline/timeline-store";
import { ToolExecutor } from "./tools/executor";
import { moatTools } from "./tools/registry";

export type MoatAgentDeps = {
	db?: typeof defaultDb;
	modelProvider?: AgentModelProvider;
};

export class MoatAgent implements MoatAgentRunner {
	private readonly db: typeof defaultDb;
	private readonly modelProvider: AgentModelProvider;
	private readonly conversationStore: ConversationStore;
	private readonly messageStore: MessageStore;
	private readonly runStore: RunStore;
	private readonly runStepStore: RunStepStore;
	private readonly toolCallStore: ToolCallStore;
	private readonly timelineStore: TimelineStore;
	private readonly contextBuilder: ContextBuilder;
	private readonly toolExecutor: ToolExecutor;
	private readonly loopController: AgentLoopController;
	private readonly conversationTitleService: ConversationTitleService;
	// Buffer markdown deltas in memory; flush once per step to avoid per-token DB writes.
	private readonly markdownDeltaBuffer = new Map<
		string,
		{ conversationId: string; runId?: string; stepId?: string; content: string }
	>();

	constructor(deps: MoatAgentDeps = {}) {
		this.db = deps.db ?? defaultDb;
		this.modelProvider = deps.modelProvider ?? new OpenAIResponsesProvider();
		this.conversationStore = new ConversationStore(this.db);
		this.messageStore = new MessageStore(this.db);
		this.runStore = new RunStore(this.db);
		this.runStepStore = new RunStepStore(this.db);
		this.toolCallStore = new ToolCallStore(this.db);
		this.timelineStore = new TimelineStore(this.db);
		this.contextBuilder = new ContextBuilder(this.messageStore);
		this.toolExecutor = new ToolExecutor(moatTools, this.toolCallStore);
		this.conversationTitleService = new ConversationTitleService();
		this.loopController = new AgentLoopController(
			this.modelProvider,
			this.toolExecutor,
			this.runStepStore,
		);
	}

	async *run(input: MoatAgentRunInput): AsyncIterable<MoatStreamEvent> {
		if (!input.userId) {
			throw new AgentError("AUTH_ERROR", "userId is required");
		}
		if (!input.message || typeof input.message !== "string") {
			throw new AgentError("VALIDATION_ERROR", "message is required");
		}

		// 1. Idempotency: reject duplicate clientRequestId before creating rows.
		if (input.clientRequestId) {
			const existing = await this.runStore.findExistingByClientRequestId({
				userId: input.userId,
				clientRequestId: input.clientRequestId,
			});
			if (existing) {
				throw new AgentError(
					"VALIDATION_ERROR",
					"Duplicate clientRequestId",
					"This message was already received.",
				);
			}
		}

		// 2. Resolve / create conversation (scoped to user)
		let conversationId: string;
		let conversationTitle: string | null | undefined;
		if (input.conversationId) {
			const existing = await this.conversationStore.getConversationForUser({
				userId: input.userId,
				conversationId: input.conversationId,
			});
			if (!existing) {
				throw new AgentError("AUTH_ERROR", "Conversation not found");
			}
			conversationId = existing.id;
			conversationTitle = existing.title;
		} else {
			conversationTitle =
				this.conversationTitleService.createTitleFromFirstMessage(
					input.message,
				);
			const created = await this.conversationStore.createConversation({
				userId: input.userId,
				householdId: input.householdId,
				title: conversationTitle,
			});
			conversationId = created.id;
		}

		// 3. Save the user message first
		await this.messageStore.createMessage({
			conversationId,
			role: "user",
			content: input.message,
		});
		await this.timelineStore.createMarkdownBlock({
			conversationId,
			role: "user",
			content: input.message,
		});

		// 4. Create agent run row
		const run = await this.runStore.createRun({
			userId: input.userId,
			householdId: input.householdId,
			conversationId,
			clientRequestId: input.clientRequestId,
			provider: this.modelProvider.providerName,
			model: this.modelProvider.model,
		});

		await this.runStore.markRunning({ runId: run.id });

		logger.info("agent.chat.started", {
			feature: "agent",
			userId: input.userId,
			operation: "chat.stream",
			conversationId,
			runId: run.id,
			provider: this.modelProvider.providerName,
			model: this.modelProvider.model,
		});

		// 5. Build context (now that user message exists)
		const initialMessages = await this.contextBuilder.build({
			conversationId,
			clientContext: input.clientContext,
		});

		let finalText = "";
		let finalStepId: string | undefined;
		let providerResponseId: string | undefined;
		let inputTokens: number | undefined;
		let outputTokens: number | undefined;
		let cancelled = false;

		try {
			yield {
				type: "run_started",
				conversationId,
				runId: run.id,
				title: conversationTitle ?? undefined,
			};

			yield {
				type: "status",
				content: "Thinking...",
			};

			const loop = this.loopController.runLoop({
				userId: input.userId,
				householdId: input.householdId,
				conversationId,
				runId: run.id,
				initialMessages,
				signal: input.signal,
				onResult: async (result) => {
					finalText = result.finalText;
					finalStepId = result.finalStepId;
					providerResponseId = result.providerResponseId;
					inputTokens = result.inputTokens;
					outputTokens = result.outputTokens;
				},
			});

			for await (const ev of loop) {
				if (ev.type === "run_cancelled") cancelled = true;
				await this.persistTimelineEvent({ conversationId, event: ev });
				yield ev;
			}

			if (cancelled || input.signal?.aborted) {
				await this.runStore.cancelRun({
					runId: run.id,
					reason: "Client disconnected or cancelled",
				});
				logger.info("agent.chat.cancelled", {
					feature: "agent",
					userId: input.userId,
					conversationId,
					runId: run.id,
				});
				return;
			}

			// 6. Persist assistant final message
			let assistantMessageId: string | undefined;
			if (finalText && finalText.trim().length > 0) {
				const assistantMsg = await this.messageStore.createMessage({
					conversationId,
					role: "assistant",
					content: finalText,
					metadata: {
						runId: run.id,
						providerResponseId: providerResponseId ?? null,
					},
				});
				assistantMessageId = assistantMsg.id;
			}

			await this.runStore.completeRun({
				runId: run.id,
				providerResponseId,
				inputTokens,
				outputTokens,
			});

			await this.conversationStore.touchConversation({ conversationId });

			yield {
				type: "message_done",
				messageId: assistantMessageId ?? run.id,
				runId: run.id,
				stepId: finalStepId,
			};

			logger.info("agent.chat.completed", {
				feature: "agent",
				userId: input.userId,
				conversationId,
				runId: run.id,
				inputTokens,
				outputTokens,
			});
		} catch (error) {
			const agentError = toAgentError(error);
			if (agentError.code === "CANCELLED") {
				await this.runStore
					.cancelRun({ runId: run.id, reason: agentError.message })
					.catch(() => undefined);
				logger.info("agent.chat.cancelled", {
					feature: "agent",
					userId: input.userId,
					conversationId,
					runId: run.id,
				});
				yield { type: "run_cancelled", runId: run.id };
				return;
			}

			await this.runStore
				.failRun({ runId: run.id, code: agentError.code, error: agentError })
				.catch(() => undefined);

			logger.logError("agent.chat.failed", agentError, {
				feature: "agent",
				userId: input.userId,
				conversationId,
				runId: run.id,
				errorCode: agentError.code,
			});

			yield {
				type: "error",
				runId: run.id,
				error: {
					code: agentError.code,
					message: agentError.clientMessage,
				},
			};
		}
	}

	private async persistTimelineEvent(input: {
		conversationId: string;
		event: MoatStreamEvent;
	}) {
		const { conversationId, event } = input;

		switch (event.type) {
			case "message_delta": {
				// Buffer deltas in memory; flush to DB once per step on run_step_done.
				const key = `${event.runId ?? "unknown"}:${event.stepId ?? "unknown"}`;
				const existing = this.markdownDeltaBuffer.get(key);
				if (existing) {
					existing.content += event.content;
				} else {
					this.markdownDeltaBuffer.set(key, {
						conversationId,
						runId: event.runId,
						stepId: event.stepId,
						content: event.content,
					});
				}
				break;
			}
			case "run_step_started":
				await this.timelineStore.createRunStepBlock({
					conversationId,
					runId: event.runId,
					stepId: event.stepId,
					stepIndex: event.stepIndex,
					stepType: event.stepType,
					status: "running",
				});
				break;
			case "run_step_done":
				// Flush any buffered markdown for this step before marking it done.
				if (event.stepType === "model_response") {
					await this.flushMarkdownBuffer(event.runId, event.stepId);
				}
				await this.timelineStore.updateRunStepBlock({
					conversationId,
					runId: event.runId,
					stepId: event.stepId,
					stepIndex: event.stepIndex,
					stepType: event.stepType,
					status: "completed",
				});
				break;
			case "tool_call_started":
				await this.timelineStore.createToolCallBlock({
					conversationId,
					runId: event.runId,
					stepId: event.stepId,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					displayName: event.displayName,
					status: "running",
				});
				break;
			case "tool_call_done":
				await this.timelineStore.updateToolCallBlock({
					conversationId,
					runId: event.runId,
					stepId: event.stepId,
					toolCallId: event.toolCallId,
					toolName: event.toolName,
					status: "completed",
					summary: event.summary,
				});
				break;
			default:
				break;
		}
	}

	private async flushMarkdownBuffer(
		runId: string,
		stepId: string,
	): Promise<void> {
		const key = `${runId}:${stepId}`;
		const buffered = this.markdownDeltaBuffer.get(key);
		if (!buffered) return;
		this.markdownDeltaBuffer.delete(key);
		await this.timelineStore.appendAssistantMarkdownDelta({
			conversationId: buffered.conversationId,
			content: buffered.content,
			runId: buffered.runId,
			stepId: buffered.stepId,
		});
	}
}
