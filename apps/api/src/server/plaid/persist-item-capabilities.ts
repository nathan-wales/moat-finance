import { db } from "../db";
import { getPlaidClient } from "../lib/plaidClient";
import {
	type PlaidItemProductCapabilities,
	plaidItemCapabilitiesFromItemGet,
} from "./item-capabilities";

export async function persistPlaidItemProductCapabilities(input: {
	plaidItemDbId: string;
	accessToken: string;
}): Promise<PlaidItemProductCapabilities | null> {
	try {
		const client = getPlaidClient();
		const itemResponse = await client.itemGet({
			access_token: input.accessToken,
		});
		const capabilities = plaidItemCapabilitiesFromItemGet(
			itemResponse.data.item,
		);
		await db.plaidItem.update({
			where: { id: input.plaidItemDbId },
			data: {
				billedProducts: capabilities.billedProducts,
				availableProducts: capabilities.availableProducts,
				consentedProducts: capabilities.consentedProducts,
			},
		});
		return capabilities;
	} catch {
		return null;
	}
}
