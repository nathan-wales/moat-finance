import type {
	NormalizedAccount,
	NormalizedFinancialState,
	NormalizedTransaction,
} from "./types";

export function compareStrings(left: string, right: string): number {
	if (left < right) return -1;
	if (left > right) return 1;
	return 0;
}

export function transferPairKey(leftId: string, rightId: string): string {
	return [leftId, rightId].sort(compareStrings).join("|");
}

export function sortHashtags(hashtags: string[]): string[] {
	return [...hashtags].sort(compareStrings);
}

export function sortAccounts(
	accounts: NormalizedAccount[],
): NormalizedAccount[] {
	return [...accounts].sort((left, right) =>
		compareStrings(left.providerAccountId, right.providerAccountId),
	);
}

export function sortTransactions(
	transactions: NormalizedTransaction[],
): NormalizedTransaction[] {
	return [...transactions].sort((left, right) => {
		const accountOrder = compareStrings(
			left.providerAccountId ?? "",
			right.providerAccountId ?? "",
		);
		if (accountOrder !== 0) return accountOrder;
		return compareStrings(
			left.providerTransactionId,
			right.providerTransactionId,
		);
	});
}

export function sortNormalizedState(
	state: NormalizedFinancialState,
): NormalizedFinancialState {
	return {
		accounts: sortAccounts(state.accounts),
		transactions: sortTransactions(
			state.transactions.map((tx) => ({
				...tx,
				hashtags: sortHashtags(tx.hashtags),
			})),
		),
		aggregates: state.aggregates,
	};
}
