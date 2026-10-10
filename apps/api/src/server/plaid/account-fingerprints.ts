export type FingerprintAccount = {
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
};

export function normalizeAccountName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, " ");
}

/**
 * Most-specific first. Used by reconnect adoption, which may fall through to a
 * weaker mask+type key when subtype is missing.
 */
export function accountFingerprints(account: FingerprintAccount): string[] {
	const keys: string[] = [];
	const mask = account.mask?.trim();
	if (mask) {
		keys.push(`mask:${mask}|${account.type}|${account.subtype ?? ""}`);
		keys.push(`mask:${mask}|${account.type}`);
	}
	keys.push(`name:${normalizeAccountName(account.name)}|${account.type}`);
	return keys;
}

/**
 * Live skip/match keys. Omits mask+type without subtype so checking and savings
 * that share a last-4 are not treated as the same account.
 */
export function liveMatchFingerprints(account: FingerprintAccount): string[] {
	const keys: string[] = [];
	const mask = account.mask?.trim();
	if (mask) {
		keys.push(`mask:${mask}|${account.type}|${account.subtype ?? ""}`);
	}
	keys.push(`name:${normalizeAccountName(account.name)}|${account.type}`);
	return keys;
}

/**
 * Stricter than adoption fingerprints: name is always part of the key so two
 * different accounts that share a mask are not collapsed together.
 */
export function liveDuplicateCollapseKey(account: FingerprintAccount): string {
	const mask = account.mask?.trim();
	const name = normalizeAccountName(account.name);
	if (mask) {
		return `mask:${mask}|${account.type}|${account.subtype ?? ""}|name:${name}`;
	}
	return `name:${name}|${account.type}`;
}
