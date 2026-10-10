export type AgentMessage = {
	role: "system" | "user" | "assistant" | "tool";
	content: string;
};

export type AgentToolSpec = {
	name: string;
	description: string;
	parameters: Record<string, unknown>;
};

export type AgentToolCall = {
	id: string;
	name: string;
	arguments: unknown;
};

export type AgentToolOutput = {
	toolCallId: string;
	output: unknown;
};

export type AgentModelInput = {
	userId: string;
	conversationId: string;
	runId: string;
	previousResponseId?: string;
	messages?: AgentMessage[];
	toolOutputs?: AgentToolOutput[];
	tools: AgentToolSpec[];
	signal?: AbortSignal;
};

export type AgentModelResponse = {
	providerResponseId: string;
	text: string;
	toolCalls: AgentToolCall[];
	usage?: {
		inputTokens?: number;
		outputTokens?: number;
	};
};

export type AgentModelStreamEvent =
	| {
			type: "text_delta";
			content: string;
	  }
	| {
			type: "tool_call";
			toolCall: AgentToolCall;
	  }
	| {
			type: "response_done";
			response: AgentModelResponse;
	  };

export type AgentModelProviderCapabilities = {
	supportsStreaming: boolean;
	supportsToolCalls: boolean;
	supportsPreviousResponseId: boolean;
	supportsJsonSchema: boolean;
};

export interface AgentModelProvider {
	readonly providerName: string;
	readonly model: string;
	readonly capabilities: AgentModelProviderCapabilities;

	createResponse(input: AgentModelInput): AsyncIterable<AgentModelStreamEvent>;
}
