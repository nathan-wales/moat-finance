import {
	type BudgetPageData,
	type CategoryBudgetDetail,
	consolidateSmallWhatIfItems,
	DEFAULT_WHAT_IF_BASELINE_MONTHS,
	GetWhatIfBaselineInputSchema,
	MAX_BUDGET_ALERT_THRESHOLD,
} from "@moat/contracts";
import { applyCategoryOverride } from "@moat/data-access";
import {
	getBudgetCategoryDetail,
	getBudgetPageData,
	normalizeBudgetAlertThresholds,
	resolveBudgetAlertCreateState,
	resolveBudgetReportingMonth,
} from "@moat/domain";
import { Decimal } from "@prisma/client/runtime/library";
import { startOfMonth, subMonths } from "date-fns";
import { z } from "zod";
import { getCategorySpendByMonth as getCanonicalCategorySpend } from "../../lib/transaction-scope";
import { createApiAppContext } from "../createApiAppContext";
import {
	type AuthenticatedContext,
	type DemoOrAuthContext,
	withAuth,
	withDemoOrAuth,
} from "../handler-wrappers";
import { getEffectiveNow } from "../lib/reporting-period";

// ─── Input Schemas ────────────────────────────────────────────────────────────

const getPageDataInput = z.object({
	month: z.unknown().optional(),
});

const getCategoryDetailInput = z.object({
	categoryId: z.string().min(1),
	month: z.string().optional(),
});

const upsertCategoryBudgetInput = z.object({
	categoryId: z.string().min(1),
	monthlyGoal: z.number().min(0),
	alertsEnabled: z.boolean().optional(),
	alertThresholds: z
		.array(z.number().int().min(1).max(MAX_BUDGET_ALERT_THRESHOLD))
		.max(8)
		.optional(),
});

// ─── Handler ──────────────────────────────────────────────────────────────────

