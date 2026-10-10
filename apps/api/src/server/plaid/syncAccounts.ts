/**
 * Dedicated Plaid account synchronization.
 *
 * The accounts endpoint is the authoritative source for account metadata.
 * Account sync must NOT depend on the transactions/sync response shape.
 *
 * Server-side only — never import from client code.
 */

import type { AccountBase } from "plaid";
import { logger } from "~/lib/logger";
import { getPlaidClient } from "../lib/plaidClient";
import type { ProviderEndpointCall } from "../services/sync-types";
import { loadLiveInstitutionAccounts } from "./live-institution-accounts";
import { matchLiveAccounts } from "./match-live-accounts";
import { trackPlaidProviderCall } from "./provider-calls";
import type { PrismaClientLike } from "./types";

export type SyncedPlaidAccount = {
	id: string;
	name: string;
	officialName: string | null;
	mask: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
};

/**
 * Reads the authoritative account list for an Item. `/accounts/get` carries no
 * per-request fee, but callers that need the list before syncing should pass it
 * back into `syncAccountsForItem` rather than fetching twice.
 */
export async function fetchPlaidAccountsForItem(params: {
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
	callLog?: ProviderEndpointCall[];
}): Promise<AccountBase[]> {
	const client = getPlaidClient();
	const response = await trackPlaidProviderCall({
		endpoint: "/accounts/get",
		costCategory: "cached_or_included",
		userId: params.userId,
		plaidItemDbId: params.plaidItemDbId,
		operation: "syncAccounts",
		callLog: params.callLog,
		fn: () => client.accountsGet({ access_token: params.accessToken }),
	});
	return response.data.accounts;
}

/**
 * Syncs Plaid accounts for a single PlaidItem.
 *
 * Returns a Map of: Plaid account_id → local PlaidAccount.id
 * This map is used by syncTransactions to set plaidAccountId on transaction rows.
 *
 * Behavior:
 *   - Upserts each returned account by plaidAccountId (stable Plaid identifier)
 *   - Refreshes name, officialName, mask, type, subtype, balances, currency
 *   - Sets isActive=true for all returned accounts
 *   - Leaves syncEnabled unchanged; disabled accounts stay out of the return map
 *   - Sets isActive=false for accounts no longer returned (soft-deactivate only)
 *   - Updates lastBalanceSyncAt on every enabled-account run
 */
export async function syncAccountsForItem(params: {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
	accessToken: string;
	callLog?: ProviderEndpointCall[];
	plaidAccounts?: AccountBase[];
}): Promise<Map<string, SyncedPlaidAccount>> {
	const { db, userId, plaidItemDbId, accessToken, callLog } = params;

	const plaidAccounts =
		params.plaidAccounts ??
		(await fetchPlaidAccountsForItem({
			userId,
			plaidItemDbId,
			accessToken,
			callLog,
		}));
	const returnedPlaidAccountIds = new Set(
		plaidAccounts.map((a) => a.account_id),
	);
	const siblingLinkedAccountIds = await siblingLinkedIncomingAccountIds({
		db,
		userId,
		plaidItemDbId,
		plaidAccounts,
	});
	if (siblingLinkedAccountIds.size > 0) {
		logger.info(
			"Skipped Plaid accounts already linked on a live sibling item",
			{
				feature: "plaid",
				operation: "syncAccounts",
				userId,
				itemId: plaidItemDbId,
				skippedCount: siblingLinkedAccountIds.size,
				incomingCount: plaidAccounts.length,
			},
		);
	}
	const now = new Date();

	const accountIdMap = new Map<string, SyncedPlaidAccount>();

	for (const acct of plaidAccounts) {
		if (siblingLinkedAccountIds.has(acct.account_id)) continue;
		const existing = await db.plaidAccount.findFirst({
			where: { plaidAccountId: acct.account_id, userId },
			select: { id: true, syncEnabled: true },
		});
		if (existing && existing.syncEnabled === false) {
			await db.plaidAccount.update({
				where: { id: existing.id },
				data: { isActive: true },
			});
			continue;
		}

		const row = await db.plaidAccount.upsert({
			where: { plaidAccountId: acct.account_id },
			create: {
				userId,
				plaidItemId: plaidItemDbId,
				plaidAccountId: acct.account_id,
				name: acct.name,
				officialName: acct.official_name ?? null,
				mask: acct.mask ?? null,
				type: acct.type,
				subtype: acct.subtype ?? null,
				currentBalance: acct.balances.current ?? null,
				availableBalance: acct.balances.available ?? null,
				currency: acct.balances.iso_currency_code ?? "USD",
				isActive: true,
				lastBalanceSyncAt: now,
			},
			update: {
				name: acct.name,
				officialName: acct.official_name ?? null,
				mask: acct.mask ?? null,
				type: acct.type,
				subtype: acct.subtype ?? null,
				currentBalance: acct.balances.current ?? null,
				availableBalance: acct.balances.available ?? null,
				currency: acct.balances.iso_currency_code ?? "USD",
				isActive: true,
				lastBalanceSyncAt: now,
			},
			select: {
				id: true,
				plaidAccountId: true,
				name: true,
				officialName: true,
				mask: true,
				type: true,
				subtype: true,
				currentBalance: true,
			},
		});
		accountIdMap.set(row.plaidAccountId, {
			id: row.id,
			name: row.name,
			officialName: row.officialName,
			mask: row.mask,
			type: row.type,
			subtype: row.subtype,
			currentBalance: row.currentBalance,
		});
	}

	// Soft-deactivate accounts no longer returned by Plaid — do not delete
	await db.plaidAccount.updateMany({
		where: {
			plaidItemId: plaidItemDbId,
			userId,
			plaidAccountId: { notIn: Array.from(returnedPlaidAccountIds) },
			isActive: true,
		},
		data: { isActive: false },
	});

	await db.plaidItem.update({
		where: { id: plaidItemDbId },
		data: { lastBalanceSyncAt: now },
	});

	return accountIdMap;
}

async function siblingLinkedIncomingAccountIds(params: {
	db: PrismaClientLike;
	userId: string;
	plaidItemDbId: string;
	plaidAccounts: AccountBase[];
}): Promise<Set<string>> {
	if (params.plaidAccounts.length === 0) return new Set();

	try {
		const item = await params.db.plaidItem.findUnique({
			where: { id: params.plaidItemDbId },
			select: { institutionId: true, institutionName: true },
		});
		if (!item) return new Set();

		const live = await loadLiveInstitutionAccounts(params.db, {
			userId: params.userId,
			institutionId: item.institutionId,
			institutionName: item.institutionName,
			excludeItemId: params.plaidItemDbId,
		});
		if (live.length === 0) return new Set();

		const matches = matchLiveAccounts({
			live,
			incoming: params.plaidAccounts.map((account) => ({
				plaidAccountId: account.account_id,
				name: account.name,
				mask: account.mask ?? null,
				type: account.type,
				subtype: account.subtype ?? null,
			})),
		});
		return new Set(matches.map((match) => match.incomingPlaidAccountId));
	} catch (error) {
		logger.logError("Failed to match live sibling Plaid accounts", error, {
			feature: "plaid",
			operation: "syncAccounts",
			userId: params.userId,
			itemId: params.plaidItemDbId,
		});
		return new Set();
	}
}
