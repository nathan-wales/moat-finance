import type { AgentClientContext } from "./context-builder";
import type { MoatStreamEvent } from "./events";

export type MoatAgentRunInput = {
	userId: string;
	householdId?: string;
	conversationId?: string;
	message: string;
	clientRequestId?: string;
	clientContext?: AgentClientContext;
	signal?: AbortSignal;
};

export interface MoatAgentRunner {
	run(input: MoatAgentRunInput): AsyncIterable<MoatStreamEvent>;
}
