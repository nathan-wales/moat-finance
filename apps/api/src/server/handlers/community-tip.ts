import {
	adminDecisionInputSchema,
	adminModerationFilterSchema,
	adminRequestChangesInputSchema,
	adminUpdateMetadataInputSchema,
	communityTipIdInputSchema,
	communityTipSettingsInputSchema,
	createCommunityTipInputSchema,
	listCommunityTipsInputSchema,
	listForTransactionInputSchema,
	updateCommunityTipInputSchema,
} from "@moat/community-tips";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { requireAdminUser } from "../lib/admin-access";
import * as communityTipService from "../services/community-tip.service";

async function requireAdmin(ctx: AuthenticatedContext): Promise<void> {
	await requireAdminUser(ctx.db, ctx.actorUserId);
}

export const communityTip = {
	list: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = listCommunityTipsInputSchema.parse(body ?? {});
		return communityTipService.listCommunityTips(ctx.userId, input);
	}),

	listMine: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return communityTipService.listMyCommunityTips(ctx.userId);
	}),

	get: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.getCommunityTip(ctx.userId, tipId);
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = createCommunityTipInputSchema.parse(body);
		return communityTipService.createCommunityTip(ctx.userId, input);
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = updateCommunityTipInputSchema.parse(body);
		return communityTipService.updateCommunityTip(ctx.userId, input);
	}),

	delete: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { tipId } = communityTipIdInputSchema.parse(body);
		await communityTipService.deleteCommunityTip(ctx.userId, tipId);
		return { success: true };
	}),

	like: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.likeCommunityTip(ctx.userId, tipId);
	}),

	unlike: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.unlikeCommunityTip(ctx.userId, tipId);
	}),

	listForTransaction: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown) => {
			const input = listForTransactionInputSchema.parse(body);
			return communityTipService.listTipsForTransaction(
				ctx.userId,
				input.transactionId,
				input.limit,
			);
		},
	),

	getSettings: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		return communityTipService.getCommunityTipSettings(ctx.userId);
	}),

	setSettings: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = communityTipSettingsInputSchema.parse(body);
		return communityTipService.setCommunityTipSettings(
			ctx.userId,
			input.showCommunityTipsOnTransactions,
		);
	}),

	listModeration: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const input = adminModerationFilterSchema.parse(body ?? {});
		return communityTipService.listAdminCommunityTips(input);
	}),

	getModeration: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.getAdminCommunityTip(tipId);
	}),

	approve: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId } = adminDecisionInputSchema.parse(body);
		return communityTipService.approveCommunityTip(ctx.actorUserId, tipId);
	}),

	reject: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId, reason } = adminDecisionInputSchema.parse(body);
		return communityTipService.rejectCommunityTip(
			ctx.actorUserId,
			tipId,
			reason,
		);
	}),

	requestChanges: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId, reason } = adminRequestChangesInputSchema.parse(body);
		return communityTipService.requestCommunityTipChanges(
			ctx.actorUserId,
			tipId,
			reason,
		);
	}),

	archive: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.archiveCommunityTip(ctx.actorUserId, tipId);
	}),

	expire: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId } = communityTipIdInputSchema.parse(body);
		return communityTipService.expireCommunityTip(ctx.actorUserId, tipId);
	}),

	updateMetadata: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		await requireAdmin(ctx);
		const { tipId, metadata } = adminUpdateMetadataInputSchema.parse(body);
		return communityTipService.updateCommunityTipMetadata(
			ctx.actorUserId,
			tipId,
			metadata,
		);
	}),
};
