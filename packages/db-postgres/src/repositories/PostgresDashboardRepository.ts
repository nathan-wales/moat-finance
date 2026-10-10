import type {
	CategorySpend,
	DashboardRepository,
	MonthlyTotals,
} from "@moat/data-access";
import type { DbClient } from "../db-client";

type CategoryBreakdownRow = {
	category: string;
	total: number;
	parentCategory: string | null;
};

type MonthlyRow = {
	year: number;
	month: number;
	type: "INCOME" | "EXPENSE";
	total: number;
};

export class PostgresDashboardRepository implements DashboardRepository {
	constructor(private db: DbClient) {}

	async getCategoryBreakdown(input: {
		userId: string;
		startDate: Date;
		endDate?: Date;
		type?: "INCOME" | "EXPENSE";
	}): Promise<CategorySpend[]> {
		const { userId, startDate, endDate = null, type = null } = input;

		// Use null-coalescing in the query so the template has a fixed shape.
		// Postgres: (null IS NULL) is always true → the condition is skipped.
		const rows = await this.db.$queryRaw<CategoryBreakdownRow[]>`
			SELECT
				COALESCE(o.name, c.name, 'Uncategorized') AS category,
				COALESCE(o."parentCategory"::text, c."parentCategory"::text) AS "parentCategory",
				SUM(t.amount)::float AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t."categoryId" = c.id
			LEFT JOIN "CategoryOverride" o ON o."categoryId" = c.id AND o."userId" = t."userId"
			WHERE
				t."userId" = ${userId}
				AND COALESCE(t."postedDate", t.date) >= ${startDate}
				AND (${endDate}::timestamptz IS NULL OR COALESCE(t."postedDate", t.date) <= ${endDate}::timestamptz)
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND (t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)
				AND NOT EXISTS (
					SELECT 1 FROM "Category" hc
					LEFT JOIN "CategoryOverride" ho
						ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
					WHERE hc.id = t."categoryId"
						AND (
							COALESCE(ho."isRemoved", false) = true
							OR COALESCE(ho."isHidden", hc."isHidden") = true
						)
				)
				AND (${type}::text IS NULL OR t.type::text = ${type}::text)
			GROUP BY 1, 2
			ORDER BY total DESC
		`;

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
		const { userId, startDate, endDate = null } = input;

		const rows = await this.db.$queryRaw<MonthlyRow[]>`
			SELECT
				EXTRACT(year FROM COALESCE(t."postedDate", t.date))::int AS year,
				EXTRACT(month FROM COALESCE(t."postedDate", t.date))::int AS month,
				t.type AS type,
				SUM(t.amount)::float AS total
			FROM "Transaction" t
			WHERE
				t."userId" = ${userId}
				AND COALESCE(t."postedDate", t.date) >= ${startDate}
				AND (${endDate}::timestamptz IS NULL OR COALESCE(t."postedDate", t.date) <= ${endDate}::timestamptz)
				AND t.hidden = false
				AND t."removedAt" IS NULL
				AND (t."splitGroupId" IS NULL OR t."splitParentId" IS NOT NULL)
				AND NOT EXISTS (
					SELECT 1 FROM "Category" hc
					LEFT JOIN "CategoryOverride" ho
						ON ho."categoryId" = hc.id AND ho."userId" = t."userId"
					WHERE hc.id = t."categoryId"
						AND (
							COALESCE(ho."isRemoved", false) = true
							OR COALESCE(ho."isHidden", hc."isHidden") = true
						)
				)
			GROUP BY 1, 2, 3
			ORDER BY 1, 2
		`;

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
}
