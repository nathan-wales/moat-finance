import { getBudgetStatus, getSpendingBreakdown } from "@moat/domain";
import {
	budgetStatusInputSchema,
	mcpToolContracts,
	spendingBreakdownInputSchema,
} from "@moat/mcp-contracts";
import { endOfMonth, parse, startOfMonth } from "date-fns";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

export const getSpendingBreakdownTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getSpendingBreakdown"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = spendingBreakdownInputSchema.parse(input ?? {});
		const rows = await getSpendingBreakdown(ctx.appRuntime, {
			months: parsed.months,
		});
		const totalSpend = rows.reduce((sum, row) => sum + row.total, 0);

		const breakdown = rows.map((row) => ({
			label: row.category,
			total: row.total,
			monthlyAvg: row.monthlyAvg,
			percentage: row.percentage,
			percentOfTop: row.percentOfTop,
		}));

		return localSchemaEnvelope("spending.breakdown", {
			asOf: new Date().toISOString(),
			months: parsed.months,
			groupBy: parsed.groupBy,
			totalSpend,
			excludedTransferCount: 0,
			periodIncludesPending: false,
			breakdown,
			categories: breakdown.map((row) => ({
				category: row.label,
				total: row.total,
				monthlyAvg: row.monthlyAvg,
				percentage: row.percentage,
				percentOfTop: row.percentOfTop,
			})),
		});
	},
};

export const getBudgetStatusTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getBudgetStatus"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = budgetStatusInputSchema.parse(input ?? {});

		let periodStart: Date;
		let periodEnd: Date;
		let now: Date;

		if (parsed.month) {
			periodStart = parse(`${parsed.month}-01`, "yyyy-MM-dd", new Date());
			periodEnd = endOfMonth(periodStart);
			now = periodEnd;
		} else {
			now = new Date();
			periodStart = startOfMonth(now);
			periodEnd = endOfMonth(now);
		}

		const result = await getBudgetStatus(ctx.appRuntime, {
			periodStart,
			periodEnd,
			dayOfMonth: now.getDate(),
			daysInMonth: periodEnd.getDate(),
		});

		return localSchemaEnvelope("budget.status", {
			month: `${periodStart.getFullYear()}-${String(periodStart.getMonth() + 1).padStart(2, "0")}`,
			totalBudget: result.totalBudget,
			actualSpent: result.actualSpent,
			remaining: result.remaining,
			status: result.status,
			progressPercent: result.progressPercent,
			categories: result.categories.map((category) => ({
				categoryId: category.categoryId,
				categoryName: category.categoryName,
				monthlyGoal: category.monthlyGoal,
				spentThisMonth: category.spentThisMonth,
				remaining:
					category.monthlyGoal === null
						? null
						: category.monthlyGoal - category.spentThisMonth,
				status: category.status,
			})),
		});
	},
};
