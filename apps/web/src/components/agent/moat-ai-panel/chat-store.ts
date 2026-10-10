import { useTaxesStore } from "@moat/features/taxes";
import { create } from "zustand";
import { devtools } from "zustand/middleware";
import { useShallow } from "zustand/react/shallow";
import type { MoatAiTimelineBlock } from "~/components/agent/moat-ai-timeline-block";
import type { WidgetActionSubmit } from "~/components/agent/moat-ai-widgets";
import { trackMoatAi } from "~/lib/agent-analytics";
import {
	type ConversationSummary,
	fetchConversationList,
	fetchMoatAgentTimeline,
	type MoatAgentStreamEvent,
	renameConversation,
	streamMoatAgentMessage,
	streamMoatWidgetAction,
} from "~/lib/api/agent";
import {
	createClientId,
	getActivePage,
	loadStoredConversationId,
	persistConversationId,
} from "./utils";

type SendMessageInput = {
	pathname: string;
	isDemoMode: boolean;
	messageText?: string;
	scrollToBottom?: () => void;
};

type WidgetActionInput = Parameters<WidgetActionSubmit>[0] & {
	scrollToBottom?: () => void;
};

type MoatAiChatState = {
	conversationId: string | undefined;
	blocks: MoatAiTimelineBlock[];
	input: string;
	status: string;
	isRunning: boolean;
	conversations: ConversationSummary[];
	historyOpen: boolean;
	historySearch: string;
};

type MoatAiChatActions = {
	setInput: (input: string) => void;
	setHistoryOpen: (open: boolean) => void;
	setHistorySearch: (search: string) => void;
	loadStoredTimeline: () => Promise<void>;
	refreshConversationList: () => Promise<void>;
	startNewConversation: (input: { isDemoMode: boolean }) => void;
	loadConversation: (conversationId: string) => Promise<void>;
	sendMessage: (input: SendMessageInput) => Promise<void>;
	stopRun: (input: { isDemoMode: boolean }) => void;
	submitWidgetAction: (input: WidgetActionInput) => Promise<void>;
	renameConversationTitle: (input: {
		conversationId: string;
		title: string;
	}) => Promise<void>;
	abortActiveRun: () => void;
	selectSuggestedPrompt: (input: {
		prompt: string;
		isDemoMode: boolean;
	}) => void;
};

type MoatAiChatStore = MoatAiChatState & MoatAiChatActions;

let abortController: AbortController | null = null;
const assistantBlockIdsByStep = new Map<string, string>();

function getAssistantStepKey(event: { runId?: string; stepId?: string }) {
	return `${event.runId ?? "unknown-run"}:${event.stepId ?? "unknown-step"}`;
}

function setStoredConversationId(conversationId: string | undefined) {
	persistConversationId(conversationId);
	useMoatAiChatStore.setState({ conversationId });
}

function appendAssistantDelta(
	event: Extract<MoatAgentStreamEvent, { type: "message_delta" }>,
	scrollToBottom?: () => void,
) {
	const stepKey = getAssistantStepKey(event);
	const existingBlockId = assistantBlockIdsByStep.get(stepKey);

	if (existingBlockId) {
		useMoatAiChatStore.setState((currentState) => ({
			blocks: currentState.blocks.map((message) =>
				message.id === existingBlockId && message.type === "markdown"
					? { ...message, content: `${message.content}${event.content}` }
					: message,
			),
		}));
		scrollToBottom?.();
		return;
	}

	const blockId = createClientId();
	assistantBlockIdsByStep.set(stepKey, blockId);
	useMoatAiChatStore.setState((currentState) => ({
		blocks: [
			...currentState.blocks,
			{
				id: blockId,
				type: "markdown",
				role: "assistant",
				content: event.content,
				runId: event.runId,
				stepId: event.stepId,
			},
		],
	}));
	scrollToBottom?.();
}

function replaceAssistantMessage(content: string, tone?: "error") {
	const assistantBlockIds = Array.from(
		assistantBlockIdsByStep.values(),
	).reverse();
	useMoatAiChatStore.setState((currentState) => {
		const targetId = assistantBlockIds.find((blockId) =>
			currentState.blocks.some(
				(block) => block.id === blockId && block.type === "markdown",
			),
		);

		if (!targetId) {
			return {
				blocks: [
					...currentState.blocks,
					{
						id: createClientId(),
						type: "markdown",
						role: "assistant",
						content,
						tone: tone ?? "default",
					},
				],
			};
		}

		return {
			blocks: currentState.blocks.map((message) =>
				message.id === targetId && message.type === "markdown"
					? { ...message, content, tone: tone ?? "default" }
					: message,
			),
		};
	});
}

