import { requireDemoUserId } from "~/server/services/demo/demo-mode.service";
import {
	type ApiContext,
	createApiError,
	requireAuthenticated,
	requireDemoOrAuthenticated,
} from "./api-context";
import { resolveRequestIdentity } from "./context/resolve-active-context";
import {
	isDatabaseActorContextEnabled,
	serviceDatabaseActor,
	userDatabaseActor,
	withDatabaseActor,
} from "./db-actor";

/**
 * Context with guaranteed userId - used by auth-required handlers.
 * isDemoMode is always false.
 */
export type AuthenticatedContext = Omit<
	ApiContext,
	"actorUserId" | "effectiveUserId" | "isHouseholdMember" | "userId"
> & {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
	userId: string;
	isDemoMode: false;
};

/**
 * Context for demo-or-auth handlers - userId is always resolved (never null).
 * isDemoMode reflects whether the request is in demo mode.
 */
export type DemoOrAuthContext = Omit<
	ApiContext,
	"actorUserId" | "effectiveUserId" | "isHouseholdMember" | "userId"
> & {
	actorUserId: string;
	effectiveUserId: string;
	isHouseholdMember: boolean;
	userId: string;
	isDemoMode: boolean;
};

/**
 * Handler that requires real authentication (no demo mode).
 * userId is guaranteed to be a non-null string. isDemoMode is always false.
 */
