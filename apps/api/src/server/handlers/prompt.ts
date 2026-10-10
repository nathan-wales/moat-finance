import { z } from "zod";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { requireAdminUser } from "../lib/admin-access";
import * as promptService from "../services/prompt.service";
import { PromptError } from "../services/prompt.service";

const createInput = z.object({
	title: z.string().min(1).max(120),
	description: z.string().max(500).optional().nullable(),
	body: z.string().min(1).max(10_000),
	categorySlug: z.string().min(1).nullable(),
	tags: z.array(z.string().max(32)).max(10).optional(),
	requiredConnections: z.array(z.string()).optional(),
	requiredDataScopes: z.array(z.string()).optional(),
	submitForReview: z.boolean().optional(),
});

const updateInput = z.object({
	promptId: z.string().min(1),
	title: z.string().min(1).max(120).optional(),
	description: z.string().max(500).optional().nullable(),
	body: z.string().min(1).max(10_000).optional(),
	categorySlug: z.string().min(1).nullable().optional(),
	tags: z.array(z.string().max(32)).max(10).optional(),
	requiredConnections: z.array(z.string()).optional(),
	requiredDataScopes: z.array(z.string()).optional(),
	confirmWithdrawFromReview: z.boolean().optional(),
});

const promptIdInput = z.object({ promptId: z.string().min(1) });

const listPinsInput = z.object({
	source: z.enum(["CURATED", "MINE", "COMMUNITY"]).optional(),
});

const listLaunchCountsInput = z.object({
	source: z.enum(["CURATED", "MINE", "COMMUNITY"]).optional(),
});

const togglePinInput = z.object({
	source: z.enum(["CURATED", "MINE", "COMMUNITY"]),
	promptId: z.string().min(1),
});

const recordLaunchInput = z.object({
	source: z.enum(["CURATED", "MINE", "COMMUNITY"]),
	promptId: z.string().min(1),
});

const revisionInput = z.object({
	promptId: z.string().min(1),
	revisionId: z.string().min(1),
});

const generateDraftInput = z.object({
	goal: z.string().min(1).max(500),
	financialData: z.string().max(500).optional(),
	responseInclude: z.string().max(500).optional(),
	workflowType: z.string().max(200).optional(),
	allowActions: z.boolean().optional(),
	additionalConstraints: z.string().max(500).optional(),
});

const moderationFilterInput = z.object({
	filter: z
		.enum(["PENDING", "CHANGES_REQUESTED", "APPROVED", "REJECTED", "ALL"])
		.optional(),
});

const feedbackInput = revisionInput.extend({
	feedback: z.string().min(1).max(2000),
});

const rejectInput = revisionInput.extend({
	reason: z.string().min(1).max(2000),
});

const unpublishInput = z.object({
	promptId: z.string().min(1),
	reason: z.string().min(1).max(2000),
});

function handlePromptError(error: unknown): never {
	if (error instanceof PromptError) {
		throw Object.assign(new Error(error.message), {
			statusCode: error.statusCode,
		});
	}
	throw error;
}

async function requireAdmin(ctx: AuthenticatedContext): Promise<void> {
	await requireAdminUser(ctx.db, ctx.actorUserId);
}

async function callService<T>(fn: () => Promise<T>): Promise<T> {
	try {
		return await fn();
	} catch (error) {
		handlePromptError(error);
	}
}

export const prompt = {
	listCategories: withDemoOrAuth(async () => {
		return callService(() => promptService.listCategories());
	}),

	listMine: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return callService(() => promptService.listMyPrompts(ctx.userId));
	}),

	listPins: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { source } = listPinsInput.parse(body ?? {});
		return callService(() => promptService.listPromptPins(ctx.userId, source));
	}),

	togglePin: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = togglePinInput.parse(body);
		return callService(() => promptService.togglePromptPin(ctx.userId, input));
	}),

	listLaunchCounts: withDemoOrAuth(
		async (_ctx: DemoOrAuthContext, body: unknown) => {
			const { source } = listLaunchCountsInput.parse(body ?? {});
			return callService(() => promptService.listPromptLaunchCounts(source));
		},
	),

	recordLaunch: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = recordLaunchInput.parse(body);
			return callService(() =>
				promptService.recordPromptLaunch(ctx.userId, input),
			);
		},
	),

	get: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { promptId } = promptIdInput.parse(body);
		return callService(() => promptService.getPrompt(ctx.userId, promptId));
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = createInput.parse(body);
		return callService(() => promptService.createPrompt(ctx.userId, input));
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = updateInput.parse(body);
		return callService(() => promptService.updatePrompt(ctx.userId, input));
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { promptId } = promptIdInput.parse(body);
		await callService(() => promptService.deletePrompt(ctx.userId, promptId));
		return { success: true };
	}),

	generateDraft: withAuth(async (_ctx: AuthenticatedContext, body: unknown) => {
		const input = generateDraftInput.parse(body);
		return callService(() => promptService.generateDraft(input));
	}),

	submit: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { promptId } = promptIdInput.parse(body);
		return callService(() => promptService.submitPrompt(ctx.userId, promptId));
	}),

	withdraw: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { promptId } = promptIdInput.parse(body);
		return callService(() =>
			promptService.withdrawPrompt(ctx.userId, promptId),
		);
	}),

	listCommunity: withDemoOrAuth(async () => {
		return callService(() => promptService.listCommunityPrompts());
	}),

	getCommunity: withDemoOrAuth(
		async (_ctx: DemoOrAuthContext, body: unknown) => {
			const { promptId } = promptIdInput.parse(body);
			return callService(() => promptService.getCommunityPrompt(promptId));
		},
	),

	saveToLibrary: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { promptId } = promptIdInput.parse(body);
		return callService(() =>
			promptService.saveCommunityPromptToLibrary(ctx.userId, promptId),
		);
	}),

	hasAiConnection: withAuth(async (ctx: AuthenticatedContext) => {
		const connected = await promptService.hasAiConnection(ctx.actorUserId);
		return { connected };
	}),

	listModeration: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { filter } = moderationFilterInput.parse(body ?? {});
		return callService(() =>
			promptService.listModerationQueue(filter ?? "PENDING"),
		);
	}),

	approve: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { promptId, revisionId } = revisionInput.parse(body);
		return callService(() =>
			promptService.approvePrompt(ctx.actorUserId, promptId, revisionId),
		);
	}),

	requestChanges: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { promptId, revisionId, feedback } = feedbackInput.parse(body);
		return callService(() =>
			promptService.requestPromptChanges(
				ctx.actorUserId,
				promptId,
				revisionId,
				feedback,
			),
		);
	}),

	reject: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { promptId, revisionId, reason } = rejectInput.parse(body);
		return callService(() =>
			promptService.rejectPrompt(ctx.actorUserId, promptId, revisionId, reason),
		);
	}),

	unpublish: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { promptId, reason } = unpublishInput.parse(body);
		return callService(() =>
			promptService.unpublishPrompt(ctx.actorUserId, promptId, reason),
		);
	}),

	getModerationHistory: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { promptId } = promptIdInput.parse(body);
			const owned = await promptService
				.getPrompt(ctx.userId, promptId)
				.catch(() => null);
			if (!owned) {
				await requireAdmin(ctx);
			}
			return callService(() => promptService.getModerationHistory(promptId));
		},
	),
};