function addOrUpdateRunStepBlock(
	event: Extract<
		MoatAgentStreamEvent,
		{ type: "run_step_started" | "run_step_done" }
	>,
) {
	const blockId = `run-step-${event.runId}-${event.stepId}`;
	const status = event.type === "run_step_started" ? "running" : "completed";
	const block: MoatAiTimelineBlock = {
		id: blockId,
		type: "run_step",
		role: "assistant",
		stepType: event.stepType,
		stepIndex: event.stepIndex,
		status,
		runId: event.runId,
		stepId: event.stepId,
	};

	useMoatAiChatStore.setState((currentState) => {
		const hasBlock = currentState.blocks.some(
			(currentBlock) => currentBlock.id === blockId,
		);
		return {
			blocks: hasBlock
				? currentState.blocks.map((currentBlock) =>
						currentBlock.id === blockId ? block : currentBlock,
					)
				: [...currentState.blocks, block],
		};
	});
}

function addOrUpdateToolCallBlock(
	event: Extract<
		MoatAgentStreamEvent,
		{ type: "tool_call_started" | "tool_call_done" }
	>,
) {
	const blockId = `tool-call-${event.runId}-${event.toolCallId}`;
	const status = event.type === "tool_call_started" ? "running" : "completed";
	const block: MoatAiTimelineBlock = {
		id: blockId,
		type: "tool_call",
		role: "assistant",
		toolCallId: event.toolCallId,
		toolName: event.toolName,
		displayName:
			event.type === "tool_call_started" ? event.displayName : undefined,
		status,
		summary: event.type === "tool_call_done" ? event.summary : undefined,
		runId: event.runId,
		stepId: event.stepId,
	};

	useMoatAiChatStore.setState((currentState) => {
		const hasBlock = currentState.blocks.some(
			(currentBlock) => currentBlock.id === blockId,
		);
		return {
			blocks: hasBlock
				? currentState.blocks.map((currentBlock) =>
						currentBlock.id === blockId ? block : currentBlock,
					)
				: [...currentState.blocks, block],
		};
	});
}

function upsertConversationSummary(conversation: ConversationSummary) {
	useMoatAiChatStore.setState((currentState) => {
		const hasConversation = currentState.conversations.some(
			(currentConversation) => currentConversation.id === conversation.id,
		);
		return {
			conversations: hasConversation
				? currentState.conversations.map((currentConversation) =>
						currentConversation.id === conversation.id
							? conversation
							: currentConversation,
					)
				: [conversation, ...currentState.conversations],
		};
	});
}

function abortRun() {
	abortController?.abort();
	abortController = null;
	assistantBlockIdsByStep.clear();
}

