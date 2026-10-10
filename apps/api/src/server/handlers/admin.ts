import { type AuthenticatedContext, withAuth } from "../handler-wrappers";
import { requireAdminUser } from "../lib/admin-access";
import { getAdminUserStats } from "../services/admin-user-stats.service";

export const admin = {
	getUserStats: withAuth(async (ctx: AuthenticatedContext) => {
		await requireAdminUser(ctx.db, ctx.actorUserId);
		return getAdminUserStats(ctx.db);
	}),
};
