import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppContext } from "../context";
import { getWhatIfBaseline } from "./getWhatIfBaseline";

function makeCtx(options: {
	monthlyIncome?: number;
	categories?: Array<{
		categoryId: string;
		categoryName: string;
		monthlyGoal: number | null;
	}>;
	spend?: Array<{
		categoryId: string | null;
		categoryName: string;
		total: number;
	}>;
}): AppContext {
	return {
		userId: "user-1",
		repositories: {
			dashboard: {
				getMonthlyTotals: async () =>
					options.monthlyIncome
						? [
								{
									month: "2026-09",
									income: options.monthlyIncome,
									expenses: 0,
									net: options.monthlyIncome,
								},
							]
						: [],
				getCategoryBreakdown: async () => [],
			},
			budgets: {
				getCategoriesWithBudgets: async () => options.categories ?? [],
				getCategorySpendForPeriod: async () => options.spend ?? [],
				getCategorySpendByMonth: async () => [],
				getAllCategorySpendByMonth: async () => [],
				upsertCategoryBudget: async () => undefined,
			},
		},
	} as unknown as AppContext;
}

describe("getWhatIfBaseline", () => {
	it("averages income by source and keeps negative amounts as income", async () => {
		const result = await getWhatIfBaseline(makeCtx({}), {
			months: 3,
			now: new Date(2026, 8, 3),
			incomeBySource: [
				{ source: "Payroll", total: 18_000 },
				{ source: "Interest", total: -300 },
			],
		});

		const incomeItems = result.baselineItems.filter(
			(item) => item.type === "income",
		);
		assert.equal(incomeItems.length, 2);
		assert.equal(
			incomeItems.find((item) => item.name === "Payroll")?.monthlyAmount,
			6_000,
		);
		assert.equal(
			incomeItems.find((item) => item.name === "Interest")?.monthlyAmount,
			100,
		);
		assert.equal(result.baselineIncome, 6_100);
	});

	it("falls back to monthly totals as a single income line", async () => {
		const result = await getWhatIfBaseline(makeCtx({ monthlyIncome: 9_000 }), {
			months: 3,
			now: new Date(2026, 8, 3),
		});

		const incomeItems = result.baselineItems.filter(
			(item) => item.type === "income",
		);
		assert.equal(incomeItems.length, 1);
		assert.equal(incomeItems[0]?.name, "Total Income");
		assert.equal(incomeItems[0]?.monthlyAmount, 3_000);
		assert.equal(result.baselineIncome, 3_000);
	});

	it("omits income when the period total rounds to zero", async () => {
		const result = await getWhatIfBaseline(makeCtx({}), {
			months: 6,
			now: new Date(2026, 8, 3),
			incomeBySource: [{ source: "Rounding dust", total: 1 }],
		});

		assert.equal(
			result.baselineItems.filter((item) => item.type === "income").length,
			0,
		);
		assert.equal(result.baselineIncome, 0);
	});

	it("still builds expense baselines from spend when income is empty", async () => {
		const result = await getWhatIfBaseline(
			makeCtx({
				spend: [
					{
						categoryId: "groceries",
						categoryName: "Groceries",
						total: 1_200,
					},
				],
			}),
			{ months: 3, now: new Date(2026, 8, 3) },
		);

		assert.equal(result.baselineIncome, 0);
		assert.equal(result.baselineExpenses, 400);
		assert.equal(
			result.baselineItems.some((item) => item.name === "Groceries"),
			true,
		);
	});
});
