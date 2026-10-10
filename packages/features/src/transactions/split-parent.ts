export function isSplitParentTransaction(tx: {
	splitGroupId?: string | null;
	splitParentId?: string | null;
}) {
	return Boolean(tx.splitGroupId) && !tx.splitParentId;
}

export function excludeSplitParentTransactions<
	T extends {
		splitGroupId?: string | null;
		splitParentId?: string | null;
	},
>(transactions: T[]): T[] {
	return transactions.filter((tx) => !isSplitParentTransaction(tx));
}
