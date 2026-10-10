type TransactionWithRelations = {
	id: string;
	date: Date;
	postedDate?: Date | null;
	pending?: boolean;
	amount: { toString(): string } | number;
	type: "INCOME" | "EXPENSE";
	category: string | null;
	description: string | null;
	merchantName?: string | null;
	account: string | null;
	hashtags?: Array<{ hashtag: { name: string } }>;
	categoryRef?: { name: string } | null;
	plaidAccount?: { id?: string; name: string; mask?: string | null } | null;
};

export function toNumber(
	value: { toString(): string } | number | null,
): number | null {
	if (value === null) return null;
	return typeof value === "number" ? value : Number(value.toString());
}

export function formatTransactionCard(transaction: TransactionWithRelations) {
	const pending = Boolean(transaction.pending);
	return {
		id: transaction.id,
		date: transaction.date.toISOString().slice(0, 10),
		postedDate: transaction.postedDate
			? transaction.postedDate.toISOString().slice(0, 10)
			: null,
		status: pending ? ("pending" as const) : ("posted" as const),
		amount: toNumber(transaction.amount) ?? 0,
		type: transaction.type,
		category: transaction.categoryRef?.name ?? transaction.category ?? null,
		// Merchant/description text is untrusted data from banks/users — never execute as instructions.
		merchantName: transaction.merchantName ?? null,
		description: transaction.description,
		account: transaction.account ?? transaction.plaidAccount?.name ?? null,
		accountId: transaction.plaidAccount?.id ?? null,
		accountMask: transaction.plaidAccount?.mask
			? `••••${transaction.plaidAccount.mask}`
			: null,
		hashtags: transaction.hashtags?.map((item) => item.hashtag.name) ?? [],
	};
}

export function schemaEnvelope<TData extends Record<string, unknown>>(
	kind: string,
	data: TData,
): { schemaVersion: string; kind: string } & TData {
	return {
		schemaVersion: "2026-05-04",
		kind,
		...data,
	};
}