export const budget = {
	getPageData: withDemoOrAuth(
		async (ctx: DemoOrAuthContext, body: unknown): Promise<BudgetPageData> => {
			const parsed = getPageDataInput.parse(body ?? {});
			const month = typeof parsed.month === "string" ? parsed.month : undefined;
			const resolved = resolveBudgetReportingMonth({
				now: getEffectiveNow(ctx),
				month,
			});
			const appCtx = createApiAppContext(ctx.userId, ctx.db);

			return getBudgetPageData(appCtx, {
				periodStart: resolved.periodStart,
				periodEnd: resolved.periodEnd,
				dayOfMonth: resolved.dayOfMonth,
				daysInMonth: resolved.daysInMonth,
				isCurrentMonth: resolved.isCurrentMonth,
				reportingPeriod: {
					startDate: resolved.startDate,
					endDate: resolved.endDate,
					dayOfMonth: resolved.dayOfMonth,
					daysInMonth: resolved.daysInMonth,
					isDemoSnapshot: ctx.isDemoMode,
				},
			});
		},
	),

	getCategoryDetail: withDemoOrAuth(
		async (
			ctx: DemoOrAuthContext,
			body: unknown,
		): Promise<CategoryBudgetDetail> => {
			const input = getCategoryDetailInput.parse(body);
			const resolved = resolveBudgetReportingMonth({
				now: getEffectiveNow(ctx),
				month: input.month,
			});
			const appCtx = createApiAppContext(ctx.userId, ctx.db);

			return getBudgetCategoryDetail(appCtx, {
				categoryId: input.categoryId,
				referenceDate: resolved.periodStart,
			});
		},
	),

	upsertCategoryBudget: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = upsertCategoryBudgetInput.parse(body);

			// Verify category exists and is accessible
			const category = await ctx.db.category.findFirst({
				where: {
					id: input.categoryId,
					OR: [{ userId: null }, { userId }],
				},
			});

			if (!category) {
				throw new Error("Category not found");
			}

			const override = await ctx.db.categoryOverride.findFirst({
				where: { userId, categoryId: input.categoryId },
				select: { parentCategory: true },
			});
			const parentCategory = applyCategoryOverride(
				{
					name: category.name,
					icon: null,
					isHidden: category.isHidden,
					isDefault: category.userId == null,
					parentCategory: category.parentCategory,
				},
				override,
			).parentCategory;
			const createAlerts = resolveBudgetAlertCreateState({
				categoryName: category.name,
				storedParent: parentCategory,
				alertsEnabled: input.alertsEnabled,
				alertThresholds: input.alertThresholds,
			});
			const alertThresholds =
				input.alertThresholds === undefined
					? undefined
					: normalizeBudgetAlertThresholds(input.alertThresholds);
			const result = await ctx.db.categoryBudget.upsert({
				where: {
					userId_categoryId: { userId, categoryId: input.categoryId },
				},
				update: {
					monthlyGoal: new Decimal(input.monthlyGoal),
					...(input.alertsEnabled !== undefined && {
						alertsEnabled: input.alertsEnabled,
					}),
					...(alertThresholds !== undefined && {
						alertThresholds,
					}),
				},
				create: {
					userId,
					categoryId: input.categoryId,
					monthlyGoal: new Decimal(input.monthlyGoal),
					alertsEnabled: createAlerts.alertsEnabled,
					alertThresholds: createAlerts.alertThresholds,
				},
			});

			return {
				id: result.id,
				categoryId: result.categoryId,
				monthlyGoal: Number(result.monthlyGoal),
				alertsEnabled: result.alertsEnabled,
				alertThresholds: normalizeBudgetAlertThresholds(result.alertThresholds),
			};
		},
	),

	deleteCategoryBudget: withAuth(
		async (ctx: AuthenticatedContext, body: unknown) => {
			const { userId } = ctx;

			const input = getCategoryDetailInput.parse(body);

			await ctx.db.categoryBudget.delete({
				where: {
					userId_categoryId: { userId, categoryId: input.categoryId },
				},
			});

			return { success: true };
		},
	),

	/**
	 * Returns the monthly cash flow baseline for the What-If calculator.
	 * Classifies each budget category as income, expense, savings, or debt
	 * using keyword matching — keeping this business logic on the server
	 * so AI agents and native clients can consume the same baseline.
	 */
	getWhatIfBaseline: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		const { userId } = ctx;

		const parsedMonths = GetWhatIfBaselineInputSchema.safeParse({
			months: ctx.req.query.months,
		});
		const baselineMonths =
			parsedMonths.success && parsedMonths.data.months !== undefined
				? parsedMonths.data.months
				: DEFAULT_WHAT_IF_BASELINE_MONTHS;

		const now = getEffectiveNow(ctx);
		const baselineStart = startOfMonth(subMonths(now, baselineMonths - 1));

		const [categories, budgets, incomeRows, expenseSpendRows] =
			await Promise.all([
				ctx.db.category.findMany({
					where: { OR: [{ userId: null }, { userId }] },
					orderBy: [{ sortOrder: "asc" }, { name: "asc" }],
				}),
				ctx.db.categoryBudget.findMany({ where: { userId } }),
				ctx.db.transaction.groupBy({
					by: ["description"],
					where: {
						userId,
						type: "INCOME",
						hidden: false,
						removedAt: null,
						date: { gte: baselineStart },
					},
					_sum: { amount: true },
				}),
				getCanonicalCategorySpend(ctx.db, {
					userId,
					startDate: baselineStart,
				}),
			]);

		const budgetMap = new Map(budgets.map((b) => [b.categoryId, b]));
		const categoryNameToId = new Map(
			categories.map((c) => [c.name.toLowerCase(), c.id]),
		);
		const categoryNameById = new Map(categories.map((c) => [c.id, c.name]));
		const spendByCategory = new Map<
			string,
			{ categoryName: string; total: number }
		>();

		for (const row of expenseSpendRows) {
			const categoryId =
				categoryNameToId.get(row.categoryName.toLowerCase()) ?? row.categoryId;
			if (!categoryId) continue;

			const existing = spendByCategory.get(categoryId) ?? {
				categoryName: categoryNameById.get(categoryId) ?? row.categoryName,
				total: 0,
			};
			existing.total += row.amount;
			spendByCategory.set(categoryId, existing);
		}

		// ─── Category classification keywords ───────────────────────────────
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

		type MonthlyItemType = "income" | "expense" | "savings" | "debt";
		interface MonthlyLineItem {
			id: string;
			name: string;
			type: MonthlyItemType;
			monthlyAmount: number;
			category?: string;
			isBaseline: boolean;
		}

		function classifyCategory(name: string): MonthlyItemType {
			const lower = name.toLowerCase();
			if (SAVINGS_KEYWORDS.some((k) => lower.includes(k))) return "savings";
			if (DEBT_KEYWORDS.some((k) => lower.includes(k))) return "debt";
			return "expense";
		}

		const baselineItems: MonthlyLineItem[] = [];

		// ─── Income from transactions (N-month average) ──────────────────────
		let totalIncome = 0;
		const incomeByDesc = new Map<string, number>();
		for (const row of incomeRows) {
			if (!row.description) continue;
			const monthlyAvg = Math.round(
				Math.abs(Number(row._sum.amount ?? 0)) / baselineMonths,
			);
			if (monthlyAvg <= 0) continue;
			incomeByDesc.set(
				row.description,
				(incomeByDesc.get(row.description) ?? 0) + monthlyAvg,
			);
		}
		for (const [desc, amount] of incomeByDesc) {
			baselineItems.push({
				id: `income:${desc}`,
				name: desc,
				type: "income",
				monthlyAmount: amount,
				isBaseline: true,
			});
			totalIncome += amount;
		}

		// ─── Expenses from budgets, then recent spend for unbudgeted categories ──
		let totalExpenses = 0;
		let totalSavings = 0;
		let totalDebt = 0;
		const baselineCategoryIds = new Set<string>();

		function addCategoryBaseline(
			categoryId: string,
			categoryName: string,
			monthlyAmount: number,
		) {
			if (monthlyAmount <= 0) return;

			const itemType = classifyCategory(categoryName);
			if (itemType === "savings") totalSavings += monthlyAmount;
			else if (itemType === "debt") totalDebt += monthlyAmount;
			else totalExpenses += monthlyAmount;

			baselineItems.push({
				id: `${itemType}:${categoryId}`,
				name: categoryName,
				type: itemType,
				monthlyAmount,
				category: categoryName,
				isBaseline: true,
			});
			baselineCategoryIds.add(categoryId);
		}

		for (const cat of categories) {
			const budget = budgetMap.get(cat.id);
			const monthlyGoal = budget
				? Math.round(Number(budget.monthlyGoal))
				: null;
			if (!monthlyGoal || monthlyGoal <= 0) continue;

			addCategoryBaseline(cat.id, cat.name, monthlyGoal);
		}

		for (const [categoryId, spend] of spendByCategory) {
			if (baselineCategoryIds.has(categoryId)) continue;

			const monthlyAverage = Math.round(spend.total / baselineMonths);
			addCategoryBaseline(categoryId, spend.categoryName, monthlyAverage);
		}

		const consolidatedItems = consolidateSmallWhatIfItems(baselineItems);

		return {
			baselineItems: consolidatedItems,
			baselineIncome: totalIncome,
			baselineExpenses: totalExpenses,
			baselineSavings: totalSavings,
			baselineDebt: totalDebt,
		};
	}),
};
