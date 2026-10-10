import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { plaidInstitutionKey } from "./access-state";
import { liveDuplicateCollapseKey } from "./account-fingerprints";
import { disconnectItem } from "./disconnect-item";
import { loadLivePlaidItemsWithAccounts } from "./live-institution-accounts";

type DbClient = PrismaClient;

export async function collapseLiveDuplicatePlaidAccounts(
	dbClient: DbClient,
	userId: string,
	disconnect: typeof disconnectItem = disconnectItem,
): Promise<{ deactivatedAccountCount: number; disconnectedItemCount: number }> {
	const items = await loadLivePlaidItemsWithAccounts(dbClient, userId);
	if (items.length === 0) {
		return { deactivatedAccountCount: 0, disconnectedItemCount: 0 };
	}

	const byInstitution = new Map<string, typeof items>();
	for (const item of items) {
		const key = plaidInstitutionKey({
			institutionId: item.institutionId,
			institutionName: item.institutionName,
		});
		const group = byInstitution.get(key);
		if (group) group.push(item);
		else byInstitution.set(key, [item]);
	}

	const deactivateIds: string[] = [];

	for (const group of byInstitution.values()) {
		const activeAccounts = group.flatMap((item) =>
			item.plaidAccounts.filter((account) => account.isActive),
		);
		const buckets = new Map<string, typeof activeAccounts>();
		for (const account of activeAccounts) {
			const key = liveDuplicateCollapseKey(account);
			const bucket = buckets.get(key);
			if (bucket) bucket.push(account);
			else buckets.set(key, [account]);
		}

		for (const bucket of buckets.values()) {
			if (bucket.length < 2) continue;
			const ranked = [...bucket].sort(compareDuplicateRecency);
			const [, ...duplicates] = ranked;
			for (const duplicate of duplicates) {
				deactivateIds.push(duplicate.id);
			}
		}
	}

	if (deactivateIds.length > 0) {
		await dbClient.plaidAccount.updateMany({
			where: { id: { in: deactivateIds }, userId },
			data: {
				isActive: false,
				syncEnabled: false,
				accountHidden: true,
			},
		});
	}

	const remainingUniqueByItem = new Map<string, number>();
	for (const item of items) {
		const remaining = item.plaidAccounts.filter(
			(account) => !deactivateIds.includes(account.id),
		).length;
		remainingUniqueByItem.set(item.id, remaining);
	}

	let disconnectedItemCount = 0;
	for (const item of items) {
		if ((remainingUniqueByItem.get(item.id) ?? 0) > 0) continue;
		try {
			await disconnect(item.id, userId, dbClient);
			disconnectedItemCount += 1;
		} catch (error) {
			logger.logError(
				"Failed to disconnect empty duplicate Plaid item",
				error,
				{
					feature: "plaid",
					operation: "collapseLiveDuplicatePlaidAccounts",
					userId,
					itemId: item.id,
				},
			);
		}
	}

	if (deactivateIds.length > 0 || disconnectedItemCount > 0) {
		logger.info("Collapsed live duplicate Plaid accounts", {
			feature: "plaid",
			operation: "collapseLiveDuplicatePlaidAccounts",
			userId,
			deactivatedAccountCount: deactivateIds.length,
			disconnectedItemCount,
		});
	}

	return {
		deactivatedAccountCount: deactivateIds.length,
		disconnectedItemCount,
	};
}

export async function collapseLiveDuplicatePlaidAccountsSafely(
	dbClient: DbClient,
	userId: string,
	disconnect: typeof disconnectItem = disconnectItem,
): Promise<{ deactivatedAccountCount: number; disconnectedItemCount: number }> {
	try {
		return await collapseLiveDuplicatePlaidAccounts(
			dbClient,
			userId,
			disconnect,
		);
	} catch (error) {
		logger.logError("Failed to collapse live duplicate Plaid accounts", error, {
			feature: "plaid",
			operation: "collapseLiveDuplicatePlaidAccounts",
			userId,
		});
		return { deactivatedAccountCount: 0, disconnectedItemCount: 0 };
	}
}

function compareDuplicateRecency(
	left: { lastBalanceSyncAt: Date | null; createdAt: Date },
	right: { lastBalanceSyncAt: Date | null; createdAt: Date },
): number {
	const leftSync = left.lastBalanceSyncAt?.getTime() ?? 0;
	const rightSync = right.lastBalanceSyncAt?.getTime() ?? 0;
	if (leftSync !== rightSync) return rightSync - leftSync;
	return right.createdAt.getTime() - left.createdAt.getTime();
}
