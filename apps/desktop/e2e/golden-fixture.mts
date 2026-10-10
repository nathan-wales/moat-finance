import {
	GOLDEN_ACCOUNTS,
	GOLDEN_INSTITUTION_ID,
	GOLDEN_INSTITUTION_NAME,
	GOLDEN_PUBLIC_TOKEN,
} from "@moat/plaid-golden-ledger";

export const GOLDEN_VAULT_PASSWORD = "golden-vault-password";

export const GOLDEN_PLAID_FIXTURE = {
	publicToken: GOLDEN_PUBLIC_TOKEN,
	metadata: {
		institution: {
			name: GOLDEN_INSTITUTION_NAME,
			institution_id: GOLDEN_INSTITUTION_ID,
		},
		accounts: GOLDEN_ACCOUNTS.map((account) => ({
			id: account.account_id,
			name: account.name,
			mask: account.mask,
			type: account.type,
			subtype: account.subtype,
		})),
		link_session_id: "golden-link-session",
	},
};
