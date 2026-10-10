import { mcpToolContracts } from "@moat/mcp-contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { McpAuthContext } from "~/auth/types";
import { getAccountSyncCoverage } from "./coverage";
import { schemaEnvelope, toNumber } from "./format";
import { getProfileSectionAccounts } from "./list-accounts-data";
import { splitParentExclusionWhere } from "./split-parent-exclusion";
import type { McpToolImplementation } from "./types";

async function getPlaidAccountRows(context: McpAuthContext) {
	return context.db.plaidAccount.findMany({
		where: { userId: context.userId, isActive: true, accountHidden: false },
		include: {
			plaidItem: {
				select: {
					institutionName: true,
					requiresReconnect: true,
					lastSuccessfulSyncAt: true,
				},
			},
		},
		orderBy: [{ type: "asc" }, { name: "asc" }],
	});
}

export const listAccountsTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.listAccounts"],
	async execute(_input, context) {
		const [accounts, coverage] = await Promise.all([
			getProfileSectionAccounts(context),
			getAccountSyncCoverage(context),
		]);
		return schemaEnvelope("accounts.list", {
			asOf: coverage.asOf,
			accounts,
			coverage: {
				...coverage,
				accountCount: accounts.length,
			},
		});
	},
};

export const getProfileSummaryTool: McpToolImplementation = {
	contract: mcpToolContracts["moat.getProfileSummary"],
	async execute(_input, context) {
		const now = new Date();
		const monthStart = startOfMonth(now);
		const lastMonthStart = startOfMonth(subMonths(now, 1));
		const lastMonthEnd = endOfMonth(lastMonthStart);
		const [
			accounts,
			manualInvestments,
			realEstate,
			transactionCount,
			ruleCount,
			budgetCount,
			currentMonthTransactions,
			lastMonthTransactions,
			latestSnapshots,
			coverage,
		] = await Promise.all([
			getPlaidAccountRows(context),
			context.db.investment.findMany({
				where: { userId: context.userId },
				select: { id: true, startingBalance: true, monthlyContribution: true },
			}),
			context.db.realEstateInvestment.findMany({
				where: { userId: context.userId },
				select: {
					id: true,
					currentEstimatedValue: true,
					currentLoanBalance: true,
				},
			}),
			context.db.transaction.count({
				where: {
					userId: context.userId,
					hidden: false,
					removedAt: null,
					AND: [splitParentExclusionWhere],
				},
			}),
			context.db.transactionRule.count({ where: { userId: context.userId } }),
			context.db.categoryBudget.count({ where: { userId: context.userId } }),
			context.db.transaction.findMany({
				where: {
					userId: context.userId,
					hidden: false,
					removedAt: null,
					date: { gte: monthStart },
					AND: [splitParentExclusionWhere],
				},
				select: { amount: true, type: true, pending: true },
			}),
			context.db.transaction.findMany({
				where: {
					userId: context.userId,
					hidden: false,
					removedAt: null,
					date: { gte: lastMonthStart, lte: lastMonthEnd },
					AND: [splitParentExclusionWhere],
				},
				select: { amount: true, type: true, pending: true },
			}),
			context.db.balanceSnapshot.findMany({
				where: { userId: context.userId },
				orderBy: { date: "desc" },
				take: 50,
			}),
			getAccountSyncCoverage(context),
		]);

		const activeAccountBalance = accounts.reduce((sum, account) => {
			const balance = account.currentBalance ?? 0;
			return ["credit", "loan"].includes(account.type)
				? sum - balance
				: sum + balance;
		}, 0);
		const investmentBalance = manualInvestments.reduce(
			(sum, investment) => sum + investment.startingBalance,
			0,
		);
		const realEstateEquity = realEstate.reduce(
			(sum, property) =>
				sum + property.currentEstimatedValue - property.currentLoanBalance,
			0,
		);
		const snapshotDate = latestSnapshots[0]?.date ?? null;
		const snapshotNetWorth = snapshotDate
			? latestSnapshots
					.filter(
						(snapshot) => snapshot.date.getTime() === snapshotDate.getTime(),
					)
					.reduce((sum, snapshot) => sum + snapshot.balance, 0)
			: null;

		function summarizeCashFlow(rows: typeof currentMonthTransactions) {
			const posted = rows.filter((transaction) => !transaction.pending);
			const income = posted
				.filter((transaction) => transaction.type === "INCOME")
				.reduce(
					(sum, transaction) => sum + (toNumber(transaction.amount) ?? 0),
					0,
				);
			const expenses = posted
				.filter((transaction) => transaction.type === "EXPENSE")
				.reduce(
					(sum, transaction) => sum + (toNumber(transaction.amount) ?? 0),
					0,
				);
			return {
				income,
				expenses,
				net: income - expenses,
				pendingCount: rows.length - posted.length,
			};
		}

		return schemaEnvelope("profile.summary", {
			asOf: coverage.asOf,
			counts: {
				accounts: accounts.length,
				transactions: transactionCount,
				rules: ruleCount,
				budgets: budgetCount,
				manualInvestments: manualInvestments.length,
				realEstateProperties: realEstate.length,
			},
			netWorth: {
				currentEstimate:
					snapshotNetWorth ??
					activeAccountBalance + investmentBalance + realEstateEquity,
				latestSnapshotDate: snapshotDate?.toISOString().slice(0, 10) ?? null,
			},
			cashFlow: {
				currentMonth: summarizeCashFlow(currentMonthTransactions),
				previousMonth: summarizeCashFlow(lastMonthTransactions),
			},
			coverage,
			definitive: coverage.isComplete,
		});
	},
};
