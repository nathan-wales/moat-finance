import {
	type HistoricalOverlapWindow,
	laterUtcDate,
	overlapWindowFromBounds,
} from "@moat/domain";
import { createAccountFingerprint } from "@moat/financial-data-providers";
import type { PrismaClient } from "../../../generated/prisma";

type DbClient = PrismaClient;

type AccountForFingerprint = {
	id: string;
	name: string;
	officialName: string | null;
	type: string;
	subtype: string | null;
	mask: string | null;
	currency: string;
};

export function fingerprintForPlaidAccount(
	account: AccountForFingerprint,
): string {
	return createAccountFingerprint({
		canonicalInstitutionId: null,
		name: account.officialName ?? account.name,
		type: account.type,
		subtype: account.subtype,
		mask: account.mask,
		currency: account.currency,
	});
}

/**
 * Fills null `transactionsSyncedThrough` values on a newly linked Item from
 * leftover FinancialAccount rows or existing transaction history for the same
 * account fingerprint. Used when PlaidItem rows were hard-deleted by the old
 * disconnect path.
 *
 * One aggregate lookup per reconnect — does not compare incoming Plaid txs
 * against stored rows.
 */
export async function seedTransactionSyncWatermarksForItem(
	dbClient: DbClient,
	input: { userId: string; plaidItemDbId: string },
): Promise<{ seeded: number }> {
	const accounts = await dbClient.plaidAccount.findMany({
		where: {
			userId: input.userId,
			plaidItemId: input.plaidItemDbId,
			transactionsSyncedThrough: null,
		},
		select: {
			id: true,
			name: true,
			officialName: true,
			type: true,
			subtype: true,
			mask: true,
			currency: true,
		},
	});
	if (accounts.length === 0) return { seeded: 0 };

	const fingerprintByAccountId = new Map<string, string>();
	const fingerprints: string[] = [];
	for (const account of accounts) {
		const fingerprint = fingerprintForPlaidAccount(account);
		fingerprintByAccountId.set(account.id, fingerprint);
		fingerprints.push(fingerprint);
	}

	const watermarkByFingerprint = new Map<string, Date>();

	const financialAccounts = await dbClient.financialAccount.findMany({
		where: {
			userId: input.userId,
			accountFingerprint: { in: fingerprints },
			transactionsSyncedThrough: { not: null },
		},
		select: {
			accountFingerprint: true,
			transactionsSyncedThrough: true,
		},
		orderBy: { transactionsSyncedThrough: "desc" },
	});
	for (const row of financialAccounts) {
		if (!row.accountFingerprint || !row.transactionsSyncedThrough) continue;
		if (watermarkByFingerprint.has(row.accountFingerprint)) continue;
		watermarkByFingerprint.set(
			row.accountFingerprint,
			row.transactionsSyncedThrough,
		);
	}

	const missingFingerprints = fingerprints.filter(
		(fingerprint) => !watermarkByFingerprint.has(fingerprint),
	);
	if (missingFingerprints.length > 0) {
		const aggregates = await dbClient.transaction.groupBy({
			by: ["accountFingerprint"],
			where: {
				userId: input.userId,
				accountFingerprint: { in: missingFingerprints },
				removedAt: null,
			},
			_max: { date: true },
		});
		for (const row of aggregates) {
			if (!row.accountFingerprint || !row._max.date) continue;
			watermarkByFingerprint.set(row.accountFingerprint, row._max.date);
		}
	}

	let seeded = 0;
	for (const account of accounts) {
		const fingerprint = fingerprintByAccountId.get(account.id);
		if (!fingerprint) continue;
		const watermark = watermarkByFingerprint.get(fingerprint);
		if (!watermark) continue;
		await dbClient.plaidAccount.update({
			where: { id: account.id },
			data: { transactionsSyncedThrough: watermark },
		});
		await dbClient.financialAccount.updateMany({
			where: {
				userId: input.userId,
				accountFingerprint: fingerprint,
				OR: [
					{ transactionsSyncedThrough: null },
					{ transactionsSyncedThrough: { lt: watermark } },
				],
			},
			data: { transactionsSyncedThrough: watermark },
		});
		seeded += 1;
	}

	return { seeded };
}

export async function loadTransactionSyncWatermarks(
	dbClient: DbClient,
	plaidAccountIds: string[],
): Promise<Map<string, Date>> {
	const watermarks = new Map<string, Date>();
	if (plaidAccountIds.length === 0) return watermarks;

	const rows = await dbClient.plaidAccount.findMany({
		where: { id: { in: plaidAccountIds } },
		select: { id: true, transactionsSyncedThrough: true },
	});
	for (const row of rows) {
		if (!row.transactionsSyncedThrough) continue;
		watermarks.set(row.id, row.transactionsSyncedThrough);
	}
	return watermarks;
}

