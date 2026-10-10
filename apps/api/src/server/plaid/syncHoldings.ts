import { getPlaidClient } from "../lib/plaidClient";
import type { ProviderEndpointCall } from "../services/sync-types";
import { buildHoldingRowsByAccount, type HoldingRow } from "./holding-rows";
import { trackPlaidProviderCall } from "./provider-calls";
import type { PrismaClientLike } from "./types";

export async function syncHoldingsForItem(params: {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
	callLog?: ProviderEndpointCall[];
}): Promise<{ holdingCount: number; accountCount: number }> {
	const { db, userId, plaidItemDbId, accessToken, callLog } = params;
	const client = getPlaidClient();
	const now = new Date();

	const response = await trackPlaidProviderCall({
		endpoint: "/investments/holdings/get",
		costCategory: "unknown_contract_dependent",
		userId,
		plaidItemDbId,
		operation: "syncHoldings",
		callLog,
		fn: () => client.investmentsHoldingsGet({ access_token: accessToken }),
	});

	const holdings = response.data.holdings;
	const securities = new Map(
		response.data.securities.map((security) => [
			security.security_id,
			security,
		]),
	);

	const rowsByAccountId = buildHoldingRowsByAccount(holdings, securities);

	const disabledInvestmentAccounts = await db.plaidAccount.findMany({
		where: {
			userId,
			plaidItemId: plaidItemDbId,
			type: "investment",
			syncEnabled: false,
		},
		select: { id: true },
	});
	const syncedAccountDbIds: string[] = [];
	const keepHoldingAccountIds: string[] = disabledInvestmentAccounts.map(
		(account) => account.id,
	);
	for (const [plaidAccountId, rows] of rowsByAccountId) {
		const account = await db.plaidAccount.findFirst({
			where: {
				userId,
				plaidItemId: plaidItemDbId,
				plaidAccountId,
				type: "investment",
			},
			select: { id: true, syncEnabled: true },
		});
		if (!account) continue;
		keepHoldingAccountIds.push(account.id);
		if (account.syncEnabled === false) continue;

		await db.plaidAccount.update({
			where: { id: account.id },
			data: {
				currentBalance: rows.reduce((total, row) => total + row.value, 0),
				lastBalanceSyncAt: now,
				isActive: true,
			},
		});
		await replaceAccountHoldings({
			db,
			userId,
			plaidAccountDbId: account.id,
			rows,
			syncedAt: now,
		});
		syncedAccountDbIds.push(account.id);
	}

	// An account whose positions were all sold returns no holdings at all, so it
	// never appears in the loop above and must be cleared separately.
	await db.plaidHolding.deleteMany({
		where: {
			userId,
			plaidAccount: { plaidItemId: plaidItemDbId },
			plaidAccountId: { notIn: keepHoldingAccountIds },
		},
	});

	await db.plaidItem.update({
		where: { id: plaidItemDbId },
		data: { lastHoldingsSyncAt: now },
	});

	return {
		holdingCount: holdings.length,
		accountCount: syncedAccountDbIds.length,
	};
}

/**
 * Plaid returns the full current position set on every call, so the stored set is
 * replaced outright rather than merged — a sold-out position must disappear, and
 * rewriting is cheaper than diffing one upsert per security.
 */
async function replaceAccountHoldings(input: {
	db: PrismaClientLike;
	userId: string;
	plaidAccountDbId: string;
	rows: HoldingRow[];
	syncedAt: Date;
}): Promise<void> {
	const { db, userId, plaidAccountDbId, rows, syncedAt } = input;
	await db.plaidHolding.deleteMany({
		where: { plaidAccountId: plaidAccountDbId },
	});
	await db.plaidHolding.createMany({
		data: rows.map((row) => ({
			...row,
			userId,
			plaidAccountId: plaidAccountDbId,
			syncedAt,
		})),
	});
}
