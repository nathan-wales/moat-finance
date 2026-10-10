export const PLAID_TRANSACTIONS_PRODUCT = "transactions";
export const PLAID_INVESTMENTS_PRODUCT = "investments";

/** History window requested from Plaid on every new Link Item. */
export const PLAID_TRANSACTIONS_DAYS_REQUESTED = 365;

export function plaidTransactionsHistoryRequest(): {
	days_requested: number;
} {
	return { days_requested: PLAID_TRANSACTIONS_DAYS_REQUESTED };
}

export type PlaidLinkProducts = {
	products: readonly string[];
	optionalProducts: readonly string[];
};

/**
 * Fresh Link always requires Transactions and requests Investments as optional.
 *
 * Plaid AND-filters institutions by `products`, so Investments must never sit
 * there — Crew and other transaction-only banks would show "Connectivity not
 * supported." Optional products do not filter the institution list and are
 * only billed once Plaid successfully adds them to the Item.
 *
 * Liabilities is intentionally omitted: Moat has no Liabilities sync path.
 */
export function resolvePlaidLinkProducts(): PlaidLinkProducts {
	return {
		products: [PLAID_TRANSACTIONS_PRODUCT],
		optionalProducts: [PLAID_INVESTMENTS_PRODUCT],
	};
}

/**
 * Update mode cannot re-specify `products`, so consent for Investments on an
 * existing Item is collected through `additional_consented_products`.
 */
export function resolveAdditionalConsentedProducts(): readonly string[] {
	return [PLAID_INVESTMENTS_PRODUCT];
}
