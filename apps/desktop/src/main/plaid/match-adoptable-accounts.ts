/**
 * Pure matching pass behind account adoption on re-link.
 *
 * Plaid issues fresh account_ids when a bank is linked again, so a re-link would
 * otherwise strand every row keyed to the old PlaidAccount.id: transaction and
 * real-estate FKs are `onDelete: SetNull`, and profile notes / name overrides are
 * keyed by that id. Matching a paused row to the incoming account keeps all of it
 * attached instead of creating duplicates.
 */

import {
	accountFingerprints,
	type FingerprintAccount,
} from "./account-fingerprints";

export type AdoptableAccount = FingerprintAccount & {
	id: string;
	plaidAccountId: string;
};

export type IncomingAccount = FingerprintAccount & {
	plaidAccountId: string;
};

export type AdoptionMatch = {
	rowId: string;
	plaidAccountId: string;
};

export function matchAdoptableAccounts(input: {
	candidates: AdoptableAccount[];
	incoming: IncomingAccount[];
	/**
	 * Plaid account ids already stored locally. `PlaidAccount.plaidAccountId` is
	 * unique, so repointing a paused row onto one of these would collide — the
	 * normal account upsert updates those rows in place instead.
	 */
	takenPlaidAccountIds: Iterable<string>;
}): AdoptionMatch[] {
	if (input.candidates.length === 0 || input.incoming.length === 0) return [];

	const takenIds = new Set(input.takenPlaidAccountIds);
	const byFingerprint = new Map<string, AdoptableAccount[]>();
	for (const candidate of input.candidates) {
		for (const key of accountFingerprints(candidate)) {
			const bucket = byFingerprint.get(key);
			if (bucket) bucket.push(candidate);
			else byFingerprint.set(key, [candidate]);
		}
	}

	const claimed = new Set<string>();
	const matches: AdoptionMatch[] = [];

	for (const account of input.incoming) {
		if (takenIds.has(account.plaidAccountId)) continue;
		for (const key of accountFingerprints(account)) {
			const match = byFingerprint
				.get(key)
				?.find((candidate) => !claimed.has(candidate.id));
			if (!match) continue;
			claimed.add(match.id);
			matches.push({
				plaidAccountId: account.plaidAccountId,
				rowId: match.id,
			});
			break;
		}
	}

	return matches;
}