export const useMoatAiChatStore = create<MoatAiChatStore>()(
	devtools(
		(set, get) => ({
			conversationId: loadStoredConversationId(),
			blocks: [],
			input: "",
			status: "Ready",
			isRunning: false,
			conversations: [],
			historyOpen: false,
			historySearch: "",

			setInput: (input) => set({ input }),
			setHistoryOpen: (open) =>
				set({
					historyOpen: open,
					historySearch: open ? get().historySearch : "",
				}),
			setHistorySearch: (historySearch) => set({ historySearch }),

			loadStoredTimeline: async () => {
				const conversationId = get().conversationId;
				if (!conversationId || get().blocks.length > 0) return;
				try {
					const blocks = await fetchMoatAgentTimeline({ conversationId });
					if (get().conversationId === conversationId) set({ blocks });
				} catch {
					return;
				}
			},

			refreshConversationList: async () => {
				try {
					set({ conversations: await fetchConversationList() });
				} catch {
					return;
				}
			},

			startNewConversation: ({ isDemoMode }) => {
				if (get().isRunning) abortRun();
				setStoredConversationId(undefined);
				set({
					blocks: [],
					status: "Ready",
					input: "",
					isRunning: false,
					historyOpen: false,
				});
				trackMoatAi("moat_finance_ai_conversation_reset", {
					demoUser: isDemoMode,
				});
			},

			loadConversation: async (conversationId) => {
				if (get().isRunning) abortRun();
				setStoredConversationId(conversationId);
				set({
					blocks: [],
					status: "Ready",
					input: "",
					isRunning: false,
					historyOpen: false,
					historySearch: "",
				});
				try {
					const blocks = await fetchMoatAgentTimeline({ conversationId });
					if (get().conversationId === conversationId) set({ blocks });
				} catch {
					return;
				}
			},

			sendMessage: async ({
				pathname,
				isDemoMode,
				messageText,
				scrollToBottom,
			}) => {
				const trimmed = (messageText ?? get().input).trim();
				if (!trimmed || get().isRunning) return;

				const conversationId = get().conversationId;
				const userMessage: MoatAiTimelineBlock = {
					id: createClientId(),
					type: "markdown",
					role: "user",
					content: trimmed,
				};
				assistantBlockIdsByStep.clear();
				set((currentState) => ({
					blocks: [...currentState.blocks, userMessage],
					input: "",
					status: "Thinking...",
					isRunning: true,
				}));
				trackMoatAi("moat_finance_ai_message_sent", {
					demoUser: isDemoMode,
					hasConversation: Boolean(conversationId),
					messageLength: trimmed.length,
				});

				const controller = new AbortController();
				abortController = controller;
				const selectedTaxYear = useTaxesStore.getState().taxYear;

				try {
					await streamMoatAgentMessage({
						input: {
							conversationId,
							message: trimmed,
							clientRequestId: createClientId(),
							clientContext: {
								currentRoute: pathname,
								activePage: getActivePage(pathname),
								...(selectedTaxYear !== null
									? { taxYear: selectedTaxYear }
									: {}),
							},
						},
						signal: controller.signal,
						onEvent: (event) => {
							switch (event.type) {
								case "run_started": {
									setStoredConversationId(event.conversationId);
									if (event.title) {
										const timestamp = new Date().toISOString();
										upsertConversationSummary({
											id: event.conversationId,
											title: event.title,
											createdAt: timestamp,
											updatedAt: timestamp,
										});
									}
									break;
								}
								case "status":
									set({ status: event.content });
									break;
								case "message_delta":
									appendAssistantDelta(event, scrollToBottom);
									set({ status: "Responding..." });
									break;
								case "tool_call_started":
									set({ status: event.displayName ?? event.toolName });
									addOrUpdateToolCallBlock(event);
									scrollToBottom?.();
									break;
								case "tool_call_done":
									set({ status: event.summary });
									addOrUpdateToolCallBlock(event);
									scrollToBottom?.();
									break;
								case "run_step_started":
								case "run_step_done":
									addOrUpdateRunStepBlock(event);
									scrollToBottom?.();
									break;
								case "message_done":
									set({ status: "Ready" });
									trackMoatAi("moat_finance_ai_run_completed", {
										demoUser: isDemoMode,
									});
									void get().refreshConversationList();
									break;
								case "widget_done":
									set((currentState) => ({
										blocks: [
											...currentState.blocks,
											{
												id: event.widget.id,
												type: "widget",
												role: "assistant",
												widget: event.widget,
												runId: event.runId,
												stepId: event.stepId,
											},
										],
										status: "Ready",
									}));
									scrollToBottom?.();
									break;
								case "action_done":
									set((currentState) => ({
										blocks: [
											...currentState.blocks,
											{
												id: event.actionId,
												type: "action_result",
												role: "assistant",
												actionType: event.actionType,
												summary: event.summary,
												result: event.result,
												runId: event.runId,
												stepId: event.stepId,
											},
										],
										status: "Ready",
									}));
									scrollToBottom?.();
									break;
								case "user_input_required":
									set({ status: "Confirmation needed" });
									break;
								case "run_cancelled":
									set({ status: "Cancelled" });
									break;
								case "error":
									replaceAssistantMessage(event.error.message, "error");
									set({ status: "Ready" });
									trackMoatAi("moat_finance_ai_run_failed", {
										demoUser: isDemoMode,
										code: event.error.code,
									});
									break;
								case "widget_started":
									set({ status: "Preparing widget..." });
									break;
							}
						},
					});
				} catch (error) {
					if (!controller.signal.aborted) {
						replaceAssistantMessage(
							error instanceof Error
								? error.message
								: "Unable to reach Moat AI.",
							"error",
						);
						set({ status: "Ready" });
						trackMoatAi("moat_finance_ai_run_failed", {
							demoUser: isDemoMode,
							code: "stream_error",
						});
					}
				} finally {
					if (abortController === controller) abortController = null;
					assistantBlockIdsByStep.clear();
					set({ isRunning: false });
				}
			},

			stopRun: ({ isDemoMode }) => {
				abortRun();
				set({ isRunning: false, status: "Stopped" });
				trackMoatAi("moat_finance_ai_run_aborted", { demoUser: isDemoMode });
			},

			submitWidgetAction: async ({
				widgetId,
				actionType,
				values,
				scrollToBottom,
			}) => {
				const conversationId = get().conversationId;
				if (!conversationId || get().isRunning) return;
				set({ isRunning: true, status: "Working..." });
				const controller = new AbortController();
				abortController = controller;
				try {
					await streamMoatWidgetAction({
						input: {
							conversationId,
							widgetId,
							actionType,
							values,
							clientRequestId: createClientId(),
						},
						signal: controller.signal,
						onEvent: (event) => {
							switch (event.type) {
								case "widget_done":
									set((currentState) => ({
										blocks: [
											...currentState.blocks,
											{
												id: event.widget.id,
												type: "widget",
												role: "assistant",
												widget: event.widget,
												runId: event.runId,
												stepId: event.stepId,
											},
										],
									}));
									scrollToBottom?.();
									break;
								case "action_done":
									set((currentState) => ({
										blocks: [
											...currentState.blocks,
											{
												id: event.actionId,
												type: "action_result",
												role: "assistant",
												actionType: event.actionType,
												summary: event.summary,
												result: event.result,
												runId: event.runId,
												stepId: event.stepId,
											},
										],
									}));
									scrollToBottom?.();
									break;
								case "user_input_required":
									set({ status: "Confirmation needed" });
									break;
								case "error":
									set((currentState) => ({
										blocks: [
											...currentState.blocks,
											{
												id: createClientId(),
												type: "markdown",
												role: "assistant",
												content: event.error.message,
												tone: "error",
											},
										],
									}));
									break;
								case "status":
									set({ status: event.content });
									break;
								default:
									break;
							}
						},
					});
				} catch (error) {
					if (!controller.signal.aborted) {
						set((currentState) => ({
							blocks: [
								...currentState.blocks,
								{
									id: createClientId(),
									type: "markdown",
									role: "assistant",
									content:
										error instanceof Error
											? error.message
											: "Unable to complete that action.",
									tone: "error",
								},
							],
						}));
					}
				} finally {
					if (abortController === controller) abortController = null;
					set({ isRunning: false, status: "Ready" });
				}
			},

			renameConversationTitle: async ({ conversationId, title }) => {
				const conversation = await renameConversation({
					conversationId,
					title,
				});
				upsertConversationSummary(conversation);
			},

			abortActiveRun: () => abortRun(),

			selectSuggestedPrompt: ({ prompt, isDemoMode }) => {
				set({ input: prompt });
				trackMoatAi("moat_finance_ai_suggested_prompt_clicked", {
					demoUser: isDemoMode,
				});
			},
		}),
		{ name: "moat-ai-chat-store" },
	),
);

