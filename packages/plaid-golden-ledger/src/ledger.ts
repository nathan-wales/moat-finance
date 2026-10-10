import { dayOffset, LEDGER_TODAY } from "./ledger-today";
import {
	type GoldenPlaidAccount,
	type GoldenPlaidRemovedTransaction,
	type GoldenPlaidTransaction,
	goldenTransaction,
	paginate,
	pfc,
} from "./plaid-shape";
import type { GoldenCostcoRule, UserCategoryOverride } from "./types";

export const GOLDEN_PUBLIC_TOKEN = "golden-public-token";
export const GOLDEN_ACCESS_TOKEN = "golden-access-token";
export const GOLDEN_ITEM_ID = "golden-item-id";
export const GOLDEN_LINK_TOKEN = "golden-link-token";
export const GOLDEN_INSTITUTION_ID = "ins_golden";
export const GOLDEN_INSTITUTION_NAME = "Golden Bank";

export const GOLDEN_PAGE_SIZE = 10;

export const GOLDEN_COSTCO_RULE: GoldenCostcoRule = {
	descriptionContains: "Costco",
	setCategory: "Shopping",
};

export const GOLDEN_ACCOUNT_IDS = {
	checking: "gacc-checking",
	savings: "gacc-savings",
	credit: "gacc-credit",
	disabledChecking: "gacc-disabled-checking",
} as const;

export const GOLDEN_ACCOUNTS: GoldenPlaidAccount[] = [
	{
		account_id: GOLDEN_ACCOUNT_IDS.checking,
		name: "Golden Checking",
		official_name: "Golden Checking Account",
		mask: "1234",
		type: "depository",
		subtype: "checking",
		balances: {
			current: 12500,
			available: 12300,
			iso_currency_code: "USD",
		},
	},
	{
		account_id: GOLDEN_ACCOUNT_IDS.savings,
		name: "Golden Savings",
		official_name: "Golden Savings Account",
		mask: "5678",
		type: "depository",
		subtype: "savings",
		balances: {
			current: 42000,
			available: 42000,
			iso_currency_code: "USD",
		},
	},
	{
		account_id: GOLDEN_ACCOUNT_IDS.credit,
		name: "Golden Credit Card",
		official_name: "Golden Visa",
		mask: "9012",
		type: "credit",
		subtype: "credit card",
		balances: {
			current: 1850,
			available: 8150,
			iso_currency_code: "USD",
		},
	},
	{
		account_id: GOLDEN_ACCOUNT_IDS.disabledChecking,
		name: "Golden Disabled Checking",
		official_name: "Golden Disabled Checking Account",
		mask: "0000",
		type: "depository",
		subtype: "checking",
		balances: {
			current: 250,
			available: 250,
			iso_currency_code: "USD",
		},
	},
];

type GoldenTxSpec = {
	id: string;
	accountId: string;
	amount: number;
	dateOffset: number;
	name: string;
	pending?: boolean;
	primary?: string;
	detailed?: string;
	merchantName?: string;
};

function renderTx(spec: GoldenTxSpec, today: string): GoldenPlaidTransaction {
	return goldenTransaction({
		id: spec.id,
		accountId: spec.accountId,
		amount: spec.amount,
		date: dayOffset(spec.dateOffset, today),
		name: spec.name,
		pending: spec.pending,
		pfc:
			spec.primary !== undefined
				? pfc(spec.primary, spec.detailed ?? null)
				: null,
		merchantName: spec.merchantName,
	});
}

