import type { RecurringExpenseMonthRow } from "../../spending/detect-recurring-expenses";
import { monthKeyFromParts } from "../../spending/detect-recurring-expenses";
import { STATE_INCOME_TAX_RATES } from "../constants";

export type ExpenseTransactionLike = {
	date: Date;
	type: string;
	description: string | null;
	amount: number;
	location?: { region?: string | null } | null;
};

/**
 * Groups trailing expense transactions into the month-row shape
 * `detectRecurringExpenses` already consumes. The shell fetches; this stays
 * pure so both hosts produce the same suggestions from the same rows.
 */
export function expenseMonthRowsFromTransactions(
	transactions: ExpenseTransactionLike[],
): RecurringExpenseMonthRow[] {
	const buckets = new Map<string, RecurringExpenseMonthRow>();
	for (const transaction of transactions) {
		if (transaction.type !== "EXPENSE") continue;
		const description = (transaction.description ?? "").trim().toLowerCase();
		if (!description) continue;
		const monthKey = monthKeyFromParts(
			transaction.date.getUTCFullYear(),
			transaction.date.getUTCMonth() + 1,
		);
		const key = `${description}|${monthKey}`;
		const existing = buckets.get(key);
		const amount = Math.abs(transaction.amount);
		if (existing) {
			existing.monthlyTotal += amount;
			continue;
		}
		buckets.set(key, {
			normalizedDescription: description,
			monthKey,
			monthlyTotal: amount,
		});
	}
	return [...buckets.values()];
}

/** Most common two-letter region among transactions that have one. */
export function modalStateCodeFromTransactions(
	transactions: ExpenseTransactionLike[],
): string | null {
	const counts = new Map<string, number>();
	for (const transaction of transactions) {
		const raw = transaction.location?.region?.trim().toUpperCase() ?? "";
		if (raw.length !== 2) continue;
		if (!(raw in STATE_INCOME_TAX_RATES)) continue;
		counts.set(raw, (counts.get(raw) ?? 0) + 1);
	}
	let best: string | null = null;
	let bestCount = 0;
	for (const [code, count] of counts) {
		if (count <= bestCount) continue;
		best = code;
		bestCount = count;
	}
	return best;
}
