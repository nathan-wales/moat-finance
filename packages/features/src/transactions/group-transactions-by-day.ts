import { format, startOfDay } from "date-fns";
import type { TxRecord } from "./types";

export type TransactionDayGroup = {
	dayKey: string;
	title: string;
	dayNet: number;
	transactions: TxRecord[];
};

function signedAmount(tx: TxRecord): number {
	return tx.type === "EXPENSE" ? -Math.abs(tx.amount) : Math.abs(tx.amount);
}

export function groupTransactionsByDay(
	transactions: TxRecord[],
): TransactionDayGroup[] {
	const groups: TransactionDayGroup[] = [];
	let currentDayKey: string | undefined;
	let currentTransactions: TxRecord[] = [];

	for (const tx of transactions) {
		const day = startOfDay(new Date(tx.date));
		const dayKey = format(day, "yyyy-MM-dd");

		if (currentDayKey !== undefined && dayKey !== currentDayKey) {
			groups.push(buildDayGroup(currentDayKey, currentTransactions));
			currentTransactions = [tx];
			currentDayKey = dayKey;
			continue;
		}

		currentDayKey = dayKey;
		currentTransactions.push(tx);
	}

	if (currentDayKey !== undefined && currentTransactions.length > 0) {
		groups.push(buildDayGroup(currentDayKey, currentTransactions));
	}

	return groups;
}

function buildDayGroup(
	dayKey: string,
	transactions: TxRecord[],
): TransactionDayGroup {
	const day = new Date(`${dayKey}T12:00:00`);
	return {
		dayKey,
		title: format(day, "MMM d, yyyy"),
		dayNet: transactions.reduce((sum, tx) => sum + signedAmount(tx), 0),
		transactions,
	};
}

export function isChronologicalSort(sortKey: string): boolean {
	return sortKey === "date-desc" || sortKey === "date-asc";
}
