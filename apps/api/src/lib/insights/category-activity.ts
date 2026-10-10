import { Prisma, type PrismaClient } from "../../../generated/prisma";
import {
	RESOLVED_CATEGORY_DISPLAY_NAME_SQL,
	transactionScopeSql,
} from "../transaction-scope";
import { getInsightsDateRange } from "./period";
import type { InsightsPeriod } from "./types";

export type InsightsCategoryActivity = {
	income: string[];
	expense: string[];
};

type ActivityRow = {
	type: "INCOME" | "EXPENSE";
	category_name: string | null;
};

export async function getInsightsCategoryActivity(
	db: PrismaClient,
	userId: string,
	period: InsightsPeriod,
	now: Date,
	customRange?: { startDate: string; endDate: string },
): Promise<InsightsCategoryActivity> {
	const { startDate, endDate } = getInsightsDateRange(period, now, customRange);
	const where = transactionScopeSql({ userId, startDate, endDate });
	const rows = await db.$queryRaw<ActivityRow[]>(Prisma.sql`
		SELECT
			t.type AS type,
			${RESOLVED_CATEGORY_DISPLAY_NAME_SQL} AS category_name
		FROM "Transaction" t
		WHERE ${where}
		GROUP BY 1, 2
	`);

	const income = new Set<string>();
	const expense = new Set<string>();
	for (const row of rows) {
		const name = row.category_name?.trim();
		if (!name) continue;
		if (row.type === "INCOME") income.add(name);
		else expense.add(name);
	}

	return {
		income: [...income],
		expense: [...expense],
	};
}
