import type { AccountBase } from "plaid";
import { logger } from "~/lib/logger";
import type { PrismaClient } from "../../../generated/prisma";
import { isPlaidItemAccessLive, plaidInstitutionKey } from "./access-state";
import { accountFingerprints } from "./account-fingerprints";

type DbClient = PrismaClient;

type AdoptableAccount = {
	id: string;
	plaidAccountId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
};

/**
 * Repoints paused PlaidAccount rows at a freshly linked PlaidItem so a reconnect
 * preserves history, notes, and net-worth settings instead of creating duplicates.
 *
 * Unmatched paused rows are left untouched — `selectVisiblePlaidItems` already
 * hides a revoked item once the same institution has a live one, so there is no
 * need to delete rows (and no need to null their transaction FKs).
 */
export async function adoptRevokedPlaidAccountsForInstitution(
	dbClient: DbClient,
	input: {
		userId: string;
		keepItemId: string;
		institutionId?: string | null;
		institutionName: string;
		plaidAccounts: AccountBase[];
	},
): Promise<{ adopted: number }> {
	if (input.plaidAccounts.length === 0) return { adopted: 0 };

	const keepKey = plaidInstitutionKey({
		institutionId: input.institutionId,
		institutionName: input.institutionName,
	});

	const revokedItems = await dbClient.plaidItem.findMany({
		where: {
			userId: input.userId,
			id: { not: input.keepItemId },
			OR: [{ accessRevokedAt: { not: null } }, { accessTokenEncrypted: null }],
		},
		select: {
			id: true,
			institutionId: true,
			institutionName: true,
			accessRevokedAt: true,
			accessTokenEncrypted: true,
			plaidAccounts: {
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
	});

	const candidates: AdoptableAccount[] = [];
	for (const item of revokedItems) {
		if (isPlaidItemAccessLive(item)) continue;
		const itemKey = plaidInstitutionKey({
			institutionId: item.institutionId,
			institutionName: item.institutionName,
		});
		if (itemKey !== keepKey) continue;
		candidates.push(...item.plaidAccounts);
	}

	if (candidates.length === 0) return { adopted: 0 };

	// A Plaid account id can only live on one row, so incoming ids we already
	// store are not adoptable — the normal upsert will update them in place.
	const incomingIds = input.plaidAccounts.map((account) => account.account_id);
	const existingRows = await dbClient.plaidAccount.findMany({
		where: { userId: input.userId, plaidAccountId: { in: incomingIds } },
		select: { plaidAccountId: true },
	});
	const takenIds = new Set(existingRows.map((row) => row.plaidAccountId));

	const byFingerprint = new Map<string, AdoptableAccount[]>();
	for (const candidate of candidates) {
		for (const key of accountFingerprints(candidate)) {
			const bucket = byFingerprint.get(key);
			if (bucket) bucket.push(candidate);
			else byFingerprint.set(key, [candidate]);
		}
	}

	const claimed = new Set<string>();
	const matches: Array<{ rowId: string; plaidAccountId: string }> = [];

	for (const account of input.plaidAccounts) {
		if (takenIds.has(account.account_id)) continue;
		const keys = accountFingerprints({
			mask: account.mask ?? null,
			type: account.type,
			subtype: account.subtype ?? null,
			name: account.name,
		});
		for (const key of keys) {
			const match = byFingerprint
				.get(key)
				?.find((candidate) => !claimed.has(candidate.id));
			if (!match) continue;
			claimed.add(match.id);
			matches.push({ rowId: match.id, plaidAccountId: account.account_id });
			break;
		}
	}

	let adopted = 0;
	for (const match of matches) {
		try {
			await dbClient.plaidAccount.update({
				where: { id: match.rowId },
				data: {
					plaidAccountId: match.plaidAccountId,
					plaidItemId: input.keepItemId,
					isActive: true,
				},
			});
			adopted += 1;
		} catch (error) {
			logger.logError("Failed to adopt paused Plaid account on relink", error, {
				feature: "plaid",
				operation: "adoptRevokedPlaidAccountsForInstitution",
				userId: input.userId,
				accountId: match.rowId,
			});
		}
	}

	if (adopted > 0) {
		logger.info("Adopted paused Plaid accounts after relink", {
			feature: "plaid",
			operation: "adoptRevokedPlaidAccountsForInstitution",
			userId: input.userId,
			itemId: input.keepItemId,
			adopted,
		});
	}

	return { adopted };
}
