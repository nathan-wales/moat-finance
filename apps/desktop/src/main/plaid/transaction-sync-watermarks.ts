import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	type HistoricalOverlapWindow,
	laterUtcDate,
	overlapWindowFromBounds,
	toUtcDateKey,
} from "@moat/domain";
import { createAccountFingerprint } from "@moat/financial-data-providers";

function leftoverItemWhere(currentPlaidItemDbId: string) {
	return {
		OR: [{ plaidItemId: null }, { plaidItemId: { not: currentPlaidItemDbId } }],
	};
}

function parseSqliteDate(
	value: Date | string | number | null | undefined,
): Date | null {
	if (value instanceof Date && !Number.isNaN(value.getTime())) return value;
	if (typeof value === "number" && Number.isFinite(value)) {
		const millis = value < 1e12 ? value * 1000 : value;
		const parsed = new Date(millis);
		return Number.isNaN(parsed.getTime()) ? null : parsed;
	}
	if (typeof value !== "string" || !value.trim()) return null;
	const parsed = new Date(value);
	return Number.isNaN(parsed.getTime()) ? null : parsed;
}

async function groupLeftoverWindowsByPlaidAccountId(input: {
	db: SqliteDbClient;
	plaidAccountIds: string[];
	currentPlaidItemDbId: string;
}): Promise<Map<string, HistoricalOverlapWindow>> {
	const windows = new Map<string, HistoricalOverlapWindow>();
	if (input.plaidAccountIds.length === 0) return windows;

	const rows = (await input.db.transaction.findMany({
		where: {
			plaidAccountId: { in: input.plaidAccountIds },
			removedAt: null,
			...leftoverItemWhere(input.currentPlaidItemDbId),
		},
		select: { plaidAccountId: true, date: true },
	})) as Array<{ plaidAccountId: string | null; date: Date | string | number }>;

	const bounds = new Map<string, { from: Date; through: Date }>();
	for (const row of rows) {
		if (!row.plaidAccountId) continue;
		const date = parseSqliteDate(row.date);
		if (!date) continue;
		const existing = bounds.get(row.plaidAccountId);
		if (!existing) {
			bounds.set(row.plaidAccountId, { from: date, through: date });
			continue;
		}
		if (toUtcDateKey(date) < toUtcDateKey(existing.from)) existing.from = date;
		if (toUtcDateKey(date) > toUtcDateKey(existing.through)) {
			existing.through = date;
		}
	}

	for (const [plaidAccountId, bound] of bounds) {
		const window = overlapWindowFromBounds(bound.from, bound.through);
		if (!window) continue;
		windows.set(plaidAccountId, window);
	}
	return windows;
}

export async function seedDesktopTransactionSyncWatermarks(input: {
	db: SqliteDbClient;
	plaidItemDbId: string;
}): Promise<void> {
	const accounts = (await input.db.plaidAccount.findMany({
		where: {
			plaidItemId: input.plaidItemDbId,
			transactionsSyncedThrough: null,
		},
		select: { id: true },
	})) as Array<{ id: string }>;
	if (accounts.length === 0) return;

	const rows = (await input.db.transaction.findMany({
		where: {
			plaidAccountId: { in: accounts.map((account) => account.id) },
			removedAt: null,
		},
		select: { plaidAccountId: true, date: true },
	})) as Array<{ plaidAccountId: string | null; date: Date | string | number }>;

	const watermarkByAccountId = new Map<string, Date>();
	for (const row of rows) {
		if (!row.plaidAccountId) continue;
		const date = parseSqliteDate(row.date);
		if (!date) continue;
		const current = watermarkByAccountId.get(row.plaidAccountId);
		if (!current || toUtcDateKey(date) > toUtcDateKey(current)) {
			watermarkByAccountId.set(row.plaidAccountId, date);
		}
	}

	for (const account of accounts) {
		const watermark = watermarkByAccountId.get(account.id);
		if (!watermark) continue;
		await input.db.plaidAccount.update({
			where: { id: account.id },
			data: { transactionsSyncedThrough: watermark },
		});
	}
}

export async function loadDesktopTransactionSyncWatermarks(input: {
	db: SqliteDbClient;
	plaidAccountIds: string[];
}): Promise<Map<string, Date>> {
	const watermarks = new Map<string, Date>();
	if (input.plaidAccountIds.length === 0) return watermarks;

	const rows = (await input.db.plaidAccount.findMany({
		where: { id: { in: input.plaidAccountIds } },
		select: { id: true, transactionsSyncedThrough: true },
	})) as Array<{ id: string; transactionsSyncedThrough: Date | null }>;

	for (const row of rows) {
		if (!row.transactionsSyncedThrough) continue;
		watermarks.set(row.id, row.transactionsSyncedThrough);
	}
	return watermarks;
}

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

