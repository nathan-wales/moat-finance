import { getPlaidClient } from "../lib/plaidClient";
import type { ProviderEndpointCall } from "../services/sync-types";
import { trackPlaidProviderCall } from "./provider-calls";
import type { PrismaClientLike } from "./types";

export async function syncRealtimeBalancesForItem(params: {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
	callLog?: ProviderEndpointCall[];
}): Promise<{ accountCount: number }> {
	const { db, userId, plaidItemDbId, accessToken, callLog } = params;
	const client = getPlaidClient();
	const now = new Date();

	const response = await trackPlaidProviderCall({
		endpoint: "/accounts/balance/get",
		costCategory: "billable_per_request",
		userId,
		plaidItemDbId,
		operation: "syncRealtimeBalances",
		callLog,
		fn: () => client.accountsBalanceGet({ access_token: accessToken }),
	});

	const plaidAccounts = response.data.accounts;
	const returnedIds = new Set(
		plaidAccounts.map((account) => account.account_id),
	);

	for (const account of plaidAccounts) {
		await db.plaidAccount.updateMany({
			where: {
				userId,
				plaidItemId: plaidItemDbId,
				plaidAccountId: account.account_id,
				syncEnabled: true,
			},
			data: {
				currentBalance: account.balances.current ?? null,
				availableBalance: account.balances.available ?? null,
				currency: account.balances.iso_currency_code ?? "USD",
				lastBalanceSyncAt: now,
				isActive: true,
			},
		});
	}

	await db.plaidItem.update({
		where: { id: plaidItemDbId },
		data: {
			lastBalanceSyncAt: now,
			lastRealtimeBalanceSyncAt: now,
		},
	});

	await db.plaidAccount.updateMany({
		where: {
			plaidItemId: plaidItemDbId,
			userId,
			plaidAccountId: { notIn: Array.from(returnedIds) },
			isActive: true,
		},
		data: { isActive: false },
	});

	return { accountCount: plaidAccounts.length };
}
