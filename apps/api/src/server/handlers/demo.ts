import { z } from "zod";
import {
	getUiState,
	hasUnsavedChanges,
	resetDemoOverlay,
	updateUiState,
} from "~/server/services/demo/demo-overlay.service";
import {
	deactivateDemoSession,
	findDemoSession,
	getOrCreateDemoSession,
} from "~/server/services/demo/demo-session.service";
import type { ApiContext } from "../api-context";
import { withPublic } from "../handler-wrappers";

export const demo = {
	enterDemoMode: withPublic(async (ctx: ApiContext) => {
		const sessionKey = crypto.randomUUID();
		const userId = ctx.session?.user?.id ?? null;
		const session = await getOrCreateDemoSession({ sessionKey, userId });
		return {
			success: true,
			sessionKey: session.sessionKey,
			expiresAt: session.expiresAt,
		};
	}),

	exitDemoMode: withPublic(async (_ctx: ApiContext, body: unknown) => {
		const input = z.object({ sessionKey: z.string() }).parse(body);
		await deactivateDemoSession(input.sessionKey);
		return { success: true };
	}),

	getDemoStatus: withPublic(async (ctx: ApiContext) => {
		if (!ctx.isDemoMode || !ctx.demoOverlaySessionKey) {
			return {
				isDemoMode: false,
				overlayExpiresAt: null,
				hasUnsavedDemoChanges: false,
				noticeDismissed: false,
			};
		}

		const session = await findDemoSession(ctx.demoOverlaySessionKey);
		if (!session) {
			return {
				isDemoMode: false,
				overlayExpiresAt: null,
				hasUnsavedDemoChanges: false,
				noticeDismissed: false,
			};
		}

		const unsaved = await hasUnsavedChanges(ctx.demoOverlaySessionKey);
		const uiState = await getUiState(ctx.demoOverlaySessionKey);

		return {
			isDemoMode: true,
			overlayExpiresAt: session.expiresAt,
			hasUnsavedDemoChanges: unsaved,
			noticeDismissed: uiState.noticeDismissed ?? false,
		};
	}),

	resetDemoOverlay: withPublic(async (_ctx: ApiContext, body: unknown) => {
		const input = z.object({ sessionKey: z.string() }).parse(body);
		await resetDemoOverlay(input.sessionKey);
		return { success: true };
	}),

	dismissDemoNotice: withPublic(async (_ctx: ApiContext, body: unknown) => {
		const input = z.object({ sessionKey: z.string() }).parse(body);
		await updateUiState(input.sessionKey, { noticeDismissed: true });
		return { success: true };
	}),
};
