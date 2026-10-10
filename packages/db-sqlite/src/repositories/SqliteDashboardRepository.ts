import type {
	CategorySpend,
	DashboardRepository,
	MonthlyTotals,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";
import { TX_EFFECTIVE_MS_SQL, TX_MONTH_SQL } from "./transaction-date-sql";

type CategoryBreakdownRow = {
	category: string;
	total: number;
	parentCategory: string | null;
};

type MonthlyRow = {
	month: string; // YYYY-MM
	type: string; // INCOME | EXPENSE
	total: number;
};

export class SqliteDashboardRepository implements DashboardRepository {
	constructor(private db: SqliteDbClient) {}

	async getCategoryBreakdown(input: {
		userId: string;
		startDate: Date;
		endDate?: Date;
		type?: "INCOME" | "EXPENSE";
	}): Promise<CategorySpend[]> {
		const { userId, startDate, endDate, type } = input;
		const startMs = startDate.getTime();
		const endMs = endDate?.getTime() ?? null;
		const typeFilter = type ?? null;

		const rows = await this.db.$queryRawUnsafe<CategoryBreakdownRow[]>(
			`
			SELECT
				COALESCE(o.name, c.name, 'Uncategorized') AS category,
				COALESCE(o.parentCategory, c.parentCategory) AS parentCategory,
				SUM(t.amount)                     AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			LEFT JOIN CategoryOverride o ON o.categoryId = c.id AND o.userId = t.userId
			WHERE
				t.userId   = ?
				AND t.hidden   = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (? IS NULL OR (${TX_EFFECTIVE_MS_SQL}) <= ?)
				AND (? IS NULL OR t.type = ?)
				AND NOT EXISTS (
					SELECT 1 FROM Category hc
					LEFT JOIN CategoryOverride ho
						ON ho.categoryId = hc.id AND ho.userId = t.userId
					WHERE hc.id = t.categoryId
						AND (
							COALESCE(ho.isRemoved, 0) = 1
							OR COALESCE(ho.isHidden, hc.isHidden) = 1
						)
				)
			GROUP BY 1, 2
			ORDER BY total DESC
			`,
			userId,
			startMs,
			endMs,
			endMs,
			typeFilter,
			typeFilter,
		);

		return rows.map((row) => ({
			category: row.category,
			total: row.total,
			parentCategory:
				(row.parentCategory as CategorySpend["parentCategory"]) ?? null,
		}));
	}

	async getMonthlyTotals(input: {
		userId: string;
		startDate: Date;
		endDate?: Date;
	}): Promise<MonthlyTotals[]> {
		const { userId, startDate, endDate } = input;
		const startMs = startDate.getTime();
		const endMs = endDate?.getTime() ?? null;

		const rows = await this.db.$queryRawUnsafe<MonthlyRow[]>(
			`
			SELECT
				${TX_MONTH_SQL} AS month,
				t.type          AS type,
				SUM(t.amount)   AS total
			FROM "Transaction" t
			WHERE
				t.userId   = ?
				AND t.hidden   = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (? IS NULL OR (${TX_EFFECTIVE_MS_SQL}) <= ?)
				AND NOT EXISTS (
					SELECT 1 FROM Category hc
					LEFT JOIN CategoryOverride ho
						ON ho.categoryId = hc.id AND ho.userId = t.userId
					WHERE hc.id = t.categoryId
						AND (
							COALESCE(ho.isRemoved, 0) = 1
							OR COALESCE(ho.isHidden, hc.isHidden) = 1
						)
				)
			GROUP BY 1, 2
			ORDER BY 1
			`,
			userId,
			startMs,
			endMs,
			endMs,
		);

		const grouped = new Map<string, MonthlyTotals>();
		for (const row of rows) {
			if (!row.month) continue;
			const existing = grouped.get(row.month) ?? {
				month: row.month,
				income: 0,
				expenses: 0,
				net: 0,
			};
			if (row.type === "INCOME") existing.income += row.total;
			else existing.expenses += row.total;
			existing.net = existing.income - existing.expenses;
			grouped.set(row.month, existing);
		}

		return Array.from(grouped.values()).sort((a, b) =>
			a.month.localeCompare(b.month),
		);
	}
}
