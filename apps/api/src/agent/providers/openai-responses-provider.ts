import OpenAI from "openai";

import { AgentError, agentErrorFromAbortSignal } from "../errors";
import type {
	AgentModelInput,
	AgentModelProvider,
	AgentModelProviderCapabilities,
	AgentModelResponse,
	AgentModelStreamEvent,
	AgentToolCall,
	AgentToolSpec,
} from "./model-provider";

type OpenAIInputItem = Record<string, unknown>;

function buildOpenAIInput(input: AgentModelInput): OpenAIInputItem[] {
	const items: OpenAIInputItem[] = [];

	if (input.messages) {
		for (const msg of input.messages) {
			// The Responses API accepts role-based EasyInputMessages.
			items.push({
				role: msg.role === "tool" ? "user" : msg.role,
				content: msg.content,
			});
		}
	}

	if (input.toolOutputs) {
		for (const out of input.toolOutputs) {
			items.push({
				type: "function_call_output",
				call_id: out.toolCallId,
				output:
					typeof out.output === "string"
						? out.output
						: JSON.stringify(out.output ?? null),
			});
		}
	}

	return items;
}

function buildOpenAITools(tools: AgentToolSpec[]): OpenAIInputItem[] {
	return tools.map((tool) => ({
		type: "function",
		name: tool.name,
		description: tool.description,
		parameters: tool.parameters,
		strict: false,
	}));
}

function safeParseArguments(raw: string): unknown {
	if (!raw) return {};
	try {
		return JSON.parse(raw);
	} catch {
		return { __raw: raw };
	}
}

export class OpenAIResponsesProvider implements AgentModelProvider {
	readonly providerName = "openai";
	readonly model: string;

	readonly capabilities: AgentModelProviderCapabilities = {
		supportsStreaming: true,
		supportsToolCalls: true,
		supportsPreviousResponseId: true,
		supportsJsonSchema: true,
	};

	private readonly client: OpenAI;

	constructor() {
		const apiKey = process.env.OPENAI_API_KEY;
		if (!apiKey) {
			throw new AgentError(
				"PROVIDER_ERROR",
				"OPENAI_API_KEY is not configured",
			);
		}

		this.client = new OpenAI({ apiKey });
		this.model = process.env.OPENAI_MODEL ?? "gpt-4.1-mini";
	}

	async *createResponse(
		input: AgentModelInput,
	): AsyncIterable<AgentModelStreamEvent> {
		const existingAbort = agentErrorFromAbortSignal(input.signal);
		if (existingAbort) throw existingAbort;

		const inputItems = buildOpenAIInput(input);
		const tools = buildOpenAITools(input.tools);

		const params = {
			model: this.model,
			input: inputItems as never,
			previous_response_id: input.previousResponseId,
			tools: tools.length > 0 ? (tools as never) : undefined,
			stream: true as const,
		};

		let stream: AsyncIterable<unknown>;
		try {
			stream = (await this.client.responses.create(params, {
				signal: input.signal,
			})) as unknown as AsyncIterable<unknown>;
		} catch (error) {
			const abortError = agentErrorFromAbortSignal(input.signal);
			if (abortError) throw abortError;
			throw new AgentError(
				"PROVIDER_ERROR",
				error instanceof Error ? error.message : String(error),
			);
		}

		let finalText = "";
		const toolCalls: AgentToolCall[] = [];
		let providerResponseId = "";
		let inputTokens: number | undefined;
		let outputTokens: number | undefined;

		// Buffer streaming function-call argument deltas keyed by the output item id.
		const pendingToolArgs = new Map<
			string,
			{ name: string; callId: string; args: string }
		>();

		try {
			for await (const rawEvent of stream) {
				const abortError = agentErrorFromAbortSignal(input.signal);
				if (abortError) throw abortError;

				const event = rawEvent as {
					type?: string;
					delta?: string;
					item?: {
						id?: string;
						type?: string;
						name?: string;
						call_id?: string;
						arguments?: string;
					};
					item_id?: string;
					arguments?: string;
					response?: {
						id?: string;
						usage?: {
							input_tokens?: number;
							output_tokens?: number;
						};
					};
				};

				switch (event.type) {
					case "response.created":
					case "response.in_progress": {
						if (event.response?.id) {
							providerResponseId = event.response.id;
						}
						break;
					}
					case "response.output_text.delta": {
						const delta = event.delta ?? "";
						if (delta) {
							finalText += delta;
							yield { type: "text_delta", content: delta };
						}
						break;
					}
					case "response.output_item.added": {
						const item = event.item;
						if (item?.type === "function_call" && item.id) {
							pendingToolArgs.set(item.id, {
								name: item.name ?? "",
								callId: item.call_id ?? item.id,
								args: item.arguments ?? "",
							});
						}
						break;
					}
					case "response.function_call_arguments.delta": {
						const itemId = event.item_id;
						if (itemId) {
							const pending = pendingToolArgs.get(itemId);
							if (pending) {
								pending.args += event.delta ?? "";
							}
						}
						break;
					}
					case "response.function_call_arguments.done": {
						const itemId = event.item_id;
						if (itemId) {
							const pending = pendingToolArgs.get(itemId);
							if (pending && event.arguments !== undefined) {
								pending.args = event.arguments;
							}
						}
						break;
					}
					case "response.output_item.done": {
						const item = event.item;
						if (item?.type === "function_call" && item.id) {
							const pending = pendingToolArgs.get(item.id);
							const argsString = item.arguments ?? pending?.args ?? "";
							const callId = item.call_id ?? pending?.callId ?? item.id;
							const name = item.name ?? pending?.name ?? "";
							const toolCall: AgentToolCall = {
								id: callId,
								name,
								arguments: safeParseArguments(argsString),
							};
							toolCalls.push(toolCall);
							pendingToolArgs.delete(item.id);
							yield { type: "tool_call", toolCall };
						}
						break;
					}
					case "response.completed": {
						if (event.response?.id) {
							providerResponseId = event.response.id;
						}
						inputTokens = event.response?.usage?.input_tokens;
						outputTokens = event.response?.usage?.output_tokens;
						break;
					}
					case "response.failed":
					case "error": {
						throw new AgentError(
							"PROVIDER_ERROR",
							"OpenAI Responses stream reported failure",
						);
					}
					default:
						break;
				}
			}
		} catch (error) {
			if (error instanceof AgentError) throw error;
			const abortError = agentErrorFromAbortSignal(input.signal);
			if (abortError) throw abortError;
			throw new AgentError(
				"PROVIDER_ERROR",
				error instanceof Error ? error.message : String(error),
			);
		}

		const response: AgentModelResponse = {
			providerResponseId,
			text: finalText,
			toolCalls,
			usage:
				inputTokens === undefined && outputTokens === undefined
					? undefined
					: { inputTokens, outputTokens },
		};

		yield { type: "response_done", response };
	}
}
