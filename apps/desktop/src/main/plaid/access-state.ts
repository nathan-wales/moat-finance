/**
 * Shared predicates for the paused/live state of a local `PlaidItem`.
 *
 * Mirrors `apps/api/src/server/plaid/access-state.ts`; the SQLite schema stores
 * the encrypted token as `Bytes` rather than a string.
 */

export type PlaidItemAccessState = {
	accessRevokedAt?: Date | null;
	accessTokenEncrypted?: Buffer | null;
};

export type PlaidInstitutionIdentity = {
	institutionId?: string | null;
	institutionName: string;
};

export const LIVE_PLAID_ITEM_WHERE = {
	accessRevokedAt: null,
	accessTokenEncrypted: { not: null },
} as const;

export function isPlaidItemAccessLive(item: PlaidItemAccessState): boolean {
	return item.accessRevokedAt == null && item.accessTokenEncrypted != null;
}

export function livePlaidAccessToken(
	item: PlaidItemAccessState,
): Buffer | null {
	if (!isPlaidItemAccessLive(item) || !item.accessTokenEncrypted) return null;
	return item.accessTokenEncrypted;
}

export function plaidInstitutionKey(item: PlaidInstitutionIdentity): string {
	const institutionId = item.institutionId?.trim();
	if (institutionId) return `id:${institutionId}`;
	return `name:${item.institutionName.trim().toLowerCase()}`;
}

/**
 * Hides a paused institution once the same institution has a live item, so a
 * re-link does not leave an empty duplicate card in the accounts list.
 */
export function selectVisiblePlaidItems<
	T extends PlaidItemAccessState & PlaidInstitutionIdentity,
>(items: T[]): T[] {
	const liveInstitutionKeys = new Set(
		items.filter(isPlaidItemAccessLive).map(plaidInstitutionKey),
	);
	return items.filter(
		(item) =>
			isPlaidItemAccessLive(item) ||
			!liveInstitutionKeys.has(plaidInstitutionKey(item)),
	);
}

type PlaidItemAccountActivity = {
	plaidAccounts?: Array<{ isActive: boolean }>;
	accounts?: Array<{ isActive: boolean }>;
};

export function shouldListConnectedPlaidItem(
	item: PlaidItemAccessState & PlaidItemAccountActivity,
): boolean {
	if (isPlaidItemAccessLive(item)) return true;
	const accounts = item.plaidAccounts ?? item.accounts ?? [];
	return accounts.some((account) => account.isActive);
}

export function selectConnectedPlaidItems<
	T extends PlaidItemAccessState &
		PlaidInstitutionIdentity &
		PlaidItemAccountActivity,
>(items: T[]): T[] {
	return selectVisiblePlaidItems(items).filter(shouldListConnectedPlaidItem);
}
