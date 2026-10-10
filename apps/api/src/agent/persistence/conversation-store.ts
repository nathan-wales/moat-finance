import type { db as Db } from "~/server/db";

export class ConversationStore {
	constructor(private readonly db: typeof Db) {}

	async createConversation(input: {
		userId: string;
		householdId?: string;
		title?: string;
	}) {
		return this.db.agentConversation.create({
			data: {
				userId: input.userId,
				householdId: input.householdId ?? null,
				title: input.title ?? null,
			},
		});
	}

	async getConversationForUser(input: {
		userId: string;
		conversationId: string;
	}) {
		return this.db.agentConversation.findFirst({
			where: { id: input.conversationId, userId: input.userId },
		});
	}

	async listConversations(input: { userId: string; limit?: number }) {
		return this.db.agentConversation.findMany({
			where: { userId: input.userId },
			orderBy: { updatedAt: "desc" },
			take: input.limit ?? 50,
		});
	}

	async touchConversation(input: { conversationId: string }) {
		await this.db.agentConversation.update({
			where: { id: input.conversationId },
			data: { updatedAt: new Date() },
		});
	}

	async renameConversation(input: {
		userId: string;
		conversationId: string;
		title: string;
	}) {
		const result = await this.db.agentConversation.updateMany({
			where: { id: input.conversationId, userId: input.userId },
			data: { title: input.title },
		});

		if (result.count === 0) return null;

		return this.getConversationForUser({
			userId: input.userId,
			conversationId: input.conversationId,
		});
	}
}
