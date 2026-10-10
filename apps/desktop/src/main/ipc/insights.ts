import {
	INSIGHTS_CHANNELS,
	InsightsInputSchema,
	type IpcIncomeInsightsData,
	type IpcInsightsCategoryActivity,
	type IpcNetIncomeInsightsData,
} from "@moat/contracts";
import { sqliteCategoryNamesFilter } from "@moat/data-access";
import {
	applyAccountDisplayName,
	loadAccountNameOverrides,
	TX_EFFECTIVE_MS_SQL,
	TX_MONTH_SQL,
	TX_WEEK_SQL,
} from "@moat/db-sqlite";
import {
	computeSavingsRate,
	getNetIncome,
	summarizeNetIncome,
} from "@moat/domain";
import {
	differenceInCalendarDays,
	endOfDay,
	endOfMonth,
	endOfWeek,
	parseISO,
	startOfDay,
	startOfMonth,
	startOfWeek,
	subMonths,
	subWeeks,
} from "date-fns";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

const INSIGHTS_WEEK_STARTS_ON = 1 as const;

type InsightsPeriod =
	| "this-week"
	| "last-week"
	| "this-month"
	| "last-month"
	| "1m"
	| "2m"
	| "3m"
	| "6m"
	| "12m"
	| "custom";

function isInsightsWeekPeriod(
	period: InsightsPeriod,
): period is "this-week" | "last-week" {
	return period === "this-week" || period === "last-week";
}

function periodToMonths(period: InsightsPeriod): number {
	if (period === "custom" || isInsightsWeekPeriod(period)) return 1;
	const map: Record<
		Exclude<InsightsPeriod, "custom" | "this-week" | "last-week">,
		number
	> = {
		"this-month": 1,
		"last-month": 1,
		"1m": 1,
		"2m": 2,
		"3m": 3,
		"6m": 6,
		"12m": 12,
	};
	return map[period];
}

function resolveInsightsDateRange(input: {
	period: InsightsPeriod;
	startDate?: string;
	endDate?: string;
}) {
	if (input.period === "custom") {
		if (!input.startDate || !input.endDate) {
			throw new Error("Custom insights period requires startDate and endDate");
		}

		const startDate = startOfDay(parseISO(input.startDate));
		const endDate = endOfDay(parseISO(input.endDate));
		return {
			startMs: startDate.getTime(),
			endMs: endDate.getTime(),
		};
	}

	const now = new Date();
	if (isInsightsWeekPeriod(input.period)) {
		if (input.period === "last-week") {
			const lastWeek = subWeeks(now, 1);
			return {
				startMs: startOfWeek(lastWeek, {
					weekStartsOn: INSIGHTS_WEEK_STARTS_ON,
				}).getTime(),
				endMs: endOfDay(
					endOfWeek(lastWeek, { weekStartsOn: INSIGHTS_WEEK_STARTS_ON }),
				).getTime(),
			};
		}

		return {
			startMs: startOfWeek(now, {
				weekStartsOn: INSIGHTS_WEEK_STARTS_ON,
			}).getTime(),
			endMs: endOfDay(now).getTime(),
		};
	}

	if (input.period === "last-month") {
		const lastMonth = subMonths(now, 1);
		const startDate = startOfMonth(lastMonth);
		const endDate = endOfDay(endOfMonth(lastMonth));
		return {
			startMs: startDate.getTime(),
			endMs: endDate.getTime(),
		};
	}

	const months = periodToMonths(input.period);
	const startDate = startOfMonth(subMonths(now, months - 1));
	return {
		startMs: startDate.getTime(),
		endMs: endOfDay(now).getTime(),
	};
}

function usesWeeklyBuckets(period: InsightsPeriod): boolean {
	return (
		isInsightsWeekPeriod(period) ||
		period === "this-month" ||
		period === "last-month" ||
		period === "1m" ||
		period === "2m" ||
		period === "3m"
	);
}

function usesWeeklyBucketsForRange(startMs: number, endMs: number): boolean {
	return differenceInCalendarDays(new Date(endMs), new Date(startMs)) <= 93;
}

type SqlNumber = number | bigint;

function toNumber(value: SqlNumber | string | null | undefined): number {
	if (typeof value === "number") return Number.isFinite(value) ? value : 0;
	if (typeof value === "bigint") return Number(value);
	if (typeof value === "string") {
		const parsed = Number(value);
		return Number.isFinite(parsed) ? parsed : 0;
	}
	return 0;
}

function parseInsightsInput(raw: unknown) {
	if (typeof raw !== "object" || raw === null) {
		return InsightsInputSchema.parse({});
	}

	const payload = raw as {
		period?: unknown;
		startDate?: unknown;
		endDate?: unknown;
		incomeCategories?: unknown;
		expenseCategories?: unknown;
	};

	return InsightsInputSchema.parse({
		period: payload.period,
		startDate: payload.startDate,
		endDate: payload.endDate,
		incomeCategories: payload.incomeCategories,
		expenseCategories: payload.expenseCategories,
	});
}