function earlierUtcDate(
	left: Date | null | undefined,
	right: Date | null | undefined,
): Date | null {
	if (!left) return right ?? null;
	if (!right) return left;
	return toUtcDateKey(left) <= toUtcDateKey(right) ? left : right;
}

/**
 * Leftover coverage on any other PlaidAccount with the same account fingerprint
 * (web parity). Includes still-live prior Items, not only paused ones — desktop
 * profile Disconnect historically left the old Item live.
 */
async function loadFingerprintOverlapFallback(input: {
	db: SqliteDbClient;
	currentPlaidItemDbId: string;
	missingLiveAccountIds: string[];
}): Promise<Map<string, HistoricalOverlapWindow>> {
	const windows = new Map<string, HistoricalOverlapWindow>();
	if (input.missingLiveAccountIds.length === 0) return windows;

	const currentItem = (await input.db.plaidItem.findUnique({
		where: { id: input.currentPlaidItemDbId },
		select: { userId: true },
	})) as { userId: string } | null;
	if (!currentItem) return windows;

	const liveAccounts = (await input.db.plaidAccount.findMany({
		where: { id: { in: input.missingLiveAccountIds } },
		select: {
			id: true,
			name: true,
			officialName: true,
			type: true,
			subtype: true,
			mask: true,
			currency: true,
		},
	})) as AccountForFingerprint[];
	if (liveAccounts.length === 0) return windows;

	const otherAccounts = (await input.db.plaidAccount.findMany({
		where: {
			item: { userId: currentItem.userId },
			id: { notIn: input.missingLiveAccountIds },
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
	})) as AccountForFingerprint[];
	if (otherAccounts.length === 0) return windows;

	const otherIdsByFingerprint = new Map<string, string[]>();
	for (const account of otherAccounts) {
		const fingerprint = fingerprintForPlaidAccount(account);
		const ids = otherIdsByFingerprint.get(fingerprint);
		if (ids) ids.push(account.id);
		else otherIdsByFingerprint.set(fingerprint, [account.id]);
	}

	const leftoverIds = [...new Set([...otherIdsByFingerprint.values()].flat())];
	const leftoverWindows = await groupLeftoverWindowsByPlaidAccountId({
		db: input.db,
		plaidAccountIds: leftoverIds,
		currentPlaidItemDbId: input.currentPlaidItemDbId,
	});

	for (const live of liveAccounts) {
		const otherIds = otherIdsByFingerprint.get(
			fingerprintForPlaidAccount(live),
		);
		if (!otherIds) continue;
		let from: Date | null = null;
		let through: Date | null = null;
		for (const otherId of otherIds) {
			const window = leftoverWindows.get(otherId);
			if (!window) continue;
			from = earlierUtcDate(from, window.from);
			through = laterUtcDate(through, window.through);
		}
		const merged = overlapWindowFromBounds(from, through);
		if (merged) windows.set(live.id, merged);
	}
	return windows;
}

/**
 * Date coverage left behind by a prior Item. Skip only this window so a later
 * historical pull cannot re-insert those days, and so importing older history
 * does not grow the skip range to the full year.
 *
 * When leftover txs still sit on a prior Item's PlaidAccount (adoption missed
 * or the old Item was never paused), map those windows onto live accounts by
 * the same account fingerprint the web reconnect path uses.
 */
export async function loadDesktopHistoricalOverlapWindows(input: {
	db: SqliteDbClient;
	plaidAccountIds: string[];
	currentPlaidItemDbId: string;
}): Promise<Map<string, HistoricalOverlapWindow>> {
	if (input.plaidAccountIds.length === 0) {
		return new Map();
	}

	const windows = await groupLeftoverWindowsByPlaidAccountId(input);
	const missingIds = input.plaidAccountIds.filter((id) => !windows.has(id));
	if (missingIds.length === 0) {
		return windows;
	}

	const fallback = await loadFingerprintOverlapFallback({
		db: input.db,
		currentPlaidItemDbId: input.currentPlaidItemDbId,
		missingLiveAccountIds: missingIds,
	});
	for (const [liveId, window] of fallback) {
		windows.set(liveId, window);
	}
	return windows;
}

export async function advanceDesktopTransactionSyncWatermarks(input: {
	db: SqliteDbClient;
	persistedThroughByPlaidAccountId: Map<string, Date>;
	existingByPlaidAccountId: Map<string, Date>;
}): Promise<void> {
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
		await input.db.plaidAccount.update({
			where: { id: plaidAccountId },
			data: { transactionsSyncedThrough: next },
		});
	}
}
