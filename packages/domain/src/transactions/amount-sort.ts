export type AmountSortDir = "asc" | "desc";

export type AmountSortableTransaction = {
	id: string;
	type: string;
	amount: number;
};

export function compareByAmountSort(
	a: AmountSortableTransaction,
	b: AmountSortableTransaction,
	sortDir: AmountSortDir,
): number {
	const aExpense = a.type === "EXPENSE";
	const bExpense = b.type === "EXPENSE";
	if (aExpense !== bExpense) {
		if (sortDir === "desc") return aExpense ? 1 : -1;
		return aExpense ? -1 : 1;
	}

	const magnitude = Math.abs(b.amount) - Math.abs(a.amount);
	if (magnitude !== 0) return magnitude;
	return a.id.localeCompare(b.id);
}

export function pageIdsByAmountSort(
	rows: AmountSortableTransaction[],
	sortDir: AmountSortDir,
	cursor: number,
	limit: number,
): string[] {
	return [...rows]
		.sort((a, b) => compareByAmountSort(a, b, sortDir))
		.slice(cursor, cursor + limit)
		.map((row) => row.id);
}

export function sortRowsByIdOrder<T extends { id: string }>(
	rows: T[],
	ids: string[],
): T[] {
	const idOrder = new Map(ids.map((id, index) => [id, index]));
	return [...rows].sort(
		(a, b) => (idOrder.get(a.id) ?? 0) - (idOrder.get(b.id) ?? 0),
	);
}
