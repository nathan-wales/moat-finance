import { z } from "zod";
import { ConversationTitleService } from "../../agent/conversation-title-service";
import { ConversationStore } from "../../agent/persistence/conversation-store";
import { MessageStore } from "../../agent/persistence/message-store";
import { TimelineStore } from "../../agent/timeline/timeline-store";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";

const limitInput = z.preprocess(
	(value) => (value === undefined ? undefined : Number(value)),
	z.number().int().min(1).max(200).optional(),
);

const listConversationsInput = z.object({
	limit: limitInput,
});

const createConversationInput = z.object({
	title: z.string().min(1).max(200).optional(),
});

const conversationTitleInput = z.object({
	conversationId: z.string().min(1),
	firstMessage: z.string().min(1).max(20_000),
});

const renameConversationInput = z.object({
	conversationId: z.string().min(1),
	title: z.string().min(1).max(120),
});

const listMessagesInput = z.object({
	conversationId: z.string().min(1),
	limit: limitInput,
});

const listTimelineInput = z.object({
	conversationId: z.string().min(1),
	limit: limitInput,
});

export const agent = {
	listConversations: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const { limit } = listConversationsInput.parse(body ?? {});
			const store = new ConversationStore(ctx.db);
			const rows = await store.listConversations({
				userId: ctx.userId,
				limit,
			});
			return {
				conversations: rows.map((r) => ({
					id: r.id,
					title: r.title,
					householdId: r.householdId,
					createdAt: r.createdAt.toISOString(),
					updatedAt: r.updatedAt.toISOString(),
				})),
			};
		},
	),

	createConversation: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const input = createConversationInput.parse(body ?? {});
			const store = new ConversationStore(ctx.db);
			const conv = await store.createConversation({
				userId: ctx.userId,
				title: input.title,
			});
			return {
				conversation: {
					id: conv.id,
					title: conv.title,
					householdId: conv.householdId,
					createdAt: conv.createdAt.toISOString(),
					updatedAt: conv.updatedAt.toISOString(),
				},
			};
		},
	),

	nameConversation: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = conversationTitleInput.parse(body ?? {});
			const conversationTitleService = new ConversationTitleService();
			const title = conversationTitleService.createTitleFromFirstMessage(
				input.firstMessage,
			);
			const store = new ConversationStore(ctx.db);
			const conv = await store.renameConversation({
				userId: ctx.userId,
				conversationId: input.conversationId,
				title,
			});
			if (!conv) {
				const err = new Error("Conversation not found") as Error & {
					status: number;
				};
				err.status = 404;
				throw err;
			}
			return {
				conversation: {
					id: conv.id,
					title: conv.title,
					householdId: conv.householdId,
					createdAt: conv.createdAt.toISOString(),
					updatedAt: conv.updatedAt.toISOString(),
				},
			};
		},
	),

	renameConversation: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = renameConversationInput.parse(body ?? {});
			const conversationTitleService = new ConversationTitleService();
			const title = conversationTitleService.normalizeManualTitle(input.title);
			if (!title) {
				const err = new Error("Title is required") as Error & {
					status: number;
				};
				err.status = 400;
				throw err;
			}
			const store = new ConversationStore(ctx.db);
			const conv = await store.renameConversation({
				userId: ctx.userId,
				conversationId: input.conversationId,
				title,
			});
			if (!conv) {
				const err = new Error("Conversation not found") as Error & {
					status: number;
				};
				err.status = 404;
				throw err;
			}
			return {
				conversation: {
					id: conv.id,
					title: conv.title,
					householdId: conv.householdId,
					createdAt: conv.createdAt.toISOString(),
					updatedAt: conv.updatedAt.toISOString(),
				},
			};
		},
	),

	listMessages: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = listMessagesInput.parse(body ?? {});
		const conversationStore = new ConversationStore(ctx.db);
		const conv = await conversationStore.getConversationForUser({
			userId: ctx.userId,
			conversationId: input.conversationId,
		});
		if (!conv) {
			const err = new Error("Conversation not found") as Error & {
				status: number;
			};
			err.status = 404;
			throw err;
		}
		const messageStore = new MessageStore(ctx.db);
		const rows = await messageStore.listRecentMessages({
			conversationId: conv.id,
			limit: input.limit ?? 100,
		});
		return {
			messages: rows.map((m) => ({
				id: m.id,
				role: m.role,
				content: m.content,
				createdAt: m.createdAt.toISOString(),
			})),
		};
	}),

	listTimeline: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = listTimelineInput.parse(body ?? {});
			const conversationStore = new ConversationStore(ctx.db);
			const conv = await conversationStore.getConversationForUser({
				userId: ctx.userId,
				conversationId: input.conversationId,
			});
			if (!conv) {
				const err = new Error("Conversation not found") as Error & {
					status: number;
				};
				err.status = 404;
				throw err;
			}
			const timelineStore = new TimelineStore(ctx.db);
			return {
				blocks: await timelineStore.listConversationTimeline({
					conversationId: conv.id,
					limit: input.limit ?? 200,
				}),
			};
		},
	),
};
