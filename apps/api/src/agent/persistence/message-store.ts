import type { db as Db } from "~/server/db";
import { AgentMessageRole } from "../../../generated/prisma";

export type StoredMessageRole = "user" | "assistant" | "system" | "tool";

function toPrismaRole(role: StoredMessageRole): AgentMessageRole {
	switch (role) {
		case "user":
			return AgentMessageRole.user;
		case "assistant":
			return AgentMessageRole.assistant;
		case "system":
			return AgentMessageRole.system;
		case "tool":
			return AgentMessageRole.tool;
	}
}

function fromPrismaRole(role: AgentMessageRole): StoredMessageRole {
	return role as StoredMessageRole;
}

export class MessageStore {
	constructor(private readonly db: typeof Db) {}

	async createMessage(input: {
		conversationId: string;
		role: StoredMessageRole;
		content: string;
		metadata?: unknown;
	}) {
		return this.db.agentMessage.create({
			data: {
				conversationId: input.conversationId,
				role: toPrismaRole(input.role),
				content: input.content,
				metadata: (input.metadata ?? undefined) as object | undefined,
			},
		});
	}

	async listRecentMessages(input: {
		conversationId: string;
		limit?: number;
	}): Promise<
		Array<{
			id: string;
			role: StoredMessageRole;
			content: string;
			createdAt: Date;
		}>
	> {
		const limit = input.limit ?? 20;
		const rows = await this.db.agentMessage.findMany({
			where: { conversationId: input.conversationId },
			orderBy: { createdAt: "desc" },
			take: limit,
		});
		return rows.reverse().map((row) => ({
			id: row.id,
			role: fromPrismaRole(row.role),
			content: row.content,
			createdAt: row.createdAt,
		}));
	}
}
