export type FingerprintAccount = {
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
};

export function normalizeAccountName(name: string): string {
	return name.trim().toLowerCase().replace(/\s+/g, " ");
}

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

export function liveMatchFingerprints(account: FingerprintAccount): string[] {
	const keys: string[] = [];
	const mask = account.mask?.trim();
	if (mask) {
		keys.push(`mask:${mask}|${account.type}|${account.subtype ?? ""}`);
	}
	keys.push(`name:${normalizeAccountName(account.name)}|${account.type}`);
	return keys;
}

export function liveDuplicateCollapseKey(account: FingerprintAccount): string {
	const mask = account.mask?.trim();
	const name = normalizeAccountName(account.name);
	if (mask) {
		return `mask:${mask}|${account.type}|${account.subtype ?? ""}|name:${name}`;
	}
	return `name:${name}|${account.type}`;
}
