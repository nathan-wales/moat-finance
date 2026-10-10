import type { McpAuthContext } from "~/auth/types";

export type AccountSyncCoverage = {
	asOf: string;
	accountCount: number;
	accountsRequiringReconnect: number;
	staleAccountCount: number;
	oldestSuccessfulSyncAt: string | null;
	newestSuccessfulSyncAt: string | null;
	limitations: string[];
	isComplete: boolean;
};

const STALE_SYNC_MS = 7 * 24 * 60 * 60 * 1000;

export async function getAccountSyncCoverage(
	context: McpAuthContext,
): Promise<AccountSyncCoverage> {
	const accounts = await context.db.plaidAccount.findMany({
		where: { userId: context.userId, isActive: true, accountHidden: false },
		select: {
			id: true,
			plaidItem: {
				select: {
					requiresReconnect: true,
					lastSuccessfulSyncAt: true,
				},
			},
		},
	});

	const now = Date.now();
	const syncTimes = accounts
		.map((account) => account.plaidItem.lastSuccessfulSyncAt?.getTime())
		.filter((value): value is number => typeof value === "number");
	const accountsRequiringReconnect = accounts.filter(
		(account) => account.plaidItem.requiresReconnect,
	).length;
	const staleAccountCount = accounts.filter((account) => {
		const syncedAt = account.plaidItem.lastSuccessfulSyncAt?.getTime();
		if (!syncedAt) return true;
		return now - syncedAt > STALE_SYNC_MS;
	}).length;

	const limitations: string[] = [];
	if (accounts.length === 0) {
		limitations.push("No active connected accounts were found.");
	}
	if (accountsRequiringReconnect > 0) {
		limitations.push(
			`${accountsRequiringReconnect} institution connection(s) require reconnect; totals may be incomplete.`,
		);
	}
	if (staleAccountCount > 0) {
		limitations.push(
			`${staleAccountCount} account(s) have stale or missing sync timestamps; treat totals as provisional.`,
		);
	}

	const oldest =
		syncTimes.length > 0
			? new Date(Math.min(...syncTimes)).toISOString()
			: null;
	const newest =
		syncTimes.length > 0
			? new Date(Math.max(...syncTimes)).toISOString()
			: null;

	return {
		asOf: new Date().toISOString(),
		accountCount: accounts.length,
		accountsRequiringReconnect,
		staleAccountCount,
		oldestSuccessfulSyncAt: oldest,
		newestSuccessfulSyncAt: newest,
		limitations,
		isComplete: limitations.length === 0 && accounts.length > 0,
	};
}

export function isTransferCategory(
	category: string | null | undefined,
): boolean {
	if (!category) return false;
	return category.trim().toLowerCase() === "transfer";
}
