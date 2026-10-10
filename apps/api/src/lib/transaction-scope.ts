/**
 * Canonical transaction filtering and aggregation.
 *
 * Single source of truth for "which Transaction rows count" and "what date
 * does each row belong to". Every chart, table, budget calculation, and
 * spending aggregate must go through here so the numbers agree across
 * surfaces (transactions page, cash flow chart, budget page, AI widgets).
 *
 * Two important rules:
 *
 * 1. The canonical timeline date is `COALESCE(postedDate, date)`. Use this
 *    for both the date range filter AND the month bucket so a row never
 *    falls inside one and outside the other.
 *
 * 2. By default, hidden rows, soft-deleted rows, rows in hidden
 *    categories, and split-parent shells are excluded. Callers must
 *    opt in to include them.
 */

import {
	POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL,
	POSTGRES_HIDDEN_CATEGORY_EXCLUSION_SQL,
	POSTGRES_SPLIT_PARENT_EXCLUSION_SQL,
	splitParentExclusionWhere,
} from "@moat/data-access";
import type { PrismaClient } from "../../generated/prisma";
import { Prisma } from "../../generated/prisma";

export type TransactionWhereInput = Prisma.TransactionWhereInput;

// ─── Types ────────────────────────────────────────────────────────────────────

export type TransactionScope = {
	userId: string;
	/** Inclusive lower bound on canonical date (postedDate ?? date). */
	startDate?: Date;
	/** Inclusive upper bound on canonical date. */
	endDate?: Date;
	type?: "INCOME" | "EXPENSE";
	categoryId?: string;
	/**
	 * Restrict to these resolved category names (case-insensitive).
	 * `undefined` leaves categories unfiltered; `[]` matches nothing.
	 */
	categoryNames?: string[];
	/** Default false — set true only for trash/admin views. */
	includeHidden?: boolean;
	/** Default false — set true only for trash/admin views. */
	includeRemoved?: boolean;
	/** Default false — set true to include rows whose category is hidden. */
	includeHiddenCategory?: boolean;
	/** Default false — set true only for split/unsplit/Plaid identity lookups. */
	includeSplitParents?: boolean;
};

export type MonthlyTotals = {
	month: string; // "YYYY-MM"
	income: number;
	expenses: number;
	net: number;
};

// ─── SQL building blocks ──────────────────────────────────────────────────────

/**
 * The canonical timeline date expression.
 * Always reference the table as `t` when composing with `transactionScopeSql`.
 */
export const CANONICAL_DATE_SQL = Prisma.sql`COALESCE(t."postedDate", t.date)`;

/**
 * Builds a `WHERE` fragment for raw SQL queries against `Transaction t`.
 * Always prefixes columns with `t.` and assumes the FROM clause aliases the
 * Transaction table as `t`. Hidden-category exclusion uses a NOT EXISTS
 * subquery so callers don't need to add a Category join themselves.
 */
export function transactionScopeSql(scope: TransactionScope): Prisma.Sql {
	const parts: Prisma.Sql[] = [Prisma.sql`t."userId" = ${scope.userId}`];

	if (scope.startDate) {
		parts.push(Prisma.sql`${CANONICAL_DATE_SQL} >= ${scope.startDate}`);
	}
	if (scope.endDate) {
		parts.push(Prisma.sql`${CANONICAL_DATE_SQL} <= ${scope.endDate}`);
	}
	if (scope.type) {
		parts.push(Prisma.sql`t.type = ${scope.type}::"TransactionType"`);
	}
	if (scope.categoryId) {
		parts.push(Prisma.sql`t."categoryId" = ${scope.categoryId}`);
	}
	if (scope.categoryNames !== undefined) {
		parts.push(resolvedCategoryNamesMatchSql(scope.categoryNames));
	}
	if (!scope.includeHidden) {
		parts.push(Prisma.sql`t.hidden = false`);
	}
	if (!scope.includeRemoved) {
		parts.push(Prisma.sql`t."removedAt" IS NULL`);
	}
	if (!scope.includeHiddenCategory) {
		parts.push(Prisma.raw(POSTGRES_HIDDEN_CATEGORY_EXCLUSION_SQL));
	}
	if (!scope.includeSplitParents) {
		parts.push(Prisma.raw(POSTGRES_SPLIT_PARENT_EXCLUSION_SQL));
	}

	return Prisma.join(parts, " AND ");
}

/**
 * Builds a Prisma `WhereInput` equivalent to `transactionScopeSql`.
 *
 * Note: Prisma's structured filters can only key off the persisted `date`
 * column, not `COALESCE(postedDate, date)`. Because the Plaid mapping always
 * writes `date := postedDate` and CSV/manual rows have `postedDate IS NULL`
 * (so the coalesce equals `date`), the structured filter matches the SQL
 * filter for every real row. Use `transactionScopeSql` whenever the bucket
 * grouping must also be canonical.
 */