type MonthlyTotalRow = {
	month: string;
	type: string;
	total: SqlNumber;
};

async function queryMonthlyTotalsByType(
	db: {
		$queryRawUnsafe: <T>(sql: string, ...params: unknown[]) => Promise<T>;
	},
	userId: string,
	startMs: number,
	endMs: number,
	type: "INCOME" | "EXPENSE",
	categoryNames?: string[],
) {
	const categoryFilter = sqliteCategoryNamesFilter(categoryNames);
	return db.$queryRawUnsafe<MonthlyTotalRow[]>(
		`
		SELECT
			${TX_MONTH_SQL} AS month,
			t.type AS type,
			SUM(t.amount) AS total
		FROM "Transaction" t
		WHERE
			t.userId = ?
			AND t.type = ?
			AND t.hidden = 0
			AND t.removedAt IS NULL
			AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
			AND (${TX_EFFECTIVE_MS_SQL}) >= ?
			AND (${TX_EFFECTIVE_MS_SQL}) <= ?
			${categoryFilter.sql}
		GROUP BY 1, 2
		ORDER BY 1
		`,
		userId,
		type,
		startMs,
		endMs,
		...categoryFilter.params,
	);
}

function detectRecurringSources(
	groups: Map<string, { amounts: number[]; months: Set<string> }>,
): Set<string> {
	const recurring = new Set<string>();
	for (const [source, group] of groups) {
		if (group.months.size < 2) continue;
		const avg =
			group.amounts.reduce((sum, amount) => sum + amount, 0) /
			group.amounts.length;
		if (avg <= 0) continue;
		const isStable = group.amounts.every(
			(amount) => Math.abs(amount - avg) / avg < 0.15,
		);
		if (isStable) recurring.add(source);
	}
	return recurring;
}

