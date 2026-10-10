import type { TransactionSummary } from "@moat/data-access";

export type SummarizeTransactionRow = {
	id: string;
	amount: number;
	type: string;
	date: Date | string;
};

export function emptyTransactionSummary(): TransactionSummary {
	return {
		totalIncome: 0,
		totalExpenses: 0,
		netGain: 0,
		transactionCount: 0,
		incomeCount: 0,
		expenseCount: 0,
		largestTransaction: null,
		largestTransactionId: null,
		largestExpense: null,
		largestExpenseId: null,
		averageTransaction: null,
		firstTransactionDate: null,
		firstTransactionId: null,
		lastTransactionDate: null,
		lastTransactionId: null,
	};
}

function toDate(value: Date | string): Date | null {
	const date = value instanceof Date ? value : new Date(value);
	if (Number.isNaN(date.getTime())) return null;
	return date;
}

export function summarizeTransactions(
	rows: SummarizeTransactionRow[],
): TransactionSummary {
	if (rows.length === 0) return emptyTransactionSummary();

	let totalIncome = 0;
	let totalExpenses = 0;
	let incomeCount = 0;
	let expenseCount = 0;
	let largestTransaction: number | null = null;
	let largestTransactionId: string | null = null;
	let largestExpense: number | null = null;
	let largestExpenseId: string | null = null;
	let firstDate: Date | null = null;
	let firstTransactionId: string | null = null;
	let lastDate: Date | null = null;
	let lastTransactionId: string | null = null;

	for (const row of rows) {
		const amount = row.amount;
		if (largestTransaction === null || amount > largestTransaction) {
			largestTransaction = amount;
			largestTransactionId = row.id;
		}

		const date = toDate(row.date);
		if (date) {
			if (firstDate === null || date < firstDate) {
				firstDate = date;
				firstTransactionId = row.id;
			}
			if (lastDate === null || date > lastDate) {
				lastDate = date;
				lastTransactionId = row.id;
			}
		}

		if (row.type === "INCOME") {
			totalIncome += amount;
			incomeCount += 1;
			continue;
		}

		totalExpenses += amount;
		expenseCount += 1;
		if (largestExpense === null || amount > largestExpense) {
			largestExpense = amount;
			largestExpenseId = row.id;
		}
	}

	const transactionCount = rows.length;
	return {
		totalIncome,
		totalExpenses,
		netGain: totalIncome - totalExpenses,
		transactionCount,
		incomeCount,
		expenseCount,
		largestTransaction,
		largestTransactionId,
		largestExpense,
		largestExpenseId,
		averageTransaction: (totalIncome + totalExpenses) / transactionCount,
		firstTransactionDate: firstDate?.toISOString() ?? null,
		firstTransactionId,
		lastTransactionDate: lastDate?.toISOString() ?? null,
		lastTransactionId,
	};
}
