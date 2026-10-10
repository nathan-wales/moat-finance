import type { CategorySpend, MonthlyTotals } from "../types";

export interface DashboardRepository {
	getCategoryBreakdown(input: {
		userId: string;
		startDate: Date;
		endDate?: Date;
		type?: "INCOME" | "EXPENSE";
	}): Promise<CategorySpend[]>;

	getMonthlyTotals(input: {
		userId: string;
		startDate: Date;
		endDate?: Date;
	}): Promise<MonthlyTotals[]>;
}
