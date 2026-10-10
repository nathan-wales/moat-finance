import type { SqliteDbClient } from "@moat/db-sqlite";
import { remoteLogger } from "../lib/remote-logger";
import { isPlaidItemAccessLive, plaidInstitutionKey } from "./access-state";
import { liveDuplicateCollapseKey } from "./account-fingerprints";

type LiveItem = {
	id: string;
	institutionId: string | null;
	institutionName: string;
	accessRevokedAt: Date | null;
	accessTokenEncrypted: Buffer | null;
	accounts: Array<{
		id: string;
		name: string;
		mask: string | null;
		type: string;
		subtype: string | null;
		lastBalanceSyncAt: Date | null;
		createdAt: Date;
		isActive: boolean;
	}>;
};

export async function collapseLiveDuplicatePlaidAccounts(params: {
	db: SqliteDbClient;
	userId: string;
	disconnectItem: (itemId: string) => Promise<void>;
}): Promise<{
	deactivatedAccountCount: number;
	disconnectedItemCount: number;
}> {
	const items = (await params.db.plaidItem.findMany({
		where: {
			userId: params.userId,
			accessRevokedAt: null,
			accessTokenEncrypted: { not: null },
		},
		select: {
			id: true,
			institutionId: true,
			institutionName: true,
			accessRevokedAt: true,
			accessTokenEncrypted: true,
			accounts: {
				select: {
					id: true,
					name: true,
					mask: true,
					type: true,
					subtype: true,
					lastBalanceSyncAt: true,
					createdAt: true,
					isActive: true,
				},
			},
		},
	})) as LiveItem[];

	const liveItems = items.filter(isPlaidItemAccessLive);
	const byInstitution = new Map<string, LiveItem[]>();
	for (const item of liveItems) {
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
			item.accounts.filter((account) => account.isActive),
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
		await params.db.plaidAccount.updateMany({
			where: { id: { in: deactivateIds } },
			data: {
				isActive: false,
				syncEnabled: false,
				isHidden: true,
			},
		});
	}

	let disconnectedItemCount = 0;
	for (const item of liveItems) {
		const remainingUnique = item.accounts.filter(
			(account) => !deactivateIds.includes(account.id),
		).length;
		if (remainingUnique > 0) continue;
		try {
			await params.disconnectItem(item.id);
			disconnectedItemCount += 1;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "unknown";
			remoteLogger.error("Failed to disconnect empty duplicate Plaid item", {
				event: "plaid.collapse_disconnect_failed",
				feature: "plaid",
				operation: "collapseLiveDuplicatePlaidAccounts",
				metadata: { itemId: item.id, errorMessage },
			});
		}
	}

	if (deactivateIds.length > 0 || disconnectedItemCount > 0) {
		remoteLogger.info("Collapsed live duplicate Plaid accounts", {
			event: "plaid.collapse_live_duplicates",
			feature: "plaid",
			operation: "collapseLiveDuplicatePlaidAccounts",
			metadata: {
				deactivatedAccountCount: deactivateIds.length,
				disconnectedItemCount,
			},
		});
	}

	return {
		deactivatedAccountCount: deactivateIds.length,
		disconnectedItemCount,
	};
}

export async function collapseLiveDuplicatePlaidAccountsSafely(params: {
	db: SqliteDbClient;
	userId: string;
	disconnectItem: (itemId: string) => Promise<void>;
}): Promise<{
	deactivatedAccountCount: number;
	disconnectedItemCount: number;
}> {
	try {
		return await collapseLiveDuplicatePlaidAccounts(params);
	} catch (error) {
		const errorMessage = error instanceof Error ? error.message : "unknown";
		remoteLogger.error("Failed to collapse live duplicate Plaid accounts", {
			event: "plaid.collapse_live_duplicates_failed",
			feature: "plaid",
			operation: "collapseLiveDuplicatePlaidAccounts",
			metadata: { errorMessage },
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
