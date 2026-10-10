import {
	detectRecurringExpenses,
	monthKeyFromParts,
	type RecurringExpenseMonthRow,
	type RecurringExpenseSummary,
	type RecurringSnapshotItem,
	toRecurringExpenseSummary,
	toSnapshotRecurring,
} from "@moat/domain";
import { startOfMonth, subMonths } from "date-fns";
import type { PrismaClient } from "../../../generated/prisma";
import { Prisma } from "../../../generated/prisma";
import {
	CANONICAL_DATE_SQL,
	transactionScopeSql,
} from "../../lib/transaction-scope";

/**
 * Insights Recurring Expenses lookback: current month plus the previous 5
 * (`startOfMonth(subMonths(now, 5))`). Do not shorten this independently of
 * the Insights card.
 */
export function recurringExpensesStartDate(now: Date): Date {
	return startOfMonth(subMonths(now, 5));
}

type RecurringExpenseSqlRow = {
	normalized_description: string | null;
	year: number;
	month: number;
	monthly_total: number;
	last_date: Date | string | null;
};

function toIso(value: Date | string | null): string | null {
	if (!value) return null;
	if (value instanceof Date) {
		if (Number.isNaN(value.getTime())) return null;
		return value.toISOString();
	}
	const asString = String(value);
	return asString.length > 0 ? asString : null;
}

function toFiniteNumber(value: unknown): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "bigint") return Number(value);
	if (value && typeof value === "object" && "toNumber" in value) {
		const numeric = (value as { toNumber: () => number }).toNumber();
		return Number.isFinite(numeric) ? numeric : 0;
	}
	const parsed = Number(value);
	return Number.isFinite(parsed) ? parsed : 0;
}

export async function fetchRecurringExpenseMonthRows(
	db: PrismaClient,
	userId: string,
	now: Date,
	expenseCategories?: string[],
): Promise<RecurringExpenseMonthRow[]> {
	const startDate = recurringExpensesStartDate(now);
	const where = transactionScopeSql({
		userId,
		startDate,
		type: "EXPENSE",
		categoryNames: expenseCategories,
	});

	const rows = await db.$queryRaw<RecurringExpenseSqlRow[]>(Prisma.sql`
		SELECT
			LOWER(TRIM(t.description)) AS normalized_description,
			EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
			EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
			SUM(t.amount)::float AS monthly_total,
			MAX(${CANONICAL_DATE_SQL}) AS last_date
		FROM "Transaction" t
		WHERE ${where}
			AND t.description IS NOT NULL
		GROUP BY 1, 2, 3
	`);

	return rows.flatMap((row) => {
		const description = (row.normalized_description ?? "").trim();
		if (!description) return [];
		return [
			{
				normalizedDescription: description,
				monthKey: monthKeyFromParts(row.year, row.month),
				monthlyTotal: toFiniteNumber(row.monthly_total),
				lastDateIso: toIso(row.last_date),
			},
		];
	});
}

export async function listRecurringExpenses(
	db: PrismaClient,
	userId: string,
	now: Date,
	expenseCategories?: string[],
): Promise<RecurringExpenseSummary[]> {
	const rows = await fetchRecurringExpenseMonthRows(
		db,
		userId,
		now,
		expenseCategories,
	);
	return detectRecurringExpenses(rows).map(toRecurringExpenseSummary);
}

/**
 * Weekly-email / notification snapshot recurring list. Same streams as
 * Insights Recurring Expenses.
 *
 * Mapping:
 * - label: Insights description
 * - amount: latest month total (latest charge when the fetch provides it)
 * - previousAmount: previous month total (previous occurrence)
 * - nextExpectedDateIso: last date in the latest month + inferred cadence
 */
export async function listSnapshotRecurring(
	db: PrismaClient,
	userId: string,
	now: Date,
): Promise<RecurringSnapshotItem[]> {
	const rows = await fetchRecurringExpenseMonthRows(db, userId, now);
	return detectRecurringExpenses(rows).map(toSnapshotRecurring);
}
