import {
	BUDGET_CHANNELS,
	consolidateSmallWhatIfItems,
	DEFAULT_WHAT_IF_BASELINE_MONTHS,
	GetBudgetPageDataInputSchema,
	GetCategoryDetailInputSchema,
	GetWhatIfBaselineInputSchema,
	UpdateCategoryBudgetInputSchema,
} from "@moat/contracts";
import {
	getBudgetCategoryDetail,
	getBudgetPageData,
	resolveBudgetReportingMonth,
} from "@moat/domain";
import { startOfMonth, subMonths } from "date-fns";
import { ipcMain } from "electron";
import { remoteLogger } from "../lib/remote-logger";
import { getUnlockedDesktopDb } from "./vault-guard";

type MonthlyItemType = "income" | "expense" | "savings" | "debt";

const SAVINGS_KEYWORDS = [
	"saving",
	"investment",
	"invest",
	"retirement",
	"401k",
	"403b",
	"ira",
	"roth",
	"pension",
	"brokerage",
	"hsa",
	"emergency",
];

const DEBT_KEYWORDS = [
	"loan",
	"debt",
	"credit card",
	"mortgage",
	"auto loan",
	"student loan",
	"payment",
];

function classifyCategory(name: string): MonthlyItemType {
	const lower = name.toLowerCase();
	if (SAVINGS_KEYWORDS.some((keyword) => lower.includes(keyword))) {
		return "savings";
	}
	if (DEBT_KEYWORDS.some((keyword) => lower.includes(keyword))) return "debt";
	return "expense";
}

export function registerBudgetHandlers(): void {
	ipcMain.handle(BUDGET_CHANNELS.getPageData, async (_event, raw: unknown) => {
		const { appCtx } = getUnlockedDesktopDb();
		const input = GetBudgetPageDataInputSchema.parse(raw ?? {});
		const resolved = resolveBudgetReportingMonth({
			now: new Date(),
			month: input.month,
		});

		return getBudgetPageData(appCtx, {
			periodStart: resolved.periodStart,
			periodEnd: resolved.periodEnd,
			dayOfMonth: resolved.dayOfMonth,
			daysInMonth: resolved.daysInMonth,
			isCurrentMonth: resolved.isCurrentMonth,
			reportingPeriod: {
				dayOfMonth: resolved.dayOfMonth,
				daysInMonth: resolved.daysInMonth,
				startDate: resolved.startDate,
				endDate: resolved.endDate,
				isDemoSnapshot: false,
			},
		});
	});

	ipcMain.handle(
		BUDGET_CHANNELS.getCategoryDetail,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const input = GetCategoryDetailInputSchema.parse(raw);
			const resolved = resolveBudgetReportingMonth({
				now: new Date(),
				month: input.month,
			});
			return getBudgetCategoryDetail(appCtx, {
				categoryId: input.categoryId,
				referenceDate: resolved.periodStart,
			});
		},
	);

	ipcMain.handle(BUDGET_CHANNELS.getWhatIfBaseline, async (_event, raw) => {
		const { appCtx } = getUnlockedDesktopDb();
		const { userId, repositories } = appCtx;
		const input = GetWhatIfBaselineInputSchema.parse(raw ?? {});
		const baselineMonths = input.months ?? DEFAULT_WHAT_IF_BASELINE_MONTHS;
		const now = new Date();
		const baselineStart = startOfMonth(subMonths(now, baselineMonths - 1));
		const monthEnd = new Date(
			now.getFullYear(),
			now.getMonth() + 1,
			0,
			23,
			59,
			59,
		);

		const [categories, spend, incomeSummary] = await Promise.all([
			repositories.budgets.getCategoriesWithBudgets({ userId }),
			repositories.budgets.getCategorySpendForPeriod({
				userId,
				startDate: baselineStart,
				endDate: monthEnd,
			}),
			repositories.transactions.getSummary?.({
				userId,
				startDate: baselineStart,
				endDate: monthEnd,
				type: "INCOME",
			}),
		]);

		const baselineItems: Array<{
			id: string;
			name: string;
			type: MonthlyItemType;
			monthlyAmount: number;
			category?: string;
			isBaseline: boolean;
		}> = [];

		const baselineIncome = Math.round(
			(incomeSummary?.totalIncome ?? 0) / baselineMonths,
		);
		if (baselineIncome > 0) {
			baselineItems.push({
				id: "income:total",
				name: "Total Income",
				type: "income",
				monthlyAmount: baselineIncome,
				isBaseline: true,
			});
		}

		const spendByCategory = new Map(
			spend.map((row) => [row.categoryId ?? row.categoryName, row]),
		);
		const baselineCategoryIds = new Set<string>();
		let baselineExpenses = 0;
		let baselineSavings = 0;
		let baselineDebt = 0;

		function addCategoryBaseline(
			categoryId: string,
			categoryName: string,
			monthlyAmount: number,
		) {
			if (monthlyAmount <= 0) return;
			const type = classifyCategory(categoryName);
			if (type === "savings") baselineSavings += monthlyAmount;
			else if (type === "debt") baselineDebt += monthlyAmount;
			else baselineExpenses += monthlyAmount;

			baselineItems.push({
				id: `${type}:${categoryId}`,
				name: categoryName,
				type,
				monthlyAmount,
				category: categoryName,
				isBaseline: true,
			});
			baselineCategoryIds.add(categoryId);
		}

		for (const category of categories) {
			const monthlyGoal = category.monthlyGoal
				? Math.round(category.monthlyGoal)
				: null;
			if (!monthlyGoal || monthlyGoal <= 0) continue;
			addCategoryBaseline(
				category.categoryId,
				category.categoryName,
				monthlyGoal,
			);
		}

		for (const [categoryId, row] of spendByCategory) {
			if (baselineCategoryIds.has(categoryId)) continue;
			addCategoryBaseline(
				categoryId,
				row.categoryName,
				Math.round(row.total / baselineMonths),
			);
		}

		return {
			baselineItems: consolidateSmallWhatIfItems(baselineItems),
			baselineIncome,
			baselineExpenses,
			baselineSavings,
			baselineDebt,
		};
	});

	ipcMain.handle(
		BUDGET_CHANNELS.updateCategoryBudget,
		async (_event, raw: unknown) => {
			const { appCtx } = getUnlockedDesktopDb();
			const { userId, repositories } = appCtx;
			const input = UpdateCategoryBudgetInputSchema.parse(raw);
			await repositories.budgets.upsertCategoryBudget({
				userId,
				categoryId: input.categoryId,
				monthlyGoal: input.monthlyGoal,
				alertsEnabled: input.alertsEnabled,
				alertThresholds: input.alertThresholds,
			});
			remoteLogger.info("Desktop budget updated", {
				event: "desktop.budget.updated",
				feature: "budget",
				operation: "updateCategoryBudget",
				metadata: {
					hasAlerts: input.alertsEnabled !== undefined,
				},
			});
			return { success: true };
		},
	);
}