export function registerInsightsHandlers(): void {
	ipcMain.handle(
		INSIGHTS_CHANNELS.getIncomeInsights,
		async (_event, raw: unknown): Promise<IpcIncomeInsightsData> => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const input = parseInsightsInput(raw);
			const { startMs, endMs } = resolveInsightsDateRange(input);
			const incomeFilter = sqliteCategoryNamesFilter(input.incomeCategories);
			const weekly =
				input.period === "custom"
					? usesWeeklyBucketsForRange(startMs, endMs)
					: usesWeeklyBuckets(input.period);

			type TrendRow = { bucket: string; total: SqlNumber };
			type SourceRow = { source: string; total: SqlNumber };
			type RecurringRow = {
				source: string;
				month: string;
				monthly_total: SqlNumber;
			};
			type RecentRow = {
				id: string;
				date_ms: SqlNumber;
				name: string;
				amount: SqlNumber;
				account_name: string | null;
				plaid_account_id: string | null;
				category_name: string | null;
			};

			const trendRows = weekly
				? await db.$queryRawUnsafe<TrendRow[]>(
						`
					SELECT
						${TX_WEEK_SQL} AS bucket,
						SUM(t.amount) AS total
					FROM "Transaction" t
					WHERE
						t.userId = ?
						AND t.type = 'INCOME'
						AND t.hidden = 0
						AND t.removedAt IS NULL
						AND (${TX_EFFECTIVE_MS_SQL}) >= ?
						AND (${TX_EFFECTIVE_MS_SQL}) <= ?
						${incomeFilter.sql}
					GROUP BY 1
					ORDER BY 1
					`,
						appCtx.userId,
						startMs,
						endMs,
						...incomeFilter.params,
					)
				: await db.$queryRawUnsafe<TrendRow[]>(
						`
					SELECT
						${TX_MONTH_SQL} AS bucket,
						SUM(t.amount) AS total
					FROM "Transaction" t
					WHERE
						t.userId = ?
						AND t.type = 'INCOME'
						AND t.hidden = 0
						AND t.removedAt IS NULL
						AND (${TX_EFFECTIVE_MS_SQL}) >= ?
						AND (${TX_EFFECTIVE_MS_SQL}) <= ?
						${incomeFilter.sql}
					GROUP BY 1
					ORDER BY 1
					`,
						appCtx.userId,
						startMs,
						endMs,
						...incomeFilter.params,
					);

			const sourceRows = await db.$queryRawUnsafe<SourceRow[]>(
				`
				SELECT
					COALESCE(
						NULLIF(TRIM(t.merchantName), ''),
						NULLIF(TRIM(t.description), ''),
						'Unknown'
					) AS source,
					SUM(t.amount) AS total
				FROM "Transaction" t
				WHERE
					t.userId = ?
					AND t.type = 'INCOME'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
					${incomeFilter.sql}
				GROUP BY 1
				ORDER BY 2 DESC
				LIMIT 20
				`,
				appCtx.userId,
				startMs,
				endMs,
				...incomeFilter.params,
			);

			const recurringRows = await db.$queryRawUnsafe<RecurringRow[]>(
				`
				SELECT
					COALESCE(
						NULLIF(TRIM(t.merchantName), ''),
						NULLIF(TRIM(t.description), ''),
						'Unknown'
					) AS source,
					${TX_MONTH_SQL} AS month,
					SUM(t.amount) AS monthly_total
				FROM "Transaction" t
				WHERE
					t.userId = ?
					AND t.type = 'INCOME'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
					${incomeFilter.sql}
				GROUP BY 1, 2
				`,
				appCtx.userId,
				startMs,
				endMs,
				...incomeFilter.params,
			);

			const [recentRows, nameOverrides] = await Promise.all([
				db.$queryRawUnsafe<RecentRow[]>(
					`
				SELECT
					t.id,
					(${TX_EFFECTIVE_MS_SQL}) AS date_ms,
					COALESCE(
						NULLIF(TRIM(t.merchantName), ''),
						NULLIF(TRIM(t.description), ''),
						'Unknown'
					) AS name,
					t.amount,
					COALESCE(a.name, pa.name) AS account_name,
					pa.id AS plaid_account_id,
					c.name AS category_name
				FROM "Transaction" t
				LEFT JOIN "Category" c ON t.categoryId = c.id
				LEFT JOIN "Account" a ON t.accountId = a.id
				LEFT JOIN "PlaidAccount" pa ON t.plaidAccountId = pa.id
				WHERE
					t.userId = ?
					AND t.type = 'INCOME'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
					${incomeFilter.sql}
				ORDER BY (${TX_EFFECTIVE_MS_SQL}) DESC
				LIMIT 15
				`,
					appCtx.userId,
					startMs,
					endMs,
					...incomeFilter.params,
				),
				loadAccountNameOverrides(db, appCtx.userId),
			]);

			const sourceTotals = new Map<string, number>();
			for (const row of sourceRows) {
				sourceTotals.set(row.source, toNumber(row.total));
			}

			const totalIncome = sourceRows.reduce(
				(sum, row) => sum + toNumber(row.total),
				0,
			);
			const primarySource = sourceRows[0]
				? { name: sourceRows[0].source, amount: toNumber(sourceRows[0].total) }
				: null;

			const recurringGroups = new Map<
				string,
				{ amounts: number[]; months: Set<string> }
			>();
			for (const row of recurringRows) {
				let group = recurringGroups.get(row.source);
				if (!group) {
					group = { amounts: [], months: new Set() };
					recurringGroups.set(row.source, group);
				}
				group.amounts.push(toNumber(row.monthly_total));
				group.months.add(row.month);
			}

			const recurringSources = detectRecurringSources(recurringGroups);
			let recurringIncome = 0;
			for (const [source, amount] of sourceTotals) {
				if (recurringSources.has(source)) recurringIncome += amount;
			}

			return {
				totalIncome,
				primarySource,
				recurringIncome,
				oneTimeIncome: Math.max(0, totalIncome - recurringIncome),
				incomeTrend: trendRows.map((row) => ({
					date: row.bucket,
					amount: toNumber(row.total),
				})),
				incomeSources: sourceRows.map((row) => ({
					source: row.source,
					amount: toNumber(row.total),
				})),
				recentIncomeTransactions: recentRows.map((row) => ({
					id: row.id,
					date: new Date(toNumber(row.date_ms)).toISOString(),
					name: row.name,
					amount: toNumber(row.amount),
					accountName:
						applyAccountDisplayName(
							row.account_name,
							row.plaid_account_id,
							nameOverrides,
						) ?? undefined,
					category: row.category_name ?? undefined,
				})),
			};
		},
	);

	ipcMain.handle(
		INSIGHTS_CHANNELS.getNetIncomeInsights,
		async (_event, raw: unknown): Promise<IpcNetIncomeInsightsData> => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const input = parseInsightsInput(raw);
			const { startMs, endMs } = resolveInsightsDateRange(input);
			const startDate = new Date(startMs);
			const endDate = new Date(endMs);
			const hasCategoryFilter =
				input.incomeCategories !== undefined ||
				input.expenseCategories !== undefined;

			const summary = hasCategoryFilter
				? await (async () => {
						const [incomeRows, expenseRows] = await Promise.all([
							queryMonthlyTotalsByType(
								db,
								appCtx.userId,
								startMs,
								endMs,
								"INCOME",
								input.incomeCategories,
							),
							queryMonthlyTotalsByType(
								db,
								appCtx.userId,
								startMs,
								endMs,
								"EXPENSE",
								input.expenseCategories,
							),
						]);
						const grouped = new Map<
							string,
							{ month: string; income: number; expenses: number; net: number }
						>();
						for (const row of incomeRows) {
							if (!row.month) continue;
							grouped.set(row.month, {
								month: row.month,
								income: toNumber(row.total),
								expenses: 0,
								net: toNumber(row.total),
							});
						}
						for (const row of expenseRows) {
							if (!row.month) continue;
							const existing = grouped.get(row.month);
							const expenses = toNumber(row.total);
							if (existing) {
								existing.expenses = expenses;
								existing.net = existing.income - expenses;
								continue;
							}
							grouped.set(row.month, {
								month: row.month,
								income: 0,
								expenses,
								net: -expenses,
							});
						}
						const monthlyTotals = Array.from(grouped.values()).sort(
							(left, right) => left.month.localeCompare(right.month),
						);
						return {
							...summarizeNetIncome(monthlyTotals),
							monthlyTotals,
						};
					})()
				: await getNetIncome(appCtx, { startDate, endDate });

			type CategoryRow = {
				category: string;
				amount: SqlNumber;
				parentCategory: string | null;
			};

			const expenseFilter = sqliteCategoryNamesFilter(input.expenseCategories);
			const categoryRows = await db.$queryRawUnsafe<CategoryRow[]>(
				`
				SELECT
					COALESCE(o.name, c.name, 'Uncategorized') AS category,
					COALESCE(o.parentCategory, c.parentCategory) AS parentCategory,
					SUM(t.amount) AS amount
				FROM "Transaction" t
				LEFT JOIN "Category" c ON t.categoryId = c.id
				LEFT JOIN CategoryOverride o ON o.categoryId = c.id AND o.userId = t.userId
				WHERE
					t.userId = ?
					AND t.type = 'EXPENSE'
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
					${expenseFilter.sql}
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
				ORDER BY 3 DESC
				`,
				appCtx.userId,
				startMs,
				endMs,
				...expenseFilter.params,
			);

			return {
				totalIncome: summary.totalIncome,
				totalSpending: summary.totalSpending,
				netIncome: summary.netIncome,
				savingsRate: summary.savingsRate,
				incomeVsSpending: summary.monthlyTotals.map((row) => ({
					date: row.month,
					income: row.income,
					spending: row.expenses,
				})),
				netIncomeTrend: summary.monthlyTotals.map((row) => ({
					date: row.month,
					netIncome: row.net,
				})),
				savingsRateTrend: summary.monthlyTotals.map((row) => ({
					date: row.month,
					savingsRate: computeSavingsRate(row.income, row.net),
				})),
				spendingBreakdown: categoryRows.map((row) => ({
					category: row.category,
					amount: toNumber(row.amount),
					parentCategory:
						(row.parentCategory as
							| "FIXED"
							| "FLEXIBLE"
							| "NON_MONTHLY"
							| null) ?? null,
				})),
			};
		},
	);

	ipcMain.handle(
		INSIGHTS_CHANNELS.getCategoryActivity,
		async (_event, raw: unknown): Promise<IpcInsightsCategoryActivity> => {
			const { appCtx, db } = getUnlockedDesktopDb();
			const input = parseInsightsInput(raw);
			const { startMs, endMs } = resolveInsightsDateRange(input);
			type ActivityRow = {
				type: string;
				category_name: string | null;
			};
			const rows = await db.$queryRawUnsafe<ActivityRow[]>(
				`
				SELECT
					t.type AS type,
					COALESCE(
						(
							SELECT COALESCE(o2.name, c2.name)
							FROM Category c2
							LEFT JOIN CategoryOverride o2
								ON o2.categoryId = c2.id AND o2.userId = t.userId
							WHERE c2.id = t.categoryId
						),
						'Uncategorized'
					) AS category_name
				FROM "Transaction" t
				WHERE
					t.userId = ?
					AND t.hidden = 0
					AND t.removedAt IS NULL
					AND (t.splitGroupId IS NULL OR t.splitParentId IS NOT NULL)
					AND (${TX_EFFECTIVE_MS_SQL}) >= ?
					AND (${TX_EFFECTIVE_MS_SQL}) <= ?
				GROUP BY 1, 2
				`,
				appCtx.userId,
				startMs,
				endMs,
			);

			const income = new Set<string>();
			const expense = new Set<string>();
			for (const row of rows) {
				const name = row.category_name?.trim();
				if (!name) continue;
				if (row.type === "INCOME") income.add(name);
				else expense.add(name);
			}

			return {
				income: [...income],
				expense: [...expense],
			};
		},
	);
}
