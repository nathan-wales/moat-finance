/**
 * Plaid account synchronization for the desktop app.
 * Adapted from apps/api/src/server/plaid/syncAccounts.ts.
 *
 * Main-process only — never import from the renderer.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import type { AccountBase } from "plaid";
import { recordDesktopSyncedAccountHistory } from "../account-balance-history";
import { remoteLogger } from "../lib/remote-logger";
import { isPlaidItemAccessLive, plaidInstitutionKey } from "./access-state";
import { getPlaidClient } from "./client";
import { matchLiveAccounts } from "./match-live-accounts";

/**
 * Syncs Plaid accounts for a single PlaidItem.
 *
 * Returns a Map of: Plaid account_id → local PlaidAccount.id
 * Used by sync-transactions to set plaidAccountId on transaction rows.
 */
export async function syncAccountsForItem(params: {
	db: SqliteDbClient;
	plaidItemDbId: string;
	accessToken: string;
	plaidAccounts?: AccountBase[];
	onAccountsLoaded?: (accounts: AccountBase[]) => Promise<void>;
}): Promise<Map<string, { id: string; name: string }>> {
	const { db, plaidItemDbId, accessToken, onAccountsLoaded } = params;
	const plaidAccounts =
		params.plaidAccounts ??
		(await getPlaidClient().accountsGet({ access_token: accessToken })).data
			.accounts;
	if (onAccountsLoaded) {
		await onAccountsLoaded(plaidAccounts);
	}
	const returnedPlaidAccountIds = new Set(
		plaidAccounts.map((a) => a.account_id),
	);
	const siblingLinkedAccountIds = await siblingLinkedIncomingAccountIds({
		db,
		plaidItemDbId,
		plaidAccounts,
	});
	if (siblingLinkedAccountIds.size > 0) {
		remoteLogger.info(
			"Skipped Plaid accounts already linked on a live sibling item",
			{
				event: "plaid.sync_skip_sibling_linked",
				feature: "plaid",
				operation: "syncAccounts",
				metadata: {
					itemId: plaidItemDbId,
					skippedCount: siblingLinkedAccountIds.size,
					incomingCount: plaidAccounts.length,
				},
			},
		);
	}
	const now = new Date();

	const accountIdMap = new Map<string, { id: string; name: string }>();

	for (const acct of plaidAccounts) {
		if (siblingLinkedAccountIds.has(acct.account_id)) continue;
		const existing = (await db.plaidAccount.findFirst({
			where: { plaidAccountId: acct.account_id },
			select: { id: true, syncEnabled: true },
		})) as { id: string; syncEnabled: boolean } | null;
		if (existing && existing.syncEnabled === false) {
			await db.plaidAccount.update({
				where: { id: existing.id },
				data: { isActive: true },
			});
			continue;
		}

		const row = (await db.plaidAccount.upsert({
			where: { plaidAccountId: acct.account_id },
			create: {
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
				isHidden: false,
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
				isHidden: false,
				lastBalanceSyncAt: now,
			},
			select: { id: true, plaidAccountId: true, name: true },
		})) as { id: string; plaidAccountId: string; name: string };
		accountIdMap.set(row.plaidAccountId, { id: row.id, name: row.name });
	}

	await db.plaidAccount.updateMany({
		where: {
			plaidItemId: plaidItemDbId,
			plaidAccountId: { notIn: Array.from(returnedPlaidAccountIds) },
			isActive: true,
		},
		data: { isActive: false },
	});

	const item = (await db.plaidItem.findUnique({
		where: { id: plaidItemDbId },
		select: { userId: true },
	})) as { userId: string } | null;
	if (item?.userId) {
		try {
			await recordDesktopSyncedAccountHistory({
				db,
				userId: item.userId,
				now,
			});
		} catch (error) {
			console.error(
				"[account-balance-history] Failed after desktop account sync",
				error,
			);
		}
	}

	return accountIdMap;
}

async function siblingLinkedIncomingAccountIds(params: {
	db: SqliteDbClient;
	plaidItemDbId: string;
	plaidAccounts: AccountBase[];
}): Promise<Set<string>> {
	if (params.plaidAccounts.length === 0) return new Set();

	try {
		const item = (await params.db.plaidItem.findUnique({
			where: { id: params.plaidItemDbId },
			select: { userId: true, institutionId: true, institutionName: true },
		})) as {
			userId: string;
			institutionId: string | null;
			institutionName: string;
		} | null;
		if (!item) return new Set();

		const targetKey = plaidInstitutionKey({
			institutionId: item.institutionId,
			institutionName: item.institutionName,
		});
		const siblings = (await params.db.plaidItem.findMany({
			where: {
				userId: item.userId,
				id: { not: params.plaidItemDbId },
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
					where: { isActive: true },
					select: {
						id: true,
						plaidAccountId: true,
						plaidItemId: true,
						name: true,
						mask: true,
						type: true,
						subtype: true,
					},
				},
			},
		})) as Array<{
			id: string;
			institutionId: string | null;
			institutionName: string;
			accessRevokedAt: Date | null;
			accessTokenEncrypted: Buffer | null;
			accounts: Array<{
				id: string;
				plaidAccountId: string;
				plaidItemId: string;
				name: string;
				mask: string | null;
				type: string;
				subtype: string | null;
			}>;
		}>;

		const live = siblings
			.filter(isPlaidItemAccessLive)
			.filter(
				(sibling) =>
					plaidInstitutionKey({
						institutionId: sibling.institutionId,
						institutionName: sibling.institutionName,
					}) === targetKey,
			)
			.flatMap((sibling) => sibling.accounts);

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
		const errorMessage = error instanceof Error ? error.message : "unknown";
		remoteLogger.error("Failed to match live sibling Plaid accounts", {
			event: "plaid.sync_sibling_match_failed",
			feature: "plaid",
			operation: "syncAccounts",
			metadata: { itemId: params.plaidItemDbId, errorMessage },
		});
		return new Set();
	}
}
