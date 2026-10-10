import { logger } from "~/lib/logger";
import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import {
	completeSetupGuideStep,
	dismissSetupGuide,
	getSetupGuideState,
} from "../services/setup-guide.service";

export const setupGuide = {
	get: withAuth(async (ctx: AuthenticatedContext) => {
		return getSetupGuideState(ctx.db, ctx.userId);
	}),

	completeStep: withAuth(async (ctx: AuthenticatedContext, body: unknown) => {
		const state = await completeSetupGuideStep(ctx.db, ctx.userId, body);
		logger.info("Setup guide step completed", {
			feature: "setupGuide",
			operation: "completeStep",
			userId: ctx.userId,
		});
		return state;
	}),

	dismiss: withAuth(async (ctx: AuthenticatedContext) => {
		const state = await dismissSetupGuide(ctx.db, ctx.userId);
		logger.info("Setup guide dismissed", {
			feature: "setupGuide",
			operation: "dismiss",
			userId: ctx.userId,
		});
		return state;
	}),
};
