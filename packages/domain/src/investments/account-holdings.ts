import type { AccountHolding, AccountHoldingsResponse } from "@moat/contracts";
import { resolveAccountHistorySourceCandidates } from "../dashboard/account-balance-history";

export type AccountHoldingRecord = AccountHolding & {
	syncedAt: Date;
};

export const EMPTY_ACCOUNT_HOLDINGS_RESULT: AccountHoldingsResponse = {
	holdings: [],
	totalValue: 0,
	lastSyncedAt: null,
};

export function plaidAccountIdsForHoldingsLookup(accountId: string): string[] {
	return resolveAccountHistorySourceCandidates(accountId)
		.filter((candidate) => candidate.source === "PLAID")
		.map((candidate) => candidate.sourceId);
}

export function toAccountHoldingsResult(
	rows: AccountHoldingRecord[],
): AccountHoldingsResponse {
	if (rows.length === 0) return EMPTY_ACCOUNT_HOLDINGS_RESULT;

	const lastSyncedAt = rows.reduce<Date | null>(
		(latest, row) => (!latest || row.syncedAt > latest ? row.syncedAt : latest),
		null,
	);
	return {
		holdings: rows.map(({ syncedAt: _syncedAt, ...holding }) => holding),
		totalValue: rows.reduce((total, row) => total + row.value, 0),
		lastSyncedAt: lastSyncedAt?.toISOString() ?? null,
	};
}
