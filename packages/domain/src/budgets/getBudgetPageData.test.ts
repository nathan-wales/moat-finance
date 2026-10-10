import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AppContext } from "../context";
import { getBudgetPageData } from "./getBudgetPageData";

function makeCtx(options: {
	categories: Array<{
		categoryId: string;
		categoryName: string;
		monthlyGoal: number | null;
		parentCategory?: "FIXED" | "FLEXIBLE" | "NON_MONTHLY" | null;
		alertsEnabled?: boolean | null;
		alertThresholds?: number[] | null;
	}>;
	spend: Array<{
		categoryId: string | null;
		categoryName: string;
		total: number;
	}>;
	monthlySpend?: Array<{
		categoryId: string;
		month: string;
		amount: number;
	}>;
}): AppContext {
	return {
		userId: "user-1",
		repositories: {
			budgets: {
				getCategoriesWithBudgets: async () =>
					options.categories.map((category) => ({
						...category,
						parentCategory: category.parentCategory ?? null,
						alertsEnabled:
							category.alertsEnabled ??
							(category.monthlyGoal !== null ? true : null),
						alertThresholds:
							category.alertThresholds ??
							(category.monthlyGoal !== null ? [75, 100] : null),
					})),
				getCategorySpendForPeriod: async () => options.spend,
				getCategorySpendByMonth: async () => [],
				getAllCategorySpendByMonth: async () => options.monthlySpend ?? [],
				upsertCategoryBudget: async () => undefined,
			},
		},
	} as unknown as AppContext;
}

const periodStart = new Date(2026, 8, 1);
const periodEnd = new Date(2026, 8, 30, 23, 59, 59);
const input = {
	periodStart,
	periodEnd,
	dayOfMonth: 3,
	daysInMonth: 30,
	reportingPeriod: {
		startDate: "2026-09-01",
		endDate: "2026-09-30",
		dayOfMonth: 3,
		daysInMonth: 30,
		isDemoSnapshot: false,
	},
};

describe("getBudgetPageData", () => {
	it("fills a derived goal for a category with only prior-month spend", async () => {
		const result = await getBudgetPageData(
			makeCtx({
				categories: [
					{
						categoryId: "sports",
						categoryName: "Sports & Fitness",
						monthlyGoal: null,
					},
				],
				spend: [],
				monthlySpend: [{ categoryId: "sports", month: "2026-08", amount: 274 }],
			}),
			input,
		);

		assert.equal(result.categories[0]?.monthlyGoal, 275);
		assert.equal(result.categories[0]?.spentThisMonth, 0);
		assert.equal(result.categories[0]?.status, "no-spend");
		assert.equal(result.totalBudget, 275);
		assert.equal(result.categories[0]?.alerts, null);
	});

	it("keeps a saved goal instead of the trailing average", async () => {
		const result = await getBudgetPageData(
			makeCtx({
				categories: [
					{
						categoryId: "eating-out",
						categoryName: "Eating Out",
						monthlyGoal: 50,
					},
				],
				spend: [
					{
						categoryId: "eating-out",
						categoryName: "Eating Out",
						total: 30,
					},
				],
				monthlySpend: [
					{ categoryId: "eating-out", month: "2026-08", amount: 200 },
				],
			}),
			input,
		);

		assert.equal(result.categories[0]?.monthlyGoal, 50);
		assert.equal(result.totalBudget, 50);
		assert.deepEqual(result.categories[0]?.alerts, {
			enabled: true,
			thresholds: [75, 100],
		});
	});

	it("leaves categories with no trailing spend unset", async () => {
		const result = await getBudgetPageData(
			makeCtx({
				categories: [
					{
						categoryId: "gifts",
						categoryName: "Gifts & Donations",
						monthlyGoal: null,
					},
				],
				spend: [],
				monthlySpend: [],
			}),
			input,
		);

		assert.equal(result.categories[0]?.monthlyGoal, null);
		assert.equal(result.categories[0]?.status, "no-spend");
		assert.equal(result.totalBudget, 0);
		assert.equal(result.statusMessage, "No spending recorded yet this month.");
	});

	it("uses the selected month's spend and trailing average from the six months before it", async () => {
		const augustStart = new Date(2026, 7, 1);
		const augustEnd = new Date(2026, 7, 31, 23, 59, 59);
		const result = await getBudgetPageData(
			makeCtx({
				categories: [
					{
						categoryId: "business",
						categoryName: "Business Services",
						monthlyGoal: null,
					},
				],
				spend: [
					{
						categoryId: "business",
						categoryName: "Business Services",
						total: 115,
					},
				],
				monthlySpend: [
					{ categoryId: "business", month: "2026-07", amount: 93 },
					{ categoryId: "business", month: "2026-08", amount: 115 },
				],
			}),
			{
				periodStart: augustStart,
				periodEnd: augustEnd,
				dayOfMonth: 31,
				daysInMonth: 31,
				isCurrentMonth: false,
				reportingPeriod: {
					startDate: "2026-08-01",
					endDate: "2026-08-31",
					dayOfMonth: 31,
					daysInMonth: 31,
					isDemoSnapshot: false,
				},
			},
		);

		assert.equal(result.categories[0]?.spentThisMonth, 115);
		assert.equal(result.categories[0]?.monthlyGoal, 90);
		assert.equal(result.dayOfMonth, 31);
		assert.equal(result.categories[0]?.status, "overspending");
	});

	it("omits 'yet' from the no-spend message for a completed past month", async () => {
		const result = await getBudgetPageData(
			makeCtx({
				categories: [
					{
						categoryId: "gifts",
						categoryName: "Gifts & Donations",
						monthlyGoal: 50,
					},
				],
				spend: [],
			}),
			{
				...input,
				dayOfMonth: 30,
				daysInMonth: 30,
				isCurrentMonth: false,
			},
		);

		assert.equal(result.statusMessage, "No spending recorded this month.");
	});
});