export function buildTransactionWhere(
	scope: TransactionScope,
): Prisma.TransactionWhereInput {
	const where: Prisma.TransactionWhereInput = { userId: scope.userId };

	if (scope.startDate || scope.endDate) {
		where.date = {
			...(scope.startDate && { gte: scope.startDate }),
			...(scope.endDate && { lte: scope.endDate }),
		};
	}
	if (scope.type) where.type = scope.type;
	if (scope.categoryId) where.categoryId = scope.categoryId;
	if (!scope.includeHidden) where.hidden = false;
	if (!scope.includeRemoved) where.removedAt = null;
	const andClauses: Prisma.TransactionWhereInput[] = [];
	if (scope.categoryNames !== undefined) {
		if (scope.categoryNames.length === 0) {
			andClauses.push({ id: { in: [] } });
		} else {
			const namesFilter = buildCategoryNamesFilter(
				scope.categoryNames,
				scope.userId,
			);
			if (namesFilter) andClauses.push(namesFilter);
		}
	}
	if (!scope.includeHiddenCategory) {
		andClauses.push(hiddenCategoryExclusionWhere(scope.userId));
	}
	if (!scope.includeSplitParents) {
		andClauses.push(splitParentExclusionWhere());
	}
	if (andClauses.length > 0) {
		where.AND = andClauses;
	}

	return where;
}

export function mergeTransactionWhere(
	base: Prisma.TransactionWhereInput,
	clauses: Prisma.TransactionWhereInput[],
): Prisma.TransactionWhereInput {
	if (clauses.length === 0) return base;
	const existingAnd = base.AND
		? Array.isArray(base.AND)
			? base.AND
			: [base.AND]
		: [];
	return { ...base, AND: [...existingAnd, ...clauses] };
}

export function hiddenCategoryExclusionWhere(
	userId: string,
): Prisma.TransactionWhereInput {
	return {
		NOT: {
			OR: [
				{
					categoryRef: {
						overrides: {
							some: {
								userId,
								OR: [{ isHidden: true }, { isRemoved: true }],
							},
						},
					},
				},
				{
					AND: [
						{ categoryRef: { isHidden: true } },
						{
							categoryRef: {
								overrides: { none: { userId, isHidden: false } },
							},
						},
					],
				},
			],
		},
	};
}

/**
 * Matches transactions by category name via FK or legacy string column.
 * Must stay in sync with list/count/summary handlers and raw SQL category filters.
 */
export function buildCategoryNameFilter(
	categoryName: string,
	userId?: string,
): TransactionWhereInput {
	const overrideMatch = userId
		? {
				categoryRef: {
					overrides: {
						some: {
							userId,
							name: { equals: categoryName, mode: "insensitive" as const },
						},
					},
				},
			}
		: null;
	return {
		OR: [
			{
				categoryRef: {
					name: { equals: categoryName, mode: "insensitive" },
				},
			},
			...(overrideMatch ? [overrideMatch] : []),
			{
				categoryId: null,
				category: { equals: categoryName, mode: "insensitive" },
			},
		],
	};
}

/**
 * Matches transactions in any of the given category names (OR).
 * Empty input returns undefined so callers can spread conditionally.
 */
export function buildCategoryNamesFilter(
	categoryNames: string[],
	userId?: string,
): TransactionWhereInput | undefined {
	const names = categoryNames
		.map((name) => name.trim())
		.filter((name) => name.length > 0);
	if (names.length === 0) return undefined;
	if (names.length === 1) {
		const only = names[0];
		if (!only) return undefined;
		return buildCategoryNameFilter(only, userId);
	}

	return {
		OR: names.flatMap((categoryName) => {
			const filter = buildCategoryNameFilter(categoryName, userId);
			return filter.OR ?? [];
		}),
	};
}

export function normalizeCategoryFilterNames(
	names: string[] | undefined,
): string[] | undefined {
	if (names === undefined) return undefined;
	return [
		...new Set(
			names
				.map((name) => name.trim().toLowerCase())
				.filter((name) => name.length > 0),
		),
	];
}

/** Display name used by the insights category allow-list. Keep in sync with the match SQL. */
export const RESOLVED_CATEGORY_DISPLAY_NAME_SQL = Prisma.sql`COALESCE(
	(
		SELECT COALESCE(o2.name, c2.name)
		FROM "Category" c2
		LEFT JOIN "CategoryOverride" o2
			ON o2."categoryId" = c2.id AND o2."userId" = t."userId"
		WHERE c2.id = t."categoryId"
	),
	t.category,
	'Uncategorized'
)`;

/**
 * Matches resolved category display names (override, catalog, or legacy string).
 * Empty input matches nothing so callers can represent "no categories selected".
 */
export function resolvedCategoryNamesMatchSql(names: string[]): Prisma.Sql {
	const normalized = normalizeCategoryFilterNames(names) ?? [];
	if (normalized.length === 0) {
		return Prisma.sql`FALSE`;
	}

	return Prisma.sql`LOWER(${RESOLVED_CATEGORY_DISPLAY_NAME_SQL}) IN (${Prisma.join(normalized.map((name) => Prisma.sql`${name}`))})`;
}