const INITIAL_TX_SPECS: GoldenTxSpec[] = [
	{
		id: "gtx-pending-merchant",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 42,
		dateOffset: 0,
		name: "PENDING MERCHANT",
		pending: true,
		primary: "GENERAL_MERCHANDISE",
	},
	{
		id: "gtx-starbucks-a",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 6.75,
		dateOffset: -1,
		name: "STARBUCKS STORE 1",
		primary: "FOOD_AND_DRINK",
		merchantName: "Starbucks",
	},
	{
		id: "gtx-starbucks-b",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 6.75,
		dateOffset: -1,
		name: "STARBUCKS STORE 2",
		primary: "FOOD_AND_DRINK",
		merchantName: "Starbucks",
	},
	{
		id: "gtx-pending-xfer-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 150,
		dateOffset: -2,
		name: "INTERNAL TRANSFER",
		pending: true,
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-pending-xfer-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -150,
		dateOffset: -2,
		name: "INTERNAL TRANSFER",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-costco",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 87.43,
		dateOffset: -3,
		name: "COSTCO WHSE #0421",
		primary: "FOOD_AND_DRINK",
		detailed: "FOOD_AND_DRINK_GROCERIES",
		merchantName: "Costco",
	},
	{
		id: "gtx-bookstore",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 24,
		dateOffset: -4,
		name: "LOCAL BOOKSTORE",
		primary: "FOOD_AND_DRINK",
	},
	{
		id: "gtx-xfer-1k-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 1000,
		dateOffset: -5,
		name: "ONLINE TRANSFER TO SAVINGS",
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-xfer-1k-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -1000,
		dateOffset: -5,
		name: "ONLINE TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-xfer-4d-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -500,
		dateOffset: -6,
		name: "TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-ccpay-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 2000,
		dateOffset: -7,
		name: "PAYMENT TO GOLDEN CARD",
		primary: "LOAN_PAYMENTS",
		detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
	},
	{
		id: "gtx-ccpay-credit",
		accountId: GOLDEN_ACCOUNT_IDS.credit,
		amount: -2000,
		dateOffset: -7,
		name: "ONLINE PAYMENT THANK YOU",
		primary: "LOAN_PAYMENTS",
		detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
	},
	{
		id: "gtx-costco-xfer-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 400,
		dateOffset: -8,
		name: "COSTCO TRAVEL REFUND XFER",
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-costco-xfer-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -400,
		dateOffset: -8,
		name: "TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-unknown",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 12,
		dateOffset: -9,
		name: "UNKNOWN MERCHANT XYZ",
	},
	{
		id: "gtx-xfer-4d-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 500,
		dateOffset: -10,
		name: "TRANSFER TO SAVINGS",
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-xfer-5d-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -300,
		dateOffset: -11,
		name: "TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-disabled-atm",
		accountId: GOLDEN_ACCOUNT_IDS.disabledChecking,
		amount: 3.5,
		dateOffset: -12,
		name: "ATM FEE",
		primary: "BANK_FEES",
	},
	{
		id: "gtx-xfer-6d-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -250,
		dateOffset: -14,
		name: "TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-removed-sub",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 9.99,
		dateOffset: -15,
		name: "STREAMING SERVICE",
		primary: "ENTERTAINMENT",
	},
	{
		id: "gtx-xfer-5d-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 300,
		dateOffset: -16,
		name: "TRANSFER TO SAVINGS",
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-uber",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 18,
		dateOffset: -18,
		name: "UBER TRIP",
		primary: "TRANSPORTATION",
		merchantName: "Uber",
	},
	{
		id: "gtx-xfer-6d-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 250,
		dateOffset: -20,
		name: "TRANSFER TO SAVINGS",
		primary: "TRANSFER_OUT",
	},
];

const HISTORICAL_TX_SPECS: GoldenTxSpec[] = [
	{
		id: "gtx-hist-salary",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: -3500,
		dateOffset: -40,
		name: "ACME CORP PAYROLL",
		primary: "INCOME",
	},
	{
		id: "gtx-hist-costco",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 65.22,
		dateOffset: -45,
		name: "COSTCO WHSE #0421",
		primary: "FOOD_AND_DRINK",
		detailed: "FOOD_AND_DRINK_GROCERIES",
		merchantName: "Costco",
	},
	{
		id: "gtx-hist-rent",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 1800,
		dateOffset: -50,
		name: "LANDLORD RENT",
		primary: "LOAN_PAYMENTS",
		detailed: "LOAN_PAYMENTS_MORTGAGE_PAYMENT",
	},
	{
		id: "gtx-disabled-later",
		accountId: GOLDEN_ACCOUNT_IDS.disabledChecking,
		amount: 8,
		dateOffset: -55,
		name: "ATM FEE 2",
		primary: "BANK_FEES",
	},
	{
		id: "gtx-hist-groceries",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 54.1,
		dateOffset: -60,
		name: "WHOLE FOODS",
		primary: "FOOD_AND_DRINK",
		detailed: "FOOD_AND_DRINK_GROCERIES",
	},
	{
		id: "gtx-hist-gas",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 42,
		dateOffset: -70,
		name: "SHELL OIL",
		primary: "TRANSPORTATION",
		detailed: "TRANSPORTATION_GAS",
	},
	{
		id: "gtx-hist-eating",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 28.4,
		dateOffset: -80,
		name: "CHIPOTLE",
		primary: "FOOD_AND_DRINK",
	},
	{
		id: "gtx-hist-xfer-checking",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 750,
		dateOffset: -90,
		name: "TRANSFER TO SAVINGS",
		primary: "TRANSFER_OUT",
	},
	{
		id: "gtx-hist-xfer-savings",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -750,
		dateOffset: -90,
		name: "TRANSFER FROM CHECKING",
		primary: "TRANSFER_IN",
	},
	{
		id: "gtx-hist-shopping",
		accountId: GOLDEN_ACCOUNT_IDS.checking,
		amount: 33,
		dateOffset: -100,
		name: "TARGET",
		primary: "GENERAL_MERCHANDISE",
	},
	{
		id: "gtx-hist-interest",
		accountId: GOLDEN_ACCOUNT_IDS.savings,
		amount: -12.5,
		dateOffset: -110,
		name: "INTEREST PAYMENT",
		primary: "INCOME",
		detailed: "INCOME_INTEREST_EARNED",
	},
];

