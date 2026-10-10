import { db } from "../../db";
import { requireDemoUserId } from "./demo-mode.service";

const SESSION_TTL_DAYS = 7;

/**
 * Finds an existing active demo overlay session by session key.
 */
export async function findDemoSession(sessionKey: string) {
	return db.demoOverlaySession.findFirst({
		where: {
			sessionKey,
			isActive: true,
			expiresAt: { gt: new Date() },
		},
	});
}

/**
 * Creates a new demo overlay session or returns an existing one.
 * Associates with the real user if authenticated.
 */
export async function getOrCreateDemoSession({
	sessionKey,
	userId,
}: {
	sessionKey: string;
	userId?: string | null;
}) {
	const existing = await findDemoSession(sessionKey);
	if (existing) return existing;

	const demoUserId = await requireDemoUserId();
	const expiresAt = new Date();
	expiresAt.setDate(expiresAt.getDate() + SESSION_TTL_DAYS);

	return db.demoOverlaySession.create({
		data: {
			sessionKey,
			userId: userId ?? null,
			demoUserId,
			isActive: true,
			expiresAt,
		},
	});
}

/**
 * Deactivates a demo overlay session (exit demo mode cleanup).
 */
export async function deactivateDemoSession(sessionKey: string) {
	await db.demoOverlaySession.updateMany({
		where: { sessionKey },
		data: { isActive: false },
	});
}

/**
 * Deletes all expired demo overlay sessions.
 */
export async function cleanupExpiredDemoSessions() {
	const result = await db.demoOverlaySession.deleteMany({
		where: { expiresAt: { lt: new Date() } },
	});
	return result.count;
}
