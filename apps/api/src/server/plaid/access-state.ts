export type PlaidAccessState = {
	accessRevokedAt?: Date | null;
	accessTokenEncrypted?: string | null;
};

export type PlaidInstitutionIdentity = {
	institutionId?: string | null;
	institutionName: string;
};

export const LIVE_PLAID_ITEM_WHERE = {
	accessRevokedAt: null,
	accessTokenEncrypted: { not: null },
} as const;

export function isPlaidItemAccessLive(item: PlaidAccessState): boolean {
	return item.accessRevokedAt == null && Boolean(item.accessTokenEncrypted);
}

export function livePlaidAccessToken(item: PlaidAccessState): string | null {
	if (!isPlaidItemAccessLive(item) || !item.accessTokenEncrypted) return null;
	return item.accessTokenEncrypted;
}

export function plaidInstitutionKey(item: PlaidInstitutionIdentity): string {
	const institutionId = item.institutionId?.trim();
	if (institutionId) return `id:${institutionId}`;
	return `name:${item.institutionName.trim().toLowerCase()}`;
}

export function collectLiveInstitutionKeys(
	items: Array<PlaidAccessState & PlaidInstitutionIdentity>,
): Set<string> {
	return new Set(items.filter(isPlaidItemAccessLive).map(plaidInstitutionKey));
}

export function shouldDisplayPlaidItem(
	item: PlaidAccessState & PlaidInstitutionIdentity,
	liveInstitutionKeys: Set<string>,
): boolean {
	if (isPlaidItemAccessLive(item)) return true;
	return !liveInstitutionKeys.has(plaidInstitutionKey(item));
}

type PlaidItemAccountActivity = {
	plaidAccounts?: Array<{ isActive: boolean }>;
	accounts?: Array<{ isActive: boolean }>;
};

function itemHasActiveAccounts(item: PlaidItemAccountActivity): boolean {
	const accounts = item.plaidAccounts ?? item.accounts ?? [];
	return accounts.some((account) => account.isActive);
}

/**
 * Connected-item lists should not show a user-disconnected institution (revoked,
 * accounts inactive) while still showing access-revoked cards (revoked, accounts
 * still active). `selectVisiblePlaidItems` alone keeps a paused item until a
 * live sibling exists.
 */
export function shouldListConnectedPlaidItem(
	item: PlaidAccessState & PlaidItemAccountActivity,
): boolean {
	if (isPlaidItemAccessLive(item)) return true;
	return itemHasActiveAccounts(item);
}

export function selectVisiblePlaidItems<
	T extends PlaidAccessState & PlaidInstitutionIdentity,
>(items: T[]): T[] {
	const liveInstitutionKeys = collectLiveInstitutionKeys(items);
	return items.filter((item) =>
		shouldDisplayPlaidItem(item, liveInstitutionKeys),
	);
}

export function selectConnectedPlaidItems<
	T extends PlaidAccessState &
		PlaidInstitutionIdentity &
		PlaidItemAccountActivity,
>(items: T[]): T[] {
	return selectVisiblePlaidItems(items).filter(shouldListConnectedPlaidItem);
}
