import type { SqliteDbClient } from "@moat/db-sqlite";
import type { AccountBase } from "plaid";
import { remoteLogger } from "../lib/remote-logger";
import { isPlaidItemAccessLive, plaidInstitutionKey } from "./access-state";
import {
	type AdoptableAccount,
	matchAdoptableAccounts,
} from "./match-adoptable-accounts";

/**
 * Repoints paused PlaidAccount rows at a freshly linked PlaidItem so a reconnect
 * preserves history, notes, and net-worth settings instead of creating duplicates.
 *
 * Unmatched paused rows are left alone — `selectVisiblePlaidItems` already hides a
 * paused item once the same institution has a live one.
 */
export async function adoptRevokedPlaidAccountsForInstitution(params: {
	userId: string;
	keepItemId: string;
	institutionId?: string | null;
	institutionName: string;
	plaidAccounts: AccountBase[];
	db: SqliteDbClient;
}): Promise<{ adopted: number }> {
	const { userId, keepItemId, institutionName, plaidAccounts, db } = params;
	if (plaidAccounts.length === 0) {
		return { adopted: 0 };
	}

	const keepKey = plaidInstitutionKey({
		institutionId: params.institutionId,
		institutionName,
	});

	const pausedItems = (await db.plaidItem.findMany({
		where: {
			userId,
			id: { not: keepItemId },
			OR: [{ accessRevokedAt: { not: null } }, { accessTokenEncrypted: null }],
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
					plaidAccountId: true,
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
		accounts: AdoptableAccount[];
	}>;

	const candidates: AdoptableAccount[] = [];
	for (const item of pausedItems) {
		if (isPlaidItemAccessLive(item)) continue;
		const itemKey = plaidInstitutionKey({
			institutionId: item.institutionId,
			institutionName: item.institutionName,
		});
		if (itemKey !== keepKey) continue;
		candidates.push(...item.accounts);
	}

	if (candidates.length === 0) {
		return { adopted: 0 };
	}

	const incoming = plaidAccounts.map((account) => ({
		mask: account.mask ?? null,
		name: account.name,
		plaidAccountId: account.account_id,
		subtype: account.subtype ?? null,
		type: account.type,
	}));

	const existingRows = (await db.plaidAccount.findMany({
		where: {
			plaidAccountId: { in: incoming.map((account) => account.plaidAccountId) },
		},
		select: { plaidAccountId: true },
	})) as Array<{ plaidAccountId: string }>;

	const matches = matchAdoptableAccounts({
		candidates,
		incoming,
		takenPlaidAccountIds: existingRows.map((row) => row.plaidAccountId),
	});

	let adopted = 0;
	for (const match of matches) {
		try {
			await db.plaidAccount.update({
				where: { id: match.rowId },
				data: {
					plaidAccountId: match.plaidAccountId,
					plaidItemId: keepItemId,
					isActive: true,
					isHidden: false,
				},
			});
			adopted += 1;
		} catch (error) {
			const errorMessage = error instanceof Error ? error.message : "unknown";
			console.error("[plaid] Failed to adopt paused account on relink:", error);
			remoteLogger.error("Failed to adopt paused Plaid account on relink", {
				event: "plaid.adopt_paused_account_failed",
				feature: "plaid",
				operation: "adoptRevokedPlaidAccountsForInstitution",
				metadata: { errorMessage },
			});
		}
	}

	return { adopted };
}
