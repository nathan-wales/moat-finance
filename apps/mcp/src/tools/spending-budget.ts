import { resolveBudgetAlertCreateState } from "@moat/domain";
import type {
	BudgetStatusInput,
	DeleteCategoryBudgetInput,
	SpendingBreakdownInput,
	UpsertCategoryBudgetInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import { resolveCategoryByIdOrName } from "./category-utils";
import { schemaEnvelope, toNumber } from "./format";
import { splitParentExclusionWhere } from "./split-parent-exclusion";
import type { McpToolImplementation } from "./types";

export const getSpendingBreakdownTool: McpToolImplementation<SpendingBreakdownInput> =
	{
		contract: mcpToolContracts["moat.getSpendingBreakdown"],
		async execute(input, context) {
			const startDate = startOfMonth(subMonths(new Date(), input.months - 1));
			const transactions = await context.db.transaction.findMany({
				where: {
					userId: context.userId,
					type: "EXPENSE",
					hidden: false,
					removedAt: null,
					pending: false,
					date: { gte: startDate },
					AND: [splitParentExclusionWhere],
				},
				select: {
					amount: true,
					category: true,
					merchantName: true,
					account: true,
					categoryRef: { select: { name: true } },
					plaidAccount: { select: { name: true } },
				},
			});

			const totals = new Map<string, { total: number; count: number }>();
			let excludedTransfers = 0;
			for (const transaction of transactions) {
				const categoryName =
					transaction.categoryRef?.name ??
					transaction.category ??
					"Uncategorized";
				if (categoryName.trim().toLowerCase() === "transfer") {
					excludedTransfers += 1;
					continue;
				}

				const key =
					input.groupBy === "merchant"
						? transaction.merchantName?.trim() ||
							transaction.account ||
							"Unknown merchant"
						: input.groupBy === "account"
							? (transaction.plaidAccount?.name ??
								transaction.account ??
								"Unknown account")
							: categoryName;

				const amount = toNumber(transaction.amount) ?? 0;
				const current = totals.get(key) ?? { total: 0, count: 0 };
				current.total += amount;
				current.count += 1;
				totals.set(key, current);
			}

			const breakdown = Array.from(totals.entries())
				.map(([label, row]) => ({
					label,
					total: row.total,
					count: row.count,
				}))
				.filter((row) => row.total > 0)
				.sort((left, right) => right.total - left.total);
			const totalSpend = breakdown.reduce((sum, row) => sum + row.total, 0);
			const topTotal = breakdown[0]?.total ?? 1;

			return schemaEnvelope("spending.breakdown", {
				asOf: new Date().toISOString(),
				months: input.months,
				groupBy: input.groupBy,
				totalSpend,
				excludedTransferCount: excludedTransfers,
				periodIncludesPending: false,
				breakdown: breakdown.map((row) => ({
					...row,
					monthlyAvg: row.total / input.months,
					percentage: totalSpend > 0 ? (row.total / totalSpend) * 100 : 0,
					percentOfTop: topTotal > 0 ? (row.total / topTotal) * 100 : 0,
				})),
				// Backward-compatible alias for existing clients.
				categories: breakdown.map((row) => ({
					category: row.label,
					total: row.total,
					count: row.count,
					monthlyAvg: row.total / input.months,
					percentage: totalSpend > 0 ? (row.total / totalSpend) * 100 : 0,
					percentOfTop: topTotal > 0 ? (row.total / topTotal) * 100 : 0,
				})),
			});
		},
	};

function parseBudgetMonth(month: string | undefined) {
	if (!month) return startOfMonth(new Date());
	const [year, monthNumber] = month.split("-").map(Number);
	if (!year || !monthNumber) return startOfMonth(new Date());
	return startOfMonth(new Date(year, monthNumber - 1, 1));
}

function statusFor(spent: number, goal: number | null) {
	if (goal === null) return spent > 0 ? "unknown" : "no-spend";
	if (spent === 0) return "no-spend";
	if (spent > goal) return "overspending";
	if (spent / goal >= 0.8) return "close-to-budget";
	return "on-track";
}

export const getBudgetStatusTool: McpToolImplementation<BudgetStatusInput> = {
	contract: mcpToolContracts["moat.getBudgetStatus"],
	async execute(input, context) {
		const monthStart = parseBudgetMonth(input.month);
		const monthEnd = endOfMonth(monthStart);
		const [budgets, spendRows] = await Promise.all([
			context.db.categoryBudget.findMany({
				where: { userId: context.userId },
				include: { category: true },
			}),
			context.db.transaction.groupBy({
				by: ["categoryId", "category"],
				where: {
					userId: context.userId,
					type: "EXPENSE",
					hidden: false,
					removedAt: null,
					date: { gte: monthStart, lte: monthEnd },
					AND: [splitParentExclusionWhere],
				},
				_sum: { amount: true },
			}),
		]);

		const budgetByCategoryId = new Map(
			budgets.map((budget) => [budget.categoryId, budget]),
		);
		const rows = spendRows.map((row) => {
			const budget = row.categoryId
				? budgetByCategoryId.get(row.categoryId)
				: undefined;
			const spent = toNumber(row._sum.amount) ?? 0;
			const monthlyGoal = budget ? toNumber(budget.monthlyGoal) : null;
			return {
				categoryId: row.categoryId ?? "uncategorized",
				categoryName: budget?.category.name ?? row.category ?? "Uncategorized",
				monthlyGoal,
				spentThisMonth: spent,
				remaining: monthlyGoal === null ? null : monthlyGoal - spent,
				status: statusFor(spent, monthlyGoal),
			};
		});

		for (const budget of budgets) {
			if (rows.some((row) => row.categoryId === budget.categoryId)) continue;
			const monthlyGoal = toNumber(budget.monthlyGoal) ?? 0;
			rows.push({
				categoryId: budget.categoryId,
				categoryName: budget.category.name,
				monthlyGoal,
				spentThisMonth: 0,
				remaining: monthlyGoal,
				status: "no-spend",
			});
		}

		const totalBudget = rows.reduce(
			(sum, row) => sum + (row.monthlyGoal ?? 0),
			0,
		);
		const actualSpent = rows.reduce((sum, row) => sum + row.spentThisMonth, 0);

		return schemaEnvelope("budget.status", {
			month: monthStart.toISOString().slice(0, 7),
			totalBudget,
			actualSpent,
			remaining: totalBudget - actualSpent,
			progressPercent:
				totalBudget > 0 ? Math.min(100, (actualSpent / totalBudget) * 100) : 0,
			status: statusFor(actualSpent, totalBudget > 0 ? totalBudget : null),
			categories: rows.sort(
				(left, right) => right.spentThisMonth - left.spentThisMonth,
			),
		});
	},
};

export const upsertCategoryBudgetTool: McpToolImplementation<UpsertCategoryBudgetInput> =
	{
		contract: mcpToolContracts["moat.setCategoryBudget"],
		async execute(input, context) {
			const category = await resolveCategoryByIdOrName(context, input);
			const [row, override] = await Promise.all([
				context.db.category.findFirst({
					where: { id: category.id },
					select: { name: true, parentCategory: true },
				}),
				context.db.categoryOverride.findFirst({
					where: { userId: context.userId, categoryId: category.id },
					select: { parentCategory: true },
				}),
			]);
			const createAlerts = resolveBudgetAlertCreateState({
				categoryName: row?.name ?? category.name,
				storedParent: override?.parentCategory ?? row?.parentCategory,
			});
			const result = await context.db.categoryBudget.upsert({
				where: {
					userId_categoryId: {
						userId: context.userId,
						categoryId: category.id,
					},
				},
				update: {
					monthlyGoal: input.monthlyGoal,
				},
				create: {
					userId: context.userId,
					categoryId: category.id,
					monthlyGoal: input.monthlyGoal,
					alertsEnabled: createAlerts.alertsEnabled,
					alertThresholds: createAlerts.alertThresholds,
				},
			});

			return schemaEnvelope("budget.upserted", {
				id: result.id,
				categoryId: result.categoryId,
				categoryName: category.name,
				monthlyGoal: toNumber(result.monthlyGoal) ?? input.monthlyGoal,
			});
		},
	};

export const deleteCategoryBudgetTool: McpToolImplementation<DeleteCategoryBudgetInput> =
	{
		contract: mcpToolContracts["moat.deleteCategoryBudget"],
		async execute(input, context) {
			const category = await resolveCategoryByIdOrName(context, input);
			const result = await context.db.categoryBudget.deleteMany({
				where: {
					userId: context.userId,
					categoryId: category.id,
				},
			});
			if (result.count === 0) {
				throw new Error("Category budget not found");
			}

			return schemaEnvelope("budget.deleted", {
				categoryId: category.id,
				categoryName: category.name,
				success: true,
			});
		},
	};
