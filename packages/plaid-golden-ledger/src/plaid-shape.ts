export type GoldenPlaidPersonalFinanceCategory = {
	primary: string | null;
	detailed: string | null;
};

export type GoldenPlaidTransaction = {
	transaction_id: string;
	account_id: string;
	amount: number;
	iso_currency_code: string;
	unofficial_currency_code: string | null;
	date: string;
	name: string;
	original_description: string;
	merchant_name: string | null;
	pending: boolean;
	pending_transaction_id: string | null;
	payment_channel: string;
	authorized_date: string | null;
	personal_finance_category: GoldenPlaidPersonalFinanceCategory | null;
};

export type GoldenPlaidRemovedTransaction = {
	transaction_id: string;
};

export type GoldenPlaidAccount = {
	account_id: string;
	name: string;
	official_name: string;
	mask: string;
	type: string;
	subtype: string;
	balances: {
		current: number;
		available: number;
		iso_currency_code: string;
	};
};

export function pfc(
	primary: string,
	detailed?: string | null,
): GoldenPlaidPersonalFinanceCategory {
	return { primary, detailed: detailed ?? null };
}

export function goldenTransaction(input: {
	id: string;
	accountId: string;
	amount: number;
	date: string;
	name: string;
	pending?: boolean;
	pfc?: GoldenPlaidPersonalFinanceCategory | null;
	merchantName?: string | null;
}): GoldenPlaidTransaction {
	return {
		transaction_id: input.id,
		account_id: input.accountId,
		amount: input.amount,
		iso_currency_code: "USD",
		unofficial_currency_code: null,
		date: input.date,
		name: input.name,
		original_description: input.name,
		merchant_name: input.merchantName ?? null,
		pending: input.pending ?? false,
		pending_transaction_id: null,
		payment_channel: "other",
		authorized_date: null,
		personal_finance_category: input.pfc ?? null,
	};
}

export function paginate<T>(items: T[], pageSize: number): T[][] {
	const pages: T[][] = [];
	for (let index = 0; index < items.length; index += pageSize) {
		pages.push(items.slice(index, index + pageSize));
	}
	return pages.length > 0 ? pages : [[]];
}
