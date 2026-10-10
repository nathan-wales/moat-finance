import { dayOffset, LEDGER_TODAY } from "./ledger-today";
import {
	type GoldenPlaidAccount,
	type GoldenPlaidTransaction,
	goldenTransaction,
	pfc,
} from "./plaid-shape";

export const RECONNECT_PUBLIC_TOKEN_A = "golden-reconnect-public-a";
export const RECONNECT_PUBLIC_TOKEN_B = "golden-reconnect-public-b";
export const RECONNECT_ITEM_ID_A = "golden-reconnect-item-a";
export const RECONNECT_ITEM_ID_B = "golden-reconnect-item-b";
export const RECONNECT_ACCESS_TOKEN_A = "golden-reconnect-access-a";
export const RECONNECT_ACCESS_TOKEN_B = "golden-reconnect-access-b";
export const RECONNECT_INSTITUTION_ID = "ins_golden_reconnect";
export const RECONNECT_INSTITUTION_NAME = "Golden Reconnect Bank";

export const RECONNECT_ACCOUNT_IDS_A = {
	checking: "reconnect-a-checking",
	credit: "reconnect-a-credit",
} as const;

export const RECONNECT_ACCOUNT_IDS_B = {
	checking: "reconnect-b-checking",
	credit: "reconnect-b-credit",
	savings: "reconnect-b-savings",
} as const;

function checkingAccount(accountId: string, name: string): GoldenPlaidAccount {
	return {
		account_id: accountId,
		name,
		official_name: name,
		mask: "1234",
		type: "depository",
		subtype: "checking",
		balances: {
			current: 8000,
			available: 7800,
			iso_currency_code: "USD",
		},
	};
}

function creditAccount(accountId: string, name: string): GoldenPlaidAccount {
	return {
		account_id: accountId,
		name,
		official_name: name,
		mask: "5678",
		type: "credit",
		subtype: "credit card",
		balances: {
			current: 400,
			available: 4600,
			iso_currency_code: "USD",
		},
	};
}

export const RECONNECT_ACCOUNTS_A: GoldenPlaidAccount[] = [
	checkingAccount(RECONNECT_ACCOUNT_IDS_A.checking, "Reconnect Checking"),
	creditAccount(RECONNECT_ACCOUNT_IDS_A.credit, "Reconnect Credit Card"),
];

export const RECONNECT_ACCOUNTS_B: GoldenPlaidAccount[] = [
	checkingAccount(RECONNECT_ACCOUNT_IDS_B.checking, "Reconnect Checking"),
	creditAccount(RECONNECT_ACCOUNT_IDS_B.credit, "Reconnect Credit Card"),
];

export const RECONNECT_VARIATION_B_NEW_ACCOUNT: GoldenPlaidAccount = {
	account_id: RECONNECT_ACCOUNT_IDS_B.savings,
	name: "Reconnect Savings",
	official_name: "Reconnect Savings Account",
	mask: "9999",
	type: "depository",
	subtype: "savings",
	balances: {
		current: 1500,
		available: 1500,
		iso_currency_code: "USD",
	},
};

function grocery(
	id: string,
	accountId: string,
	amount: number,
	dateOffset: number,
	name: string,
	today: string,
): GoldenPlaidTransaction {
	return goldenTransaction({
		id,
		accountId,
		amount,
		date: dayOffset(dateOffset, today),
		name,
		pfc: pfc("FOOD_AND_DRINK", "FOOD_AND_DRINK_GROCERIES"),
	});
}

export function buildReconnectLedger(ledgerToday: string = LEDGER_TODAY): {
	itemA: {
		itemId: string;
		publicToken: string;
		accessToken: string;
		accounts: GoldenPlaidAccount[];
		transactions: GoldenPlaidTransaction[];
	};
	itemB: {
		itemId: string;
		publicToken: string;
		accessToken: string;
		accounts: GoldenPlaidAccount[];
		overlapTransactions: GoldenPlaidTransaction[];
		newerTransactions: GoldenPlaidTransaction[];
	};
	variationBAccounts: GoldenPlaidAccount[];
} {
	const overlapA = [
		grocery(
			"reconnect-a-costco-old",
			RECONNECT_ACCOUNT_IDS_A.checking,
			44.1,
			-20,
			"COSTCO WHSE",
			ledgerToday,
		),
		grocery(
			"reconnect-a-groceries-old",
			RECONNECT_ACCOUNT_IDS_A.checking,
			31.2,
			-12,
			"WHOLE FOODS",
			ledgerToday,
		),
	];
	const overlapB = [
		grocery(
			"reconnect-b-costco-old",
			RECONNECT_ACCOUNT_IDS_B.checking,
			44.1,
			-20,
			"COSTCO WHSE",
			ledgerToday,
		),
		grocery(
			"reconnect-b-groceries-old",
			RECONNECT_ACCOUNT_IDS_B.checking,
			31.2,
			-12,
			"WHOLE FOODS",
			ledgerToday,
		),
	];
	const newerB = [
		grocery(
			"reconnect-b-costco-new",
			RECONNECT_ACCOUNT_IDS_B.checking,
			52.8,
			-2,
			"COSTCO WHSE",
			ledgerToday,
		),
	];
	return {
		itemA: {
			itemId: RECONNECT_ITEM_ID_A,
			publicToken: RECONNECT_PUBLIC_TOKEN_A,
			accessToken: RECONNECT_ACCESS_TOKEN_A,
			accounts: RECONNECT_ACCOUNTS_A,
			transactions: overlapA,
		},
		itemB: {
			itemId: RECONNECT_ITEM_ID_B,
			publicToken: RECONNECT_PUBLIC_TOKEN_B,
			accessToken: RECONNECT_ACCESS_TOKEN_B,
			accounts: RECONNECT_ACCOUNTS_B,
			overlapTransactions: overlapB,
			newerTransactions: newerB,
		},
		variationBAccounts: [
			...RECONNECT_ACCOUNTS_B,
			RECONNECT_VARIATION_B_NEW_ACCOUNT,
		],
	};
}

export const RECONNECT_LEDGER = buildReconnectLedger();

export const RECONNECT_CURSOR_A = "golden-cursor-reconnect-a-done";
export const RECONNECT_CURSOR_B = "golden-cursor-reconnect-b-done";

export function reconnectLinkAccounts(
	accounts: GoldenPlaidAccount[],
): Array<{
	id: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
}> {
	return accounts.map((account) => ({
		id: account.account_id,
		name: account.name,
		mask: account.mask,
		type: account.type,
		subtype: account.subtype,
	}));
}

export function reconnectInstitutionMetadata(): {
	name: string;
	institution_id: string;
} {
	return {
		name: RECONNECT_INSTITUTION_NAME,
		institution_id: RECONNECT_INSTITUTION_ID,
	};
}
