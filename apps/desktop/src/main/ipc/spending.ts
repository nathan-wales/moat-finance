import { SPENDING_CHANNELS, SpendingQueryInputSchema } from "@moat/contracts";
import { sqliteCategoryNamesFilter } from "@moat/data-access";
import { TX_EFFECTIVE_MS_SQL, TX_MONTH_SQL } from "@moat/db-sqlite";
import {
	detectRecurringExpenses,
	getSpendingBreakdown,
	resolveSpendingDateRange,
	toRecurringExpenseSummary,
} from "@moat/domain";
import { startOfMonth, subMonths } from "date-fns";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

type SqlNumber = number | bigint;

type SpendingTrendRow = {
	month: string;
	category: string;
	total: SqlNumber;
};

type RecurringExpenseMonthlyRow = {
	normalized_description: string;
	month: string;
	monthly_total: SqlNumber;
};

type SpendingAnomalyMonthlyRow = {
	category: string;
	month: string;
	total: SqlNumber;
};

function toNumber(value: SqlNumber | string | null | undefined): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function parseSpendingInput(raw: unknown, defaultMonths: number) {
	if (typeof raw !== "object" || raw === null) {
		return SpendingQueryInputSchema.parse({ months: defaultMonths });
	}

	const payload = raw as {
		months?: unknown;
		startDate?: unknown;
		endDate?: unknown;
		expenseCategories?: unknown;
	};

	return SpendingQueryInputSchema.parse({
		months: typeof payload.months === "number" ? payload.months : defaultMonths,
		startDate: payload.startDate,
		endDate: payload.endDate,
		expenseCategories: payload.expenseCategories,
	});
}

function toSpendingBreakdownInput(
	input: ReturnType<typeof parseSpendingInput>,
	defaultMonths: number,
) {
	if (input.startDate && input.endDate) {
		return {
			startDate: input.startDate,
			endDate: input.endDate,
			expenseCategories: input.expenseCategories,
		};
	}

	return {
		months: input.months ?? defaultMonths,
		expenseCategories: input.expenseCategories,
	};
}

