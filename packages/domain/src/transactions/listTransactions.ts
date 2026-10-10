import type { DashboardTransaction } from "@moat/data-access";
import type { AppContext } from "../context";

export type ListTransactionsInput = {
	startDate?: Date;
	endDate?: Date;
	limit?: number;
};

/**
 * Returns recent transactions for the user, scoped to the optional date range.
 */
export async function listTransactions(
	ctx: AppContext,
	input: ListTransactionsInput = {},
): Promise<DashboardTransaction[]> {
	return ctx.repositories.transactions.listRecent({
		userId: ctx.userId,
		limit: input.limit ?? 100,
		startDate: input.startDate,
		endDate: input.endDate,
	});
}
