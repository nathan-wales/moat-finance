import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { db } from "../db";
import { decrypt } from "../lib/encryption";
import { getPlaidClient } from "../lib/plaidClient";
import { takeSnapshot } from "../services/balance-snapshot.service";

type DbClient = PrismaClient;

/**
 * Leaf disconnect helper — intentionally avoids importing sync orchestrators
 * so revoke / entitlement paths cannot form a circular module graph.
 *
 * Stops Plaid billing (`itemRemove`) but keeps local identity rows so a later
 * re-link can adopt the same PlaidAccount ids and skip already-synced history.
 */
export async function disconnectItem(
	itemId: string,
	userId: string,
	dbClient: DbClient = db,
): Promise<void> {
	const item = await dbClient.plaidItem.findFirstOrThrow({
		where: { id: itemId, userId },
		select: {
			accessTokenEncrypted: true,
			plaidItemId: true,
			accessRevokedAt: true,
		},
	});

	if (item.accessTokenEncrypted) {
		try {
			const client = getPlaidClient();
			const accessToken = decrypt(item.accessTokenEncrypted);
			await client.itemRemove({ access_token: accessToken });
		} catch {
			// Non-fatal — still clear local tokens/connection so Moat cannot keep calling Plaid.
		}
	}

	const revokedAt = item.accessRevokedAt ?? new Date();

	await dbClient.plaidAccount.updateMany({
		where: { plaidItemId: itemId, userId },
		data: { isActive: false },
	});

	await dbClient.plaidItem.update({
		where: { id: itemId },
		data: {
			accessTokenEncrypted: null,
			cursor: null,
			accessRevokedAt: revokedAt,
		},
	});

	const connections = await dbClient.financialConnection.findMany({
		where: {
			userId,
			provider: "PLAID",
			OR: [
				{ providerConnectionId: item.plaidItemId },
				{ metadata: { path: ["legacyPlaidItemDbId"], equals: itemId } },
			],
		},
		select: { id: true },
	});
	const connectionIds = connections.map((connection) => connection.id);
	if (connectionIds.length > 0) {
		await dbClient.financialConnection.updateMany({
			where: { id: { in: connectionIds } },
			data: {
				status: "DISCONNECTED",
				providerAccessTokenEncrypted: null,
				providerRefreshTokenEncrypted: null,
				syncCursorEncrypted: null,
			},
		});
		await dbClient.financialAccount.updateMany({
			where: { connectionId: { in: connectionIds }, userId },
			data: { isActive: false },
		});
		await dbClient.providerSyncJob.updateMany({
			where: {
				connectionId: { in: connectionIds },
				status: { in: ["PENDING", "RUNNING"] },
			},
			data: {
				status: "CANCELLED",
				completedAt: new Date(),
				errorMessage: "Provider access revoked",
			},
		});
	}

	try {
		await takeSnapshot(userId, dbClient);
	} catch (err) {
		logger.logError("Snapshot failed after disconnect", err, {
			feature: "plaid",
			operation: "disconnectItem",
			userId,
			itemId,
		});
	}
}