export function registerSpendingHandlers(): void {
	ipcMain.handle(
		SPENDING_CHANNELS.getCategoryBreakdown,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = parseSpendingInput(raw, 3);
			return getSpendingBreakdown(appCtx, toSpendingBreakdownInput(input, 3));
		},
	);

	ipcMain.handle(
		SPENDING_CHANNELS.getCategoryTrends,
		async (_event, raw: unknown) => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const input = parseSpendingInput(raw, 12);
			const { userId } = appCtx;
			const { startDate, endDate } = resolveSpendingDateRange(
				toSpendingBreakdownInput(input, 12),
			);
			const startMs = startDate.getTime();
			const endMs = endDate.getTime();
			const expenseFilter = sqliteCategoryNamesFilter(input.expenseCategories);

			const rows = await db.$queryRawUnsafe<SpendingTrendRow[]>(
				`
				SELECT
					${TX_MONTH_SQL} AS month,
					COALESCE(c.name, 'Uncategorized') AS category,
					SUM(t.amount) AS total
				FROM "Transaction" t
				LEFT JOIN "Category" c ON t.categoryId = c.id
				WHERE
					t.userId = ?
					AND t.type = 'EXPENSE'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
					AND (c.isHidden IS NULL OR c.isHidden = 0)
					${expenseFilter.sql}
				GROUP BY 1, 2
				ORDER BY 1, 2
				`,
				userId,
				startMs,
				endMs,
				...expenseFilter.params,
			);

			const monthGroups = new Map<string, Map<string, number>>();
			const categorySet = new Set<string>();

			for (const row of rows) {
				if (!row.month) continue;
				let cats = monthGroups.get(row.month);
				if (!cats) {
					cats = new Map();
					monthGroups.set(row.month, cats);
				}
				cats.set(row.category, toNumber(row.total));
				categorySet.add(row.category);
			}

			const months = Array.from(monthGroups.entries())
				.sort(([a], [b]) => a.localeCompare(b))
				.map(([month, cats]) => ({
					month,
					...Object.fromEntries(cats),
				}));

			return { months, categories: Array.from(categorySet).sort() };
		},
	);

	ipcMain.handle(
		SPENDING_CHANNELS.getRecurringExpenses,
		async (_event, raw: unknown) => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const input = parseSpendingInput(raw, 6);
			const { userId } = appCtx;
			const months = input.months ?? 6;
			const startDate = startOfMonth(subMonths(new Date(), months - 1));
			const startMs = startDate.getTime();
			const expenseFilter = sqliteCategoryNamesFilter(input.expenseCategories);

			const rows = await db.$queryRawUnsafe<RecurringExpenseMonthlyRow[]>(
				`
				SELECT
					LOWER(TRIM(t.description)) AS normalized_description,
					${TX_MONTH_SQL} AS month,
					SUM(t.amount) AS monthly_total
				FROM "Transaction" t
				WHERE
					t.userId = ?
					AND t.type = 'EXPENSE'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND t.description IS NOT NULL
					${expenseFilter.sql}
				GROUP BY 1, 2
				`,
				userId,
				startMs,
				...expenseFilter.params,
			);

			const detected = detectRecurringExpenses(
				rows.flatMap((row) => {
					if (!row.normalized_description || !row.month) return [];
					return [
						{
							normalizedDescription: row.normalized_description,
							monthKey: row.month,
							monthlyTotal: toNumber(row.monthly_total),
						},
					];
				}),
			);

			return detected.map(toRecurringExpenseSummary).slice(0, 20);
		},
	);

	ipcMain.handle(
		SPENDING_CHANNELS.getAnomalies,
		async (_event, raw: unknown) => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const { userId } = appCtx;
			const input = parseSpendingInput(raw, 6);
			const months = 6;
			const startDate = startOfMonth(subMonths(new Date(), months - 1));
			const currentMonthStart = startOfMonth(new Date());
			const startMs = startDate.getTime();
			const currentMonthKey = currentMonthStart.toISOString().slice(0, 7);
			const expenseFilter = sqliteCategoryNamesFilter(input.expenseCategories);

			const rows = await db.$queryRawUnsafe<SpendingAnomalyMonthlyRow[]>(
				`
			SELECT
				COALESCE(c.name, 'Uncategorized') AS category,
				${TX_MONTH_SQL} AS month,
				SUM(t.amount) AS total
			FROM "Transaction" t
			LEFT JOIN "Category" c ON t.categoryId = c.id
			WHERE
				t.userId = ?
				AND t.type = 'EXPENSE'
				AND t.hidden = 0
				AND t.removedAt IS NULL
				AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
				AND (${TX_EFFECTIVE_MS_SQL}) >= ?
				AND (c.isHidden IS NULL OR c.isHidden = 0)
				${expenseFilter.sql}
			GROUP BY 1, 2
			`,
				userId,
				startMs,
				...expenseFilter.params,
			);

			const catMonthly = new Map<string, Map<string, number>>();
			for (const row of rows) {
				if (!row.month) continue;
				let m = catMonthly.get(row.category);
				if (!m) {
					m = new Map();
					catMonthly.set(row.category, m);
				}
				m.set(row.month, toNumber(row.total));
			}

			const anomalies: {
				category: string;
				currentAmount: number;
				averageAmount: number;
				ratio: number;
			}[] = [];

			for (const [category, monthMap] of catMonthly) {
				const currentAmount = monthMap.get(currentMonthKey) ?? 0;
				if (currentAmount === 0) continue;

				const historicalAmounts = Array.from(monthMap.entries())
					.filter(([m]) => m !== currentMonthKey)
					.map(([, v]) => v);

				if (historicalAmounts.length < 2) continue;

				const avg =
					historicalAmounts.reduce((s, v) => s + v, 0) /
					historicalAmounts.length;

				if (avg > 0 && currentAmount > avg * 1.75) {
					anomalies.push({
						category,
						currentAmount,
						averageAmount: avg,
						ratio: currentAmount / avg,
					});
				}
			}

			return anomalies.sort((a, b) => b.ratio - a.ratio);
		},
	);
}
