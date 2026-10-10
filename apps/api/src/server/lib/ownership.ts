import { createApiError } from "~/server/api-context";
import type { PrismaClient } from "../../../generated/prisma";

type Db = Pick<
	PrismaClient,
	"hashtag" | "plaidAccount" | "transaction" | "transactionRule"
>;

/**
 * Ensures every hashtag ID belongs to `userId`. Throws 403 on mismatch so
 * possession of another tenant's ID cannot create cross-user relations.
 */
export async function assertOwnedHashtagIds(
	db: Db,
	userId: string,
	hashtagIds: Array<string | null | undefined>,
): Promise<void> {
	const uniqueIds = [
		...new Set(
			hashtagIds.filter(
				(id): id is string => typeof id === "string" && id.length > 0,
			),
		),
	];
	if (uniqueIds.length === 0) return;

	const count = await db.hashtag.count({
		where: { userId, id: { in: uniqueIds } },
	});
	if (count !== uniqueIds.length) {
		throw createApiError("Forbidden", 403);
	}
}

/**
 * Ensures an optional linked Plaid account belongs to `userId`.
 */
export async function assertOwnedPlaidAccountId(
	db: Db,
	userId: string,
	plaidAccountId: string | null | undefined,
): Promise<void> {
	if (!plaidAccountId) return;

	const account = await db.plaidAccount.findFirst({
		where: { id: plaidAccountId, userId },
		select: { id: true },
	});
	if (!account) {
		throw createApiError("Forbidden", 403);
	}
}

export async function assertOwnedTransactionId(
	db: Db,
	userId: string,
	transactionId: string,
): Promise<void> {
	const row = await db.transaction.findFirst({
		where: { id: transactionId, userId },
		select: { id: true },
	});
	if (!row) {
		throw createApiError("Forbidden", 403);
	}
}

export async function assertOwnedRuleId(
	db: Db,
	userId: string,
	ruleId: string,
): Promise<void> {
	const row = await db.transactionRule.findFirst({
		where: { id: ruleId, userId },
		select: { id: true },
	});
	if (!row) {
		throw createApiError("Forbidden", 403);
	}
}
