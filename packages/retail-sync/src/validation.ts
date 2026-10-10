import type { RetailOrderImport } from "./normalized-types";
import { retailOrderImportSchema } from "./schemas";

export type RetailValidationResult = {
	validOrders: RetailOrderImport[];
	warnings: string[];
};

export function validateRetailOrders(
	orders: RetailOrderImport[],
): RetailValidationResult {
	const validOrders: RetailOrderImport[] = [];
	const warnings: string[] = [];

	for (const order of orders) {
		const result = retailOrderImportSchema.safeParse(order);
		if (result.success) {
			validOrders.push(result.data);
			continue;
		}

		warnings.push(
			`Skipped order ${order.externalOrderId || "unknown"}: ${result.error.issues
				.map((issue) => issue.message)
				.join(", ")}`,
		);
	}

	return { validOrders, warnings };
}
