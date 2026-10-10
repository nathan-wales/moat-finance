import { applyCategoryOverride } from "@moat/data-access";
import { computeSavingsRate } from "@moat/domain";
import { Prisma, type PrismaClient } from "../../../generated/prisma";
import { CANONICAL_DATE_SQL, transactionScopeSql } from "../transaction-scope";
import {
	getInsightsDateRange,
	usesWeeklyBuckets,
	usesWeeklyBucketsForRange,
} from "./period";
import {
	detectRecurringIncomeSources,
	sumRecurringIncome,
} from "./recurring-income";
import type { IncomeInsightsData, InsightsPeriod } from "./types";

const INCOME_SOURCE_SQL = Prisma.sql`
	COALESCE(
		NULLIF(TRIM(t."merchantName"), ''),
		NULLIF(TRIM(t.description), ''),
		'Unknown'
	)
`;

type IncomeTrendRow = {
	bucket: string;
	total: number;
};

type IncomeSourceRow = {
	source: string;
	total: number;
};

type RecurringIncomeRow = {
	source: string;
	year: number;
	month: number;
	monthly_total: number;
};

type RecentIncomeRow = {
	id: string;
};

export async function getIncomeInsights(
	db: PrismaClient,
	userId: string,
	period: InsightsPeriod,
	now: Date,
	customRange?: { startDate: string; endDate: string },
	incomeCategories?: string[],
): Promise<IncomeInsightsData> {
	const { startDate, endDate } = getInsightsDateRange(period, now, customRange);
	const incomeScope = transactionScopeSql({
		userId,
		startDate,
		endDate,
		type: "INCOME",
		categoryNames: incomeCategories,
	});

	const weekly =
		period === "custom"
			? usesWeeklyBucketsForRange(startDate, endDate)
			: usesWeeklyBuckets(period);
	const trendRows = await db.$queryRaw<IncomeTrendRow[]>(Prisma.sql`
		SELECT
			${
				weekly
					? Prisma.sql`to_char(date_trunc('week', ${CANONICAL_DATE_SQL}), 'YYYY-MM-DD')`
					: Prisma.sql`to_char(date_trunc('month', ${CANONICAL_DATE_SQL}), 'YYYY-MM')`
			} AS bucket,
			SUM(t.amount)::float AS total
		FROM "Transaction" t
		WHERE ${incomeScope}
		GROUP BY 1
		ORDER BY 1
	`);

	const sourceRows = await db.$queryRaw<IncomeSourceRow[]>(Prisma.sql`
		SELECT
			${INCOME_SOURCE_SQL} AS source,
			SUM(t.amount)::float AS total
		FROM "Transaction" t
		WHERE ${incomeScope}
		GROUP BY 1
		ORDER BY 2 DESC
		LIMIT 20
	`);

	const recurringRows = await db.$queryRaw<RecurringIncomeRow[]>(Prisma.sql`
		SELECT
			${INCOME_SOURCE_SQL} AS source,
			EXTRACT(year FROM ${CANONICAL_DATE_SQL})::int AS year,
			EXTRACT(month FROM ${CANONICAL_DATE_SQL})::int AS month,
			SUM(t.amount)::float AS monthly_total
		FROM "Transaction" t
		WHERE ${incomeScope}
		GROUP BY 1, 2, 3
	`);

	const recentRows = await db.$queryRaw<RecentIncomeRow[]>(Prisma.sql`
		SELECT
			t.id
		FROM "Transaction" t
		WHERE ${incomeScope}
		ORDER BY ${CANONICAL_DATE_SQL} DESC
		LIMIT 15
	`);
	const recentIds = recentRows.map((row) => row.id);
	const recentTransactions =
		recentIds.length > 0
			? await db.transaction.findMany({
					where: { id: { in: recentIds } },
					include: {
						hashtags: { include: { hashtag: true } },
						categoryRef: {
							include: { overrides: { where: { userId } } },
						},
						plaidAccount: { select: { name: true } },
					},
				})
			: [];
	const recentOrder = new Map(recentIds.map((id, index) => [id, index]));
	recentTransactions.sort(
		(a, b) => (recentOrder.get(a.id) ?? 0) - (recentOrder.get(b.id) ?? 0),
	);

	const sourceTotals = new Map<string, number>();
	for (const row of sourceRows) {
		sourceTotals.set(row.source, row.total);
	}

	const totalIncome = sourceRows.reduce((sum, row) => sum + row.total, 0);
	const primarySource = sourceRows[0]
		? { name: sourceRows[0].source, amount: sourceRows[0].total }
		: null;

	const recurringGroups = new Map<
		string,
		{ source: string; amounts: number[]; months: Set<string> }
	>();
	for (const row of recurringRows) {
		let group = recurringGroups.get(row.source);
		if (!group) {
			group = { source: row.source, amounts: [], months: new Set() };
			recurringGroups.set(row.source, group);
		}
		group.amounts.push(row.monthly_total);
		group.months.add(`${row.year}-${row.month}`);
	}

	const recurringSources = detectRecurringIncomeSources(recurringGroups);
	const recurringIncome = sumRecurringIncome(sourceTotals, recurringSources);
	const oneTimeIncome = Math.max(0, totalIncome - recurringIncome);

	return {
		totalIncome,
		primarySource,
		recurringIncome,
		oneTimeIncome,
		incomeTrend: trendRows.map((row) => ({
			date: row.bucket,
			amount: row.total,
		})),
		incomeSources: sourceRows.map((row) => ({
			source: row.source,
			amount: row.total,
		})),
		recentIncomeTransactions: recentTransactions.map((transaction) => {
			const override = transaction.categoryRef?.overrides[0] ?? null;
			const resolved = transaction.categoryRef
				? applyCategoryOverride(
						{
							name: transaction.categoryRef.name,
							icon: null,
							isHidden: transaction.categoryRef.isHidden,
							isDefault: transaction.categoryRef.isDefault,
						},
						override,
					)
				: null;
			return {
				id: transaction.id,
				date: (transaction.postedDate ?? transaction.date).toISOString(),
				name:
					transaction.merchantName?.trim() ||
					transaction.description?.trim() ||
					"Unknown",
				description: transaction.description,
				amount: Number(transaction.amount),
				type: transaction.type,
				category: resolved?.name ?? transaction.category,
				categoryRef: transaction.categoryRef
					? {
							id: transaction.categoryRef.id,
							name: resolved?.name ?? transaction.categoryRef.name,
							isHidden: resolved?.isHidden ?? transaction.categoryRef.isHidden,
							isDefault: transaction.categoryRef.isDefault,
						}
					: null,
				account: transaction.account ?? transaction.plaidAccount?.name ?? null,
				accountId: transaction.plaidAccountId ?? null,
				accountName:
					transaction.account ?? transaction.plaidAccount?.name ?? undefined,
				hashtags: transaction.hashtags.map(({ hashtag }) => ({
					hashtag: {
						id: hashtag.id,
						name: hashtag.name,
						normalizedName: hashtag.normalizedName,
					},
				})),
				appliedRuleId: transaction.appliedRuleId ?? null,
				splitGroupId: transaction.splitGroupId ?? null,
				splitParentId: transaction.splitParentId ?? null,
				hidden: transaction.hidden,
				pending: transaction.pending,
				source: transaction.source,
			};
		}),
	};
}

export { computeSavingsRate };
