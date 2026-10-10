export type AgentErrorCode =
	| "AUTH_ERROR"
	| "VALIDATION_ERROR"
	| "PROVIDER_ERROR"
	| "TOOL_ERROR"
	| "MAX_STEPS_EXCEEDED"
	| "TIMEOUT"
	| "CANCELLED"
	| "PERSISTENCE_ERROR"
	| "UNKNOWN_ERROR";

export class AgentError extends Error {
	readonly code: AgentErrorCode;
	readonly clientMessage: string;

	constructor(
		code: AgentErrorCode,
		internalMessage: string,
		clientMessage?: string,
	) {
		super(internalMessage);
		this.code = code;
		this.clientMessage = clientMessage ?? defaultClientMessage(code);
		this.name = "AgentError";
	}
}

function defaultClientMessage(code: AgentErrorCode): string {
	switch (code) {
		case "AUTH_ERROR":
			return "You are not authorized to use Moat.";
		case "VALIDATION_ERROR":
			return "Your request was invalid.";
		case "PROVIDER_ERROR":
			return "Something went wrong while generating a response.";
		case "TOOL_ERROR":
			return "A tool failed to run.";
		case "MAX_STEPS_EXCEEDED":
			return "Moat needed too many steps to complete this request.";
		case "TIMEOUT":
			return "Moat took too long to respond.";
		case "CANCELLED":
			return "Response generation was cancelled.";
		case "PERSISTENCE_ERROR":
			return "Moat could not save part of this conversation.";
		default:
			return "An unexpected error occurred.";
	}
}

export function toAgentError(error: unknown): AgentError {
	if (error instanceof AgentError) return error;
	if (error instanceof Error && error.name === "AbortError") {
		return new AgentError("CANCELLED", error.message);
	}
	const message = error instanceof Error ? error.message : String(error);
	return new AgentError("UNKNOWN_ERROR", message);
}

export function agentErrorFromAbortSignal(
	signal: AbortSignal | undefined,
): AgentError | undefined {
	if (!signal?.aborted) return undefined;
	if (signal.reason instanceof AgentError) return signal.reason;
	if (signal.reason instanceof Error) {
		return new AgentError("CANCELLED", signal.reason.message);
	}
	return new AgentError("CANCELLED", "Abort signal was triggered.");
}
