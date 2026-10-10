import { describeSessionJwtCandidate } from "@moat/shared";
import { logger } from "~/lib/logger";
import type { db as dbClient } from "../db";
import { normalizeEmail } from "./normalize-email";
import {
	type DecodedSessionJwt,
	getSessionEmailFromDecodedJwt,
	getSessionUserIdFromDecodedJwt,
} from "./session-jwt";

type Db = typeof dbClient;

/**
 * Map a NextAuth session JWT to a real User.id.
 *
 * Google OAuth sessions can store the provider subject in `id`/`sub` instead of
 * the database user id. Prefer a direct User lookup, then repair via email or
 * Account.providerAccountId so FK writes (e.g. MCP OAuth consent) succeed.
 */
export async function resolveSessionUserId(
	db: Db,
	decoded: DecodedSessionJwt | null | undefined,
): Promise<string | null> {
	const candidateId = getSessionUserIdFromDecodedJwt(decoded);
	if (!candidateId) return null;

	const identity = describeSessionJwtCandidate(decoded);

	const userById = await db.user.findUnique({
		where: { id: candidateId },
		select: { id: true },
	});
	if (userById) return userById.id;

	const email = getSessionEmailFromDecodedJwt(decoded);
	if (email) {
		const normalizedEmail = normalizeEmail(email);
		const userByEmail = await db.user.findUnique({
			where: { email: normalizedEmail },
			select: { id: true },
		});
		if (userByEmail) {
			logger.warn("Resolved session user via JWT email fallback", {
				feature: "auth",
				operation: "resolveSessionUserId",
				via: "email",
				userId: userByEmail.id,
				...identity,
			});
			return userByEmail.id;
		}
	}

	const account = await db.account.findFirst({
		where: { providerAccountId: candidateId },
		select: { userId: true },
	});
	if (account) {
		logger.warn("Resolved session user via OAuth account fallback", {
			feature: "auth",
			operation: "resolveSessionUserId",
			via: "providerAccountId",
			userId: account.userId,
			...identity,
		});
		return account.userId;
	}

	logger.warn("Session JWT identity does not match any user", {
		feature: "auth",
		operation: "resolveSessionUserId",
		...identity,
	});
	return null;
}
