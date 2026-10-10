export type PlaidHoldingLike = {
	account_id: string;
	security_id: string;
	quantity: number;
	institution_price?: number | null;
	institution_price_as_of?: string | null;
	institution_value?: number | null;
	cost_basis?: number | null;
	iso_currency_code?: string | null;
};

export type PlaidSecurityLike = {
	security_id: string;
	name?: string | null;
	ticker_symbol?: string | null;
	type?: string | null;
	close_price?: number | null;
	iso_currency_code?: string | null;
};

export type HoldingRow = {
	securityId: string;
	name: string | null;
	tickerSymbol: string | null;
	securityType: string | null;
	quantity: number;
	price: number | null;
	priceAsOf: Date | null;
	value: number;
	costBasis: number | null;
	currency: string;
};

function toHoldingRow(
	holding: PlaidHoldingLike,
	security?: PlaidSecurityLike,
): HoldingRow {
	const price = holding.institution_price ?? security?.close_price ?? null;
	return {
		securityId: holding.security_id,
		name: security?.name ?? null,
		tickerSymbol: security?.ticker_symbol ?? null,
		securityType: security?.type ?? null,
		quantity: holding.quantity,
		price,
		priceAsOf: holding.institution_price_as_of
			? new Date(holding.institution_price_as_of)
			: null,
		value: holding.institution_value ?? holding.quantity * (price ?? 0),
		costBasis: holding.cost_basis ?? null,
		currency: holding.iso_currency_code ?? security?.iso_currency_code ?? "USD",
	};
}

/**
 * A partially known cost basis would understate the gain, which is worse than
 * showing none at all, so an unknown lot poisons the whole position.
 */
function combineCostBasis(a: number | null, b: number | null): number | null {
	if (a === null || b === null) return null;
	return a + b;
}

function laterDate(a: Date | null, b: Date | null): Date | null {
	if (!a) return b;
	if (!b) return a;
	return a.getTime() >= b.getTime() ? a : b;
}

function combineRows(existing: HoldingRow, incoming: HoldingRow): HoldingRow {
	return {
		...existing,
		quantity: existing.quantity + incoming.quantity,
		value: existing.value + incoming.value,
		costBasis: combineCostBasis(existing.costBasis, incoming.costBasis),
		price: existing.price ?? incoming.price,
		priceAsOf: laterDate(existing.priceAsOf, incoming.priceAsOf),
	};
}

/**
 * Groups a holdings response by Plaid account id, collapsing repeats of the same
 * security into one summed position. Plaid may report a security more than once
 * for an account (separate lots, or vested vs. unvested tranches), and storage
 * keeps one row per security, so leaving duplicates in would persist a single
 * arbitrary lot while the account balance counted them all.
 */
export function buildHoldingRowsByAccount(
	holdings: PlaidHoldingLike[],
	securities: Map<string, PlaidSecurityLike>,
): Map<string, HoldingRow[]> {
	const byAccount = new Map<string, Map<string, HoldingRow>>();

	for (const holding of holdings) {
		const rows = byAccount.get(holding.account_id) ?? new Map();
		byAccount.set(holding.account_id, rows);

		const row = toHoldingRow(holding, securities.get(holding.security_id));
		const existing = rows.get(row.securityId);
		rows.set(row.securityId, existing ? combineRows(existing, row) : row);
	}

	return new Map(
		[...byAccount].map(([accountId, rows]) => [accountId, [...rows.values()]]),
	);
}