export const USER_CATEGORY_OVERRIDES_AFTER_INITIAL: UserCategoryOverride[] = [
	{ providerTransactionId: "gtx-bookstore", category: "Entertainment" },
];

export const DISABLED_ACCOUNT_SKIPPED_TX_ID = "gtx-disabled-later";

function historicalModifiedSpecs(today: string): GoldenPlaidTransaction[] {
	return [
		renderTx(
			{
				id: "gtx-pending-merchant",
				accountId: GOLDEN_ACCOUNT_IDS.checking,
				amount: 42,
				dateOffset: 0,
				name: "PENDING MERCHANT",
				pending: false,
				primary: "GENERAL_MERCHANDISE",
			},
			today,
		),
		renderTx(
			{
				id: "gtx-bookstore",
				accountId: GOLDEN_ACCOUNT_IDS.checking,
				amount: 24,
				dateOffset: -4,
				name: "LOCAL BOOKSTORE",
				primary: "GENERAL_MERCHANDISE",
			},
			today,
		),
		renderTx(
			{
				id: "gtx-unknown",
				accountId: GOLDEN_ACCOUNT_IDS.checking,
				amount: 12,
				dateOffset: -9,
				name: "UNKNOWN MERCHANT XYZ",
				primary: "FOOD_AND_DRINK",
				detailed: "FOOD_AND_DRINK_GROCERIES",
			},
			today,
		),
		renderTx(
			{
				id: "gtx-uber",
				accountId: GOLDEN_ACCOUNT_IDS.checking,
				amount: 19.5,
				dateOffset: -18,
				name: "UBER TRIP",
				primary: "TRANSPORTATION",
				merchantName: "Uber",
			},
			today,
		),
	];
}

const HISTORICAL_REMOVED_IDS = ["gtx-removed-sub"] as const;

function mutationAddedSpecs(today: string): GoldenPlaidTransaction[] {
	return [
		renderTx(
			{
				id: "gtx-mutation-coffee",
				accountId: GOLDEN_ACCOUNT_IDS.checking,
				amount: 5.25,
				dateOffset: 0,
				name: "GOLDEN COFFEE CO",
				primary: "FOOD_AND_DRINK",
			},
			today,
		),
	];
}

function mutationModifiedSpecs(today: string): GoldenPlaidTransaction[] {
	return [
		renderTx(
			{
				id: "gtx-ccpay-credit",
				accountId: GOLDEN_ACCOUNT_IDS.credit,
				amount: -1900,
				dateOffset: -7,
				name: "ONLINE PAYMENT THANK YOU",
				primary: "LOAN_PAYMENTS",
				detailed: "LOAN_PAYMENTS_CREDIT_CARD_PAYMENT",
			},
			today,
		),
	];
}

const MUTATION_REMOVED_IDS = ["gtx-hist-gas"] as const;

export function buildGoldenLedger(ledgerToday: string = LEDGER_TODAY): {
	accounts: GoldenPlaidAccount[];
	initialAdded: GoldenPlaidTransaction[];
	initialPages: GoldenPlaidTransaction[][];
	historicalAdded: GoldenPlaidTransaction[];
	historicalPages: GoldenPlaidTransaction[][];
	historicalModified: GoldenPlaidTransaction[];
	historicalRemoved: GoldenPlaidRemovedTransaction[];
	mutationAdded: GoldenPlaidTransaction[];
	mutationModified: GoldenPlaidTransaction[];
	mutationRemoved: GoldenPlaidRemovedTransaction[];
	disabledAccountSkippedTxId: string;
} {
	const initialAdded = INITIAL_TX_SPECS.map((spec) =>
		renderTx(spec, ledgerToday),
	);
	const historicalAdded = HISTORICAL_TX_SPECS.map((spec) =>
		renderTx(spec, ledgerToday),
	);
	return {
		accounts: GOLDEN_ACCOUNTS,
		initialAdded,
		initialPages: paginate(initialAdded, GOLDEN_PAGE_SIZE),
		historicalAdded,
		historicalPages: paginate(historicalAdded, GOLDEN_PAGE_SIZE),
		historicalModified: historicalModifiedSpecs(ledgerToday),
		historicalRemoved: HISTORICAL_REMOVED_IDS.map((transaction_id) => ({
			transaction_id,
		})),
		mutationAdded: mutationAddedSpecs(ledgerToday),
		mutationModified: mutationModifiedSpecs(ledgerToday),
		mutationRemoved: MUTATION_REMOVED_IDS.map((transaction_id) => ({
			transaction_id,
		})),
		disabledAccountSkippedTxId: DISABLED_ACCOUNT_SKIPPED_TX_ID,
	};
}

export const GOLDEN_LEDGER = buildGoldenLedger();
