import type { RetailOrderImport } from "./normalized-types";

export function dedupeRetailOrders(
	orders: RetailOrderImport[],
): RetailOrderImport[] {
	const byKey = new Map<string, RetailOrderImport>();

	for (const order of orders) {
		const key = `${order.retailer}:${order.externalOrderId}`;
		const existing = byKey.get(key);
		if (!existing) {
			byKey.set(key, order);
			continue;
		}

		if (order.items.length >= existing.items.length) {
			byKey.set(key, order);
		}
	}

	return Array.from(byKey.values());
}
