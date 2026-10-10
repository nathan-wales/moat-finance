import { PLAID_INVESTMENTS_PRODUCT } from "./link-products";

export type PlaidItemProductCapabilities = {
	billedProducts: string[];
	availableProducts: string[];
	consentedProducts: string[];
};

export type PlaidItemProductSnapshot = {
	billed_products?: string[] | null;
	available_products?: string[] | null;
	consented_products?: string[] | null;
};

export function normalizePlaidProductList(
	products: string[] | null | undefined,
): string[] {
	if (!products) return [];
	return products
		.map((product) => product.trim().toLowerCase())
		.filter(Boolean);
}

export function plaidItemCapabilitiesFromItemGet(
	item: PlaidItemProductSnapshot,
): PlaidItemProductCapabilities {
	return {
		billedProducts: normalizePlaidProductList(item.billed_products),
		availableProducts: normalizePlaidProductList(item.available_products),
		consentedProducts: normalizePlaidProductList(item.consented_products),
	};
}

export function itemHasPlaidProduct(
	item: Pick<PlaidItemProductCapabilities, "billedProducts">,
	product: string,
): boolean {
	return item.billedProducts.includes(product.trim().toLowerCase());
}

function listsPlaidProduct(products: string[], product: string): boolean {
	const normalized = product.trim().toLowerCase();
	return products.some((entry) => entry.trim().toLowerCase() === normalized);
}

/**
 * Empty capability arrays mean the Item has never been refreshed from
 * /item/get (legacy rows). Attempt holdings once; soft-skip on error and
 * persist capabilities so the next sync is capability-based.
 *
 * Investments often stays in available_products until the first successful
 * holdings call, even after the user has consented. Consent is enough to
 * make that call. Available-only means the user has not consented yet.
 */
export function shouldSyncPlaidInvestmentsHoldings(
	item: PlaidItemProductCapabilities,
): boolean {
	const capabilitiesUnknown =
		item.billedProducts.length === 0 &&
		item.availableProducts.length === 0 &&
		item.consentedProducts.length === 0;
	if (capabilitiesUnknown) return true;
	return (
		listsPlaidProduct(item.billedProducts, PLAID_INVESTMENTS_PRODUCT) ||
		listsPlaidProduct(item.consentedProducts, PLAID_INVESTMENTS_PRODUCT)
	);
}
