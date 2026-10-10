import type { CategoryBudgetEntry } from "../types";

export type CategorySpendRow = {
	categoryId: string | null;
	categoryName: string;
	total: number;
};

/** Net spend for one category in a calendar month (YYYY-MM). */
export type CategoryMonthAmount = {
	month: string;
	amount: number;
};

/** Net spend for one category in one calendar month, across all categories. */
export type CategoryMonthSpendRow = {
	categoryId: string;
	month: string;
	amount: number;
};

export interface BudgetRepository {
	getCategoriesWithBudgets(input: {
		userId: string;
	}): Promise<CategoryBudgetEntry[]>;

	getCategorySpendForPeriod(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategorySpendRow[]>;

	/**
	 * Net spend by calendar month for a single category.
	 * Expenses add; income in the same category subtracts.
	 */
	getCategorySpendByMonth(input: {
		userId: string;
		categoryId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategoryMonthAmount[]>;

	/**
	 * Net spend by calendar month for every category.
	 * Expenses add; income in the same category subtracts.
	 */
	getAllCategorySpendByMonth(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
	}): Promise<CategoryMonthSpendRow[]>;

	upsertCategoryBudget(input: {
		userId: string;
		categoryId: string;
		monthlyGoal: number | null;
		alertsEnabled?: boolean;
		alertThresholds?: number[];
	}): Promise<void>;
}
