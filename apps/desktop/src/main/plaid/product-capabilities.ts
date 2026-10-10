import type { PlaidItemProductCapabilities } from "@moat/financial-data-providers/plaid-investments";

export type StoredPlaidProductCapabilities = {
	billedProductsJson?: string | null;
	availableProductsJson?: string | null;
	consentedProductsJson?: string | null;
};

export function parseJsonStringArray(
	value: string | null | undefined,
): string[] {
	if (!value) return [];
	try {
		const parsed = JSON.parse(value) as unknown;
		if (!Array.isArray(parsed)) return [];
		return parsed.filter((item): item is string => typeof item === "string");
	} catch {
		return [];
	}
}

export function encodePlaidProductList(products: string[]): string {
	return JSON.stringify(products);
}

export function parseStoredPlaidProductCapabilities(
	item: StoredPlaidProductCapabilities,
): PlaidItemProductCapabilities {
	return {
		billedProducts: parseJsonStringArray(item.billedProductsJson),
		availableProducts: parseJsonStringArray(item.availableProductsJson),
		consentedProducts: parseJsonStringArray(item.consentedProductsJson),
	};
}
