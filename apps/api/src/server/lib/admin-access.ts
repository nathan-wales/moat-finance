import { isAdminEmail } from "@moat/shared";
import type { PrismaClient } from "../../../generated/prisma";
import { createApiError } from "../api-context";
import { elevateToAdminDatabaseActor } from "../db-actor";

export {
	getAdminEmails,
	isAdminEmail,
	normalizeAdminEmail,
} from "@moat/shared";

export async function isAdminUserId(
	db: PrismaClient,
	userId: string,
): Promise<boolean> {
	const user = await db.user.findUnique({
		where: { id: userId },
		select: { email: true },
	});
	if (!user?.email) return false;
	return isAdminEmail(user.email);
}

/**
 * Verifies admin identity and then elevates the request's database actor.
 * Moderation queues and support tooling read rows belonging to other users,
 * which RLS denies under the default per-user actor — without elevation those
 * reads would come back empty instead of failing loudly.
 */
export async function requireAdminUser(
	db: PrismaClient,
	actorUserId: string,
): Promise<void> {
	if (!(await isAdminUserId(db, actorUserId))) {
		throw createApiError("Forbidden", 403);
	}
	await elevateToAdminDatabaseActor(actorUserId);
}