export function parseOptionalCategoryNames(
	value: unknown,
): string[] | undefined {
	if (value === undefined) return undefined;
	if (typeof value === "string") {
		return value
			.split(",")
			.map((name) => name.trim())
			.filter((name) => name.length > 0);
	}
	if (!Array.isArray(value)) return undefined;
	return value.flatMap((name) =>
		typeof name === "string"
			? name
					.split(",")
					.map((part) => part.trim())
					.filter((part) => part.length > 0)
			: [],
	);
}

export function resolveCategoryFilterNames(input: {
	category?: string;
	categories?: string[];
}): string[] {
	const names = [...(input.categories ?? [])];
	if (input.category?.trim()) {
		names.push(input.category.trim());
	}
	return [...new Set(names.map((name) => name.trim()).filter(Boolean))];
}

/**
 * Signed net outflow for a category bucket: expenses add, income subtracts.
 */
export function signedCategorySpendAmount(
	type: "INCOME" | "EXPENSE",
	amount: number,
): number {
	return type === "EXPENSE" ? amount : -amount;
}

// ─── Aggregation primitives ───────────────────────────────────────────────────

type MonthlyRow = {
	year: number;
	month: number;
	type: "INCOME" | "EXPENSE";
	total: number;
};

/**
 * Returns one `MonthlyTotals` row per calendar month in the scope's date
 * range, bucketed by canonical date. Months with no activity are omitted.
 */
export async function getMonthlyTransactionTotals(
	db: PrismaClient,
	scope: TransactionScope,
): Promise<MonthlyTotals[]> {
	const where = transactionScopeSql(scope);
	// Prefer $queryRaw(Prisma.sql`...`) over tagged $queryRaw`...${sql}` so nested
	// Sql fragments compose before the client re-wraps args (Next.js dual-runtime).
	const rows = await db.$queryRaw<MonthlyRow[]>(Prisma.sql`
				SELECT
					EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
					EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
					t.type AS type,
					SUM(t.amount)::float AS total
				FROM "Transaction" t
				WHERE ${where}
				GROUP BY 1, 2, 3
				ORDER BY 1, 2
			`);

	const grouped = new Map<string, MonthlyTotals>();
	for (const row of rows) {
		const key = `${row.year}-${String(row.month).padStart(2, "0")}`;
		const existing = grouped.get(key) ?? {
			month: key,
			income: 0,
			expenses: 0,
			net: 0,
		};
		if (row.type === "INCOME") existing.income += row.total;
		else existing.expenses += row.total;
		existing.net = existing.income - existing.expenses;
		grouped.set(key, existing);
	}

	return Array.from(grouped.values()).sort((a, b) =>
		a.month.localeCompare(b.month),
	);
}

type CategoryMonthlyRow = {
	year: number;
	month: number;
	category_id: string | null;
	category_name: string | null;
	parent_category: string | null;
	total: number;
};

export type CategoryMonthlySpend = {
	month: string; // "YYYY-MM"
	categoryId: string | null;
	categoryName: string;
	parentCategory: string | null;
	amount: number;
};

/**
 * Returns net spend totals broken down by (month × category), bucketed by
 * canonical date. Expenses add to the total; income in the same category
 * subtracts (e.g. rental income against Mortgage & Rent).
 */
export async function getCategorySpendByMonth(
	db: PrismaClient,
	scope: TransactionScope,
): Promise<CategoryMonthlySpend[]> {
	const where = transactionScopeSql(scope);
	const rows = await db.$queryRaw<CategoryMonthlyRow[]>(Prisma.sql`
		SELECT
			EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
			EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
			t."categoryId" AS category_id,
			COALESCE(
				NULLIF(
					CASE
						-- Match the canonical row, not the resolved label: a user can
						-- rename Uncategorized away, or rename another category to it.
						WHEN c.name = 'Uncategorized'
							AND t.category IS NOT NULL
							AND btrim(t.category) <> ''
							AND lower(t.category) <> 'uncategorized'
						THEN t.category
						ELSE COALESCE(o.name, c.name)
					END,
					''
				),
				t.category,
				'Uncategorized'
			) AS category_name,
			COALESCE(o."parentCategory"::text, c."parentCategory"::text) AS parent_category,
			SUM(
				CASE
					WHEN t.type = 'EXPENSE' THEN t.amount
					WHEN t.type = 'INCOME' THEN -t.amount
					ELSE 0
				END
			)::float AS total
		FROM "Transaction" t
		LEFT JOIN "Category" c ON c.id = t."categoryId"
		${Prisma.raw(POSTGRES_CATEGORY_OVERRIDE_JOIN_SQL)}
		WHERE ${where}
		GROUP BY 1, 2, 3, 4, 5
		ORDER BY 1, 2
	`);

	return rows.map((row) => ({
		month: `${row.year}-${String(row.month).padStart(2, "0")}`,
		categoryId: row.category_id,
		categoryName: row.category_name ?? "Uncategorized",
		parentCategory: row.parent_category,
		amount: row.total,
	}));
}