export type AuthHandler<TInput = unknown, TOutput = unknown> = (
	ctx: AuthenticatedContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Handler that works in demo mode or with real auth.
 * userId is always resolved (demo user ID or session user ID).
 */
export type DemoOrAuthHandler<TInput = unknown, TOutput = unknown> = (
	ctx: DemoOrAuthContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Public handler (no auth required).
 */
export type PublicHandler<TInput = unknown, TOutput = unknown> = (
	ctx: ApiContext,
	input: TInput,
) => Promise<TOutput>;

/**
 * Routes that are allowed to proceed even when 2FA is pending.
 * These are the endpoints needed to complete or abandon the 2FA flow.
 */
const TWO_FACTOR_ALLOWLIST = new Set([
	"twoFactor.verify",
	"auth.signOut",
	"auth.revokeSession",
	"clientLog.ingest",
]);

/**
 * Check if 2FA is pending for a real-user (non-demo) request.
 * Throws 403 with TWO_FACTOR_REQUIRED if enforcement is needed.
 */
function enforceTwoFactor(ctx: ApiContext, handlerKey?: string): void {
	if (!ctx.requiresTwoFactor) return;
	if (handlerKey && TWO_FACTOR_ALLOWLIST.has(handlerKey)) return;
	throw createApiError(
		JSON.stringify({
			code: "TWO_FACTOR_REQUIRED",
			message: "Two-factor authentication is required.",
		}),
		403,
	);
}

/**
 * Wraps a handler that requires real authentication.
 * - Calls requireAuthenticated (throws 401 if not authenticated)
 * - Enforces 2FA completion when requiresTwoFactor is true (throws 403 TWO_FACTOR_REQUIRED)
 * - Guarantees userId is a string (not null)
 * - isDemoMode is always false
 *
 * Use this for handlers that mutate user data or require real identity.
 */
export function withAuth<TInput, TOutput>(
	handler: AuthHandler<TInput, TOutput>,
	handlerKey?: string,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return async (ctx: ApiContext, body: TInput) => {
		requireAuthenticated(ctx);
		enforceTwoFactor(ctx, handlerKey);

		const actorUserId = ctx.actorUserId ?? ctx.userId;
		if (!actorUserId) throw new Error("Unauthorized");

		if (!isDatabaseActorContextEnabled()) {
			const identity = await resolveRequestIdentity(ctx, actorUserId);
			const authCtx: AuthenticatedContext = {
				...ctx,
				actorUserId: identity.actorUserId,
				effectiveUserId: identity.effectiveUserId,
				isHouseholdMember: identity.isHouseholdMember,
				activeProfileId: identity.activeProfileId,
				userId: identity.effectiveUserId,
				isDemoMode: false,
			};
			return handler(authCtx, body);
		}

		return withDatabaseActor(serviceDatabaseActor(), async () => {
			const identity = await resolveRequestIdentity(ctx, actorUserId);
			const authCtx: AuthenticatedContext = {
				...ctx,
				actorUserId: identity.actorUserId,
				effectiveUserId: identity.effectiveUserId,
				isHouseholdMember: identity.isHouseholdMember,
				activeProfileId: identity.activeProfileId,
				userId: identity.effectiveUserId,
				isDemoMode: false,
			};

			return withDatabaseActor(
				userDatabaseActor({
					userId: authCtx.userId,
					actorUserId: authCtx.actorUserId,
				}),
				async (actorDb) => handler({ ...authCtx, db: actorDb }, body),
			);
		});
	};
}

/**
 * Wraps a handler that works in demo mode OR with real auth.
 * - Calls requireDemoOrAuthenticated (throws 401 if neither)
 * - Enforces 2FA completion for real-user requests when requiresTwoFactor is true
 * - Resolves userId from demo user or session
 * - Guarantees userId is a string (not null)
 *
 * Use this for read-heavy handlers that should work in demo mode.
 */
export function withDemoOrAuth<TInput, TOutput>(
	handler: DemoOrAuthHandler<TInput, TOutput>,
	handlerKey?: string,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return async (ctx: ApiContext, body: TInput) => {
		requireDemoOrAuthenticated(ctx);

		// 2FA enforcement applies to real users only, not demo mode
		if (!ctx.isDemoMode) {
			enforceTwoFactor(ctx, handlerKey);
		}

		if (!isDatabaseActorContextEnabled()) {
			const userId = ctx.isDemoMode ? await requireDemoUserId() : ctx.userId;
			if (!userId) throw new Error("Unauthorized");
			const identity = ctx.isDemoMode
				? {
						actorUserId: userId,
						effectiveUserId: userId,
						isHouseholdMember: false,
						activeProfileId: null as string | null,
						activeProfileKind: null,
					}
				: await resolveRequestIdentity(ctx, userId);
			const resolvedCtx: DemoOrAuthContext = {
				...ctx,
				actorUserId: identity.actorUserId,
				effectiveUserId: identity.effectiveUserId,
				isHouseholdMember: identity.isHouseholdMember,
				activeProfileId: identity.activeProfileId,
				userId: identity.effectiveUserId,
				isDemoMode: ctx.isDemoMode,
			};
			return handler(resolvedCtx, body);
		}

		return withDatabaseActor(serviceDatabaseActor(), async () => {
			const userId = ctx.isDemoMode ? await requireDemoUserId() : ctx.userId;
			if (!userId) throw new Error("Unauthorized");

			const identity = ctx.isDemoMode
				? {
						actorUserId: userId,
						effectiveUserId: userId,
						isHouseholdMember: false,
						activeProfileId: null as string | null,
						activeProfileKind: null,
					}
				: await resolveRequestIdentity(ctx, userId);

			const resolvedCtx: DemoOrAuthContext = {
				...ctx,
				actorUserId: identity.actorUserId,
				effectiveUserId: identity.effectiveUserId,
				isHouseholdMember: identity.isHouseholdMember,
				activeProfileId: identity.activeProfileId,
				userId: identity.effectiveUserId,
				isDemoMode: ctx.isDemoMode,
			};

			return withDatabaseActor(
				userDatabaseActor({
					userId: resolvedCtx.userId,
					actorUserId: resolvedCtx.actorUserId,
					isDemoMode: resolvedCtx.isDemoMode,
				}),
				async (actorDb) => handler({ ...resolvedCtx, db: actorDb }, body),
			);
		});
	};
}

/**
 * Wraps a public handler in a service database actor.
 *
 * Unauthenticated endpoints resolve opaque capability tokens — share slugs,
 * household invite tokens, vault recovery codes, the demo user lookup — which
 * are by definition lookups against rows the caller does not own. RLS cannot
 * scope them to a tenant, so authorization for these routes stays entirely in
 * the handler and the token itself. Keep this surface small.
 */
export function withPublic<TInput, TOutput>(
	handler: PublicHandler<TInput, TOutput>,
): (ctx: ApiContext, body: TInput) => Promise<TOutput> {
	return async (ctx: ApiContext, body: TInput) => {
		if (!isDatabaseActorContextEnabled()) {
			return handler(ctx, body);
		}

		return withDatabaseActor(serviceDatabaseActor(), async (actorDb) =>
			handler({ ...ctx, db: actorDb }, body),
		);
	};
}
