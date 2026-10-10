export function resolveAccountDisplayName(
	nameOverride: string | undefined,
	fallbackName: string,
): string {
	const override = nameOverride?.trim();
	return override ? override : fallbackName;
}

/**
 * Build a lookup of financial-profile `nameOverride` values keyed by both
 * raw Plaid account ids and `plaid-<id>` profile account ids.
 */
export function buildAccountNameOverrideMap(
	accounts: unknown,
): Map<string, string> {
	const map = new Map<string, string>();
	if (!Array.isArray(accounts)) return map;

	for (const account of accounts) {
		if (typeof account !== "object" || account === null) continue;
		if (!("id" in account) || typeof account.id !== "string") continue;

		const nameOverride =
			"nameOverride" in account && typeof account.nameOverride === "string"
				? account.nameOverride.trim()
				: "";
		if (!nameOverride) continue;

		const id = account.id;
		map.set(id, nameOverride);
		if (id.startsWith("plaid-")) {
			map.set(id.slice("plaid-".length), nameOverride);
		} else {
			map.set(`plaid-${id}`, nameOverride);
		}
	}

	return map;
}
