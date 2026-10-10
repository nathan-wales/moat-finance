import type {
	AccountSummary,
	DashboardTransaction,
	MonthlyTotals,
} from "@moat/data-access";
import type { AppContext } from "../context";
import { accountNetWorthContribution } from "./account-net-worth";
import { trailingCashFlowRange } from "./trailing-cash-flow-range";

export type GetDashboardSummaryInput = {
	/** Number of months of history to include in monthly totals (default: 6) */
	months?: number;
	/** Number of recent transactions to include (default: 10) */
	recentCount?: number;
	/** Override "now" — useful for demo snapshots */
	now?: Date;
};

export type DashboardSummary = {
	accounts: AccountSummary[];
	/** Signed sum of active accounts included in net worth by default */
	netWorth: number;
	recentTransactions: DashboardTransaction[];
	monthlyTotals: MonthlyTotals[];
};

/**
 * Returns a snapshot of the user's financial dashboard:
 * account balances, net worth, recent transactions, and monthly cash flow.
 */
export async function getDashboardSummary(
	ctx: AppContext,
	input: GetDashboardSummaryInput = {},
): Promise<DashboardSummary> {
	const months = input.months ?? 6;
	const recentCount = input.recentCount ?? 10;
	const now = input.now ?? new Date();
	const { startDate, endDate } = trailingCashFlowRange(months, now);

	const [accounts, recentTransactions, monthlyTotals] = await Promise.all([
		ctx.repositories.accounts.listForSummary({ userId: ctx.userId }),
		ctx.repositories.transactions.listRecent({
			userId: ctx.userId,
			limit: recentCount,
		}),
		ctx.repositories.dashboard.getMonthlyTotals({
			userId: ctx.userId,
			startDate,
			endDate,
		}),
	]);

	const netWorth = accounts
		.filter((a) => !a.isHidden && a.isActive)
		.reduce((sum, a) => sum + accountNetWorthContribution(a), 0);

	return { accounts, netWorth, recentTransactions, monthlyTotals };
}
