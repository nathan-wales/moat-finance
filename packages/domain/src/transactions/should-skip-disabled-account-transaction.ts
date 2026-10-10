/**
 * Skip Plaid added/modified rows whose account is not in the enabled map.
 *
 * Disconnect sets `syncEnabled: false` and the sync engines omit those
 * accounts from the map. Plaid still returns Item-level txs; Moat must not
 * persist them as unlinked orphans.
 */
export function shouldSkipDisabledAccountTransaction(input: {
	plaidAccountId: string | null | undefined;
	enabledAccountIds: ReadonlyMap<string, unknown> | ReadonlySet<string>;
}): boolean {
	if (!input.plaidAccountId) return true;
	return !input.enabledAccountIds.has(input.plaidAccountId);
}