export const useMoatAiConversationId = () =>
	useMoatAiChatStore((state) => state.conversationId);

export const useMoatAiPanelState = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			blocks: state.blocks,
			status: state.status,
			conversationId: state.conversationId,
			isRunning: state.isRunning,
		})),
	);

export const useMoatAiComposerState = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			input: state.input,
			isRunning: state.isRunning,
			setInput: state.setInput,
			sendMessage: state.sendMessage,
			stopRun: state.stopRun,
		})),
	);

export const useMoatAiHeaderState = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			blocks: state.blocks,
			conversationId: state.conversationId,
			status: state.status,
			startNewConversation: state.startNewConversation,
		})),
	);

export const useMoatAiHistoryState = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			conversationId: state.conversationId,
			conversations: state.conversations,
			historyOpen: state.historyOpen,
			historySearch: state.historySearch,
			setHistoryOpen: state.setHistoryOpen,
			setHistorySearch: state.setHistorySearch,
			loadConversation: state.loadConversation,
			renameConversationTitle: state.renameConversationTitle,
		})),
	);

export const useMoatAiMessageListState = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			blocks: state.blocks,
			status: state.status,
			selectSuggestedPrompt: state.selectSuggestedPrompt,
			submitWidgetAction: state.submitWidgetAction,
		})),
	);

export const useMoatAiChatActions = () =>
	useMoatAiChatStore(
		useShallow((state) => ({
			abortActiveRun: state.abortActiveRun,
			loadStoredTimeline: state.loadStoredTimeline,
			refreshConversationList: state.refreshConversationList,
		})),
	);