function leftoverItemWhere(currentPlaidItemDbId: string) {
	return {
		OR: [{ plaidItemId: null }, { plaidItemId: { not: currentPlaidItemDbId } }],
	};
}

/**
 * Date coverage left behind by a prior Item (whatever months already exist).
 * New-Item syncs skip only this window so a later historical pull cannot
 * re-insert those days after the cursor is saved, and so importing older
 * history does not grow the skip range to the full year.
 */
export async function loadHistoricalOverlapWindowsForPlaidAccounts(
	dbClient: DbClient,
	input: {
		userId: string;
		plaidAccountIds: string[];
		currentPlaidItemDbId: string;
	},
): Promise<Map<string, HistoricalOverlapWindow>> {
	const windows = new Map<string, HistoricalOverlapWindow>();
	if (input.plaidAccountIds.length === 0) return windows;

	const leftover = leftoverItemWhere(input.currentPlaidItemDbId);
	const byAccount = await dbClient.transaction.groupBy({
		by: ["plaidAccountId"],
		where: {
			userId: input.userId,
			plaidAccountId: { in: input.plaidAccountIds },
			removedAt: null,
			...leftover,
		},
		_min: { date: true },
		_max: { date: true },
	});
	for (const row of byAccount) {
		if (!row.plaidAccountId) continue;
		const window = overlapWindowFromBounds(row._min.date, row._max.date);
		if (!window) continue;
		windows.set(row.plaidAccountId, window);
	}

	const missingIds = input.plaidAccountIds.filter((id) => !windows.has(id));
	if (missingIds.length === 0) return windows;

	const accounts = await dbClient.plaidAccount.findMany({
		where: { id: { in: missingIds } },
		select: {
			id: true,
			name: true,
			officialName: true,
			type: true,
			subtype: true,
			mask: true,
			currency: true,
		},
	});
	const fingerprintByAccountId = new Map<string, string>();
	const fingerprints: string[] = [];
	for (const account of accounts) {
		const fingerprint = fingerprintForPlaidAccount(account);
		fingerprintByAccountId.set(account.id, fingerprint);
		fingerprints.push(fingerprint);
	}
	if (fingerprints.length === 0) return windows;

	const byFingerprint = await dbClient.transaction.groupBy({
		by: ["accountFingerprint"],
		where: {
			userId: input.userId,
			accountFingerprint: { in: fingerprints },
			removedAt: null,
			...leftover,
		},
		_min: { date: true },
		_max: { date: true },
	});
	const windowByFingerprint = new Map<string, HistoricalOverlapWindow>();
	for (const row of byFingerprint) {
		if (!row.accountFingerprint) continue;
		const window = overlapWindowFromBounds(row._min.date, row._max.date);
		if (!window) continue;
		windowByFingerprint.set(row.accountFingerprint, window);
	}
	for (const account of accounts) {
		const fingerprint = fingerprintByAccountId.get(account.id);
		if (!fingerprint) continue;
		const window = windowByFingerprint.get(fingerprint);
		if (!window) continue;
		windows.set(account.id, window);
	}

	return windows;
}

export async function advanceTransactionSyncWatermarks(
	dbClient: Pick<PrismaClient, "plaidAccount" | "financialAccount">,
	input: {
		persistedThroughByPlaidAccountId: Map<string, Date>;
		existingByPlaidAccountId: Map<string, Date>;
		financialAccountIdByPlaidAccountId: Map<string, string>;
	},
): Promise<void> {
	for (const [
		plaidAccountId,
		persistedThrough,
	] of input.persistedThroughByPlaidAccountId) {
		const next = laterUtcDate(
			input.existingByPlaidAccountId.get(plaidAccountId) ?? null,
			persistedThrough,
		);
		if (!next) continue;
		const existing = input.existingByPlaidAccountId.get(plaidAccountId);
		if (existing && existing.getTime() >= next.getTime()) continue;

		await dbClient.plaidAccount.update({
			where: { id: plaidAccountId },
			data: { transactionsSyncedThrough: next },
		});

		const financialAccountId =
			input.financialAccountIdByPlaidAccountId.get(plaidAccountId);
		if (!financialAccountId) continue;
		await dbClient.financialAccount.update({
			where: { id: financialAccountId },
			data: { transactionsSyncedThrough: next },
		});
	}
}
