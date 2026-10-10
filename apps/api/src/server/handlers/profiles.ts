import {
	CreateProfileInputSchema,
	UpdateProfileInputSchema,
} from "@moat/contracts";
import { z } from "zod";
import { createApiError } from "../api-context";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	createChildProfile,
	getAccessibleProfile,
	getProfileQuickSummary,
	listProfilesForActor,
	updateProfile,
} from "../services/profiles/profile.service";

const switchProfileInput = z.object({
	profileId: z.string().trim().min(1),
});

function assertCanCreateProfile(ctx: AuthenticatedContext) {
	if (ctx.isHouseholdMember) {
		throw createApiError("Only the account owner can create profiles", 403);
	}
}

export const profiles = {
	list: withAuth(async (ctx: AuthenticatedContext) => {
		const result = await listProfilesForActor(ctx.db, {
			actorUserId: ctx.actorUserId,
			activeProfileId: ctx.activeProfileId,
			isHouseholdMember: ctx.isHouseholdMember,
		});
		return result;
	}),

	summary: withAuth(async (ctx: AuthenticatedContext) => {
		const profileId = ctx.req.query.profileId;
		if (typeof profileId !== "string" || !profileId.trim()) {
			throw createApiError("profileId is required", 400);
		}

		const summary = await getProfileQuickSummary(ctx.db, {
			actorUserId: ctx.actorUserId,
			profileId: profileId.trim(),
			isHouseholdMember: ctx.isHouseholdMember,
		});
		return { summary };
	}),

	create: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		assertCanCreateProfile(ctx);
		const input = CreateProfileInputSchema.parse(body);
		const profile = await createChildProfile(ctx.db, {
			ownerUserId: ctx.actorUserId,
			kind: input.kind,
			displayName: input.displayName,
			businessType: input.businessType,
		});
		return { profile };
	}),

	switch: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = switchProfileInput.parse(body);
		const profile = await getAccessibleProfile(ctx.db, {
			actorUserId: ctx.actorUserId,
			profileId: input.profileId,
			isHouseholdMember: ctx.isHouseholdMember,
		});
		if (!profile) {
			throw createApiError("Profile not found", 404);
		}
		return { profile };
	}),

	update: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const input = UpdateProfileInputSchema.parse(body);
		const profile = await updateProfile(ctx.db, {
			actorUserId: ctx.actorUserId,
			profileId: input.id,
			isHouseholdMember: ctx.isHouseholdMember,
			displayName: input.displayName,
			includeInOwnerNetWorth: input.includeInOwnerNetWorth,
			businessType: input.businessType,
		});
		return { profile };
	}),
};
