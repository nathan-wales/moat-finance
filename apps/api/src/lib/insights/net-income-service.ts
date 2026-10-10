import type { CategoryParent } from "@moat/contracts";
import type { MonthlyTotals } from "@moat/data-access";
import {
	type AppContext,
	computeSavingsRate,
	getNetIncome,
	type NetIncomeSummary,
	summarizeNetIncome,
} from "@moat/domain";
import type { PrismaClient } from "../../../generated/prisma";
import {
	getCategorySpendByMonth,
	getMonthlyTransactionTotals,
} from "../transaction-scope";
import { getInsightsDateRange } from "./period";
import type { InsightsPeriod, NetIncomeInsightsData } from "./types";

function mergeMonthlyTotals(
	incomeRows: MonthlyTotals[],
	expenseRows: MonthlyTotals[],
): MonthlyTotals[] {
	const grouped = new Map<string, MonthlyTotals>();

	for (const row of incomeRows) {
		grouped.set(row.month, {
			month: row.month,
			income: row.income,
			expenses: 0,
			net: row.income,
		});
	}

	for (const row of expenseRows) {
		const existing = grouped.get(row.month);
		if (existing) {
			existing.expenses = row.expenses;
			existing.net = existing.income - existing.expenses;
			continue;
		}
		grouped.set(row.month, {
			month: row.month,
			income: 0,
			expenses: row.expenses,
			net: -row.expenses,
		});
	}

	return Array.from(grouped.values()).sort((left, right) =>
		left.month.localeCompare(right.month),
	);
}

async function getFilteredNetIncomeSummary(
	db: PrismaClient,
	userId: string,
	startDate: Date,
	endDate: Date,
	categoryFilter: {
		incomeCategories?: string[];
		expenseCategories?: string[];
	},
): Promise<NetIncomeSummary> {
	const [incomeRows, expenseRows] = await Promise.all([
		getMonthlyTransactionTotals(db, {
			userId,
			startDate,
			endDate,
			type: "INCOME",
			categoryNames: categoryFilter.incomeCategories,
		}),
		getMonthlyTransactionTotals(db, {
			userId,
			startDate,
			endDate,
			type: "EXPENSE",
			categoryNames: categoryFilter.expenseCategories,
		}),
	]);
	const monthlyTotals = mergeMonthlyTotals(incomeRows, expenseRows);
	return {
		...summarizeNetIncome(monthlyTotals),
		monthlyTotals,
	};
}

export async function getNetIncomeInsights(
	appCtx: AppContext,
	db: PrismaClient,
	period: InsightsPeriod,
	now: Date,
	customRange?: { startDate: string; endDate: string },
	categoryFilter?: {
		incomeCategories?: string[];
		expenseCategories?: string[];
	},
): Promise<NetIncomeInsightsData> {
	const { startDate, endDate } = getInsightsDateRange(period, now, customRange);
	const hasCategoryFilter =
		categoryFilter?.incomeCategories !== undefined ||
		categoryFilter?.expenseCategories !== undefined;

	const summary = hasCategoryFilter
		? await getFilteredNetIncomeSummary(
				db,
				appCtx.userId,
				startDate,
				endDate,
				categoryFilter ?? {},
			)
		: await getNetIncome(appCtx, { startDate, endDate, now });

	const incomeVsSpending = summary.monthlyTotals.map((row) => ({
		date: row.month,
		income: row.income,
		spending: row.expenses,
	}));

	const netIncomeTrend = summary.monthlyTotals.map((row) => ({
		date: row.month,
		netIncome: row.net,
	}));

	const savingsRateTrend = summary.monthlyTotals.map((row) => ({
		date: row.month,
		savingsRate: computeSavingsRate(row.income, row.net),
	}));

	const categoryRows = await getCategorySpendByMonth(db, {
		userId: appCtx.userId,
		startDate,
		endDate,
		type: "EXPENSE",
		categoryNames: categoryFilter?.expenseCategories,
	});

	const categoryTotals = new Map<
		string,
		{ amount: number; parentCategory: CategoryParent | null }
	>();
	for (const row of categoryRows) {
		const existing = categoryTotals.get(row.categoryName);
		if (existing) {
			existing.amount += row.amount;
			continue;
		}
		categoryTotals.set(row.categoryName, {
			amount: row.amount,
			parentCategory: (row.parentCategory as CategoryParent | null) ?? null,
		});
	}

	const spendingBreakdown = Array.from(categoryTotals.entries())
		.map(([category, row]) => ({
			category,
			amount: row.amount,
			parentCategory: row.parentCategory,
		}))
		.filter((row) => row.amount > 0)
		.sort((a, b) => b.amount - a.amount);

	return {
		totalIncome: summary.totalIncome,
		totalSpending: summary.totalSpending,
		netIncome: summary.netIncome,
		savingsRate: summary.savingsRate,
		incomeVsSpending,
		netIncomeTrend,
		savingsRateTrend,
		spendingBreakdown,
	};
}
