import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	type PlaidItemProductCapabilities,
	plaidItemCapabilitiesFromItemGet,
} from "@moat/financial-data-providers/plaid-investments";
import { getPlaidClient } from "./client";
import { encodePlaidProductList } from "./product-capabilities";

export async function persistPlaidItemProductCapabilities(input: {
	db: SqliteDbClient;
	plaidItemDbId: string;
	accessToken: string;
	itemSnapshot?: Parameters<typeof plaidItemCapabilitiesFromItemGet>[0];
}): Promise<PlaidItemProductCapabilities | null> {
	try {
		const snapshot =
			input.itemSnapshot ??
			(
				await getPlaidClient().itemGet({
					access_token: input.accessToken,
				})
			).data.item;
		const capabilities = plaidItemCapabilitiesFromItemGet(snapshot);
		await input.db.plaidItem.update({
			where: { id: input.plaidItemDbId },
			data: {
				billedProductsJson: encodePlaidProductList(capabilities.billedProducts),
				availableProductsJson: encodePlaidProductList(
					capabilities.availableProducts,
				),
				consentedProductsJson: encodePlaidProductList(
					capabilities.consentedProducts,
				),
			},
		});
		return capabilities;
	} catch {
		return null;
	}
}
