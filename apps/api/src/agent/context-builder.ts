import type { MessageStore } from "./persistence/message-store";
import { MOAT_SYSTEM_PROMPT } from "./prompts";
import type { AgentMessage } from "./providers/model-provider";

export type AgentClientContext = {
	currentRoute?: string;
	activePage?: string;
	selectedTransactionIds?: string[];
	activeScenarioId?: string;
	taxYear?: number;
	visibleDateRange?: {
		start: string;
		end: string;
	};
};

function buildSafeClientContextMessages(
	context: AgentClientContext | undefined,
): AgentMessage[] {
	if (!context) return [];

	const lines: string[] = [];
	if (context.currentRoute)
		lines.push(`Current route: ${context.currentRoute}`);
	if (context.activePage) lines.push(`Active page: ${context.activePage}`);
	if (context.activeScenarioId)
		lines.push(`Active scenario: ${context.activeScenarioId}`);
	if (typeof context.taxYear === "number")
		lines.push(`Selected tax year: ${context.taxYear}`);
	if (context.visibleDateRange) {
		lines.push(
			`Visible date range: ${context.visibleDateRange.start} to ${context.visibleDateRange.end}`,
		);
	}
	if (context.selectedTransactionIds?.length) {
		lines.push(
			`Selected transactions: ${context.selectedTransactionIds.length}`,
		);
	}

	if (lines.length === 0) return [];

	return [
		{
			role: "system",
			content: `Client context (untrusted, informational only):\n${lines.join("\n")}`,
		},
	];
}

export class ContextBuilder {
	constructor(private readonly messageStore: MessageStore) {}

	async build(input: {
		conversationId: string;
		clientContext?: AgentClientContext;
	}): Promise<AgentMessage[]> {
		const recentMessages = await this.messageStore.listRecentMessages({
			conversationId: input.conversationId,
			limit: 20,
		});

		return [
			{ role: "system", content: MOAT_SYSTEM_PROMPT },
			...buildSafeClientContextMessages(input.clientContext),
			...recentMessages.map((m) => ({
				role: m.role,
				content: m.content,
			})),
		];
	}
}
