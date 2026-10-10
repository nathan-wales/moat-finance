import type { ExchangePlaidPublicTokenBody } from "@moat/client-ts";
import type { PlaidLinkOnSuccessMetadata } from "react-plaid-link";

export function plaidLinkExchangeMetadata(
	metadata: PlaidLinkOnSuccessMetadata,
): ExchangePlaidPublicTokenBody["metadata"] {
	const accounts = metadata.accounts.map((account) => ({
		id: account.id,
		name: account.name,
		mask: account.mask ?? null,
		type: account.type,
		subtype: account.subtype ?? null,
	}));

	if (!metadata.institution && accounts.length === 0) return undefined;

	return {
		...(metadata.institution
			? {
					institution: {
						name: metadata.institution.name,
						institution_id: metadata.institution.institution_id,
					},
				}
			: {}),
		...(accounts.length > 0 ? { accounts } : {}),
	};
}
