import type { AccountSummary } from "@moat/data-access";
import {
	getBudgetStatus,
	getPreviousMonthCashFlow,
	getSummaryMetrics,
} from "@moat/domain";
import { mcpToolContracts } from "@moat/mcp-contracts";
import { endOfMonth, startOfMonth } from "date-fns";
import { localCoverage } from "./format";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function accountContributionToNetWorth(account: AccountSummary): number {
	const balance = account.currentBalance ?? 0;
	return ["credit", "loan"].includes(account.type) ? -balance : balance;
}

export const getProfileSummaryTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getProfileSummary"],
	async execute(_input, ctx: LocalToolContext) {
		const appCtx = ctx.appRuntime;
		const { userId, repositories } = appCtx;

		const now = new Date();
		const monthStart = startOfMonth(now);
		const monthEnd = endOfMonth(now);

		const [
			accounts,
			investments,
			realEstate,
			metrics,
			lastMonthCashFlow,
			txCount,
			ruleCount,
		] = await Promise.all([
			repositories.accounts.listForSummary({ userId }),
			repositories.investments?.list({ userId }) ?? Promise.resolve([]),
			repositories.realEstate?.list({ userId }) ?? Promise.resolve([]),
			getSummaryMetrics(appCtx, { months: 3 }),
			getPreviousMonthCashFlow(appCtx, {}),
			repositories.transactions.count({ userId }),
			repositories.rules.listAll({ userId }).then((r: unknown[]) => r.length),
		]);

		const budgetStatus = await getBudgetStatus(appCtx, {
			periodStart: monthStart,
			periodEnd: monthEnd,
			dayOfMonth: now.getDate(),
			daysInMonth: endOfMonth(monthStart).getDate(),
		});

		const activeAccounts = accounts.filter(
			(account) => !account.isHidden && account.isActive,
		);
		const coverage = localCoverage(activeAccounts.length);
		const budgetsWithGoals = budgetStatus.categories.filter(
			(category) => category.monthlyGoal !== null,
		).length;

		const accountBalance = activeAccounts.reduce(
			(sum, account) => sum + accountContributionToNetWorth(account),
			0,
		);
		const investmentBalance = investments.reduce(
			(sum, investment) => sum + investment.startingBalance,
			0,
		);
		const realEstateEquity = realEstate.reduce(
			(sum, property) =>
				sum + property.currentEstimatedValue - property.currentLoanBalance,
			0,
		);

		return localSchemaEnvelope("profile.summary", {
			asOf: coverage.asOf,
			counts: {
				accounts: activeAccounts.length,
				transactions: txCount,
				rules: ruleCount,
				budgets: budgetsWithGoals,
				manualInvestments: investments.length,
				realEstateProperties: realEstate.length,
			},
			netWorth: {
				currentEstimate: accountBalance + investmentBalance + realEstateEquity,
				latestSnapshotDate: null,
			},
			cashFlow: {
				currentMonth: {
					income: metrics.avgIncome,
					expenses: metrics.avgExpenses,
					net: metrics.avgNetGain,
					pendingCount: 0,
				},
				previousMonth: {
					income: lastMonthCashFlow.totalIncome,
					expenses: lastMonthCashFlow.totalExpenses,
					net: lastMonthCashFlow.totalIncome - lastMonthCashFlow.totalExpenses,
					pendingCount: 0,
				},
			},
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const listAccountsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listAccounts"],
	async execute(_input, ctx: LocalToolContext) {
		const { userId, repositories } = ctx.appRuntime;
		const accounts = await repositories.accounts.listForSummary({ userId });
		const visibleAccounts = accounts.filter(
			(account) => !account.isHidden && account.isActive,
		);
		const coverage = localCoverage(visibleAccounts.length);

		return localSchemaEnvelope("accounts.list", {
			asOf: coverage.asOf,
			accounts: visibleAccounts.map((account: AccountSummary) => {
				const providerType = account.type;
				const providerSubtype = account.subtype ?? null;
				const normalizedType = providerType.toLowerCase();
				const normalizedSubtype = providerSubtype?.toLowerCase() ?? "";
				const isInvestmentAccount =
					normalizedType === "investment" ||
					normalizedType === "brokerage" ||
					[
						"roth",
						"ira",
						"401k",
						"403b",
						"457b",
						"hsa",
						"529",
						"brokerage",
					].some((token) => normalizedSubtype.includes(token));

				let accountClass:
					| "depository"
					| "credit"
					| "loan"
					| "investment"
					| "other" = "other";
				if (isInvestmentAccount) accountClass = "investment";
				else if (normalizedType === "credit") accountClass = "credit";
				else if (normalizedType === "loan") accountClass = "loan";
				else if (normalizedType === "depository") accountClass = "depository";

				return {
					id: account.id,
					name: account.name,
					mask: account.mask ? `••••${account.mask}` : null,
					type: providerSubtype ?? providerType,
					subtype: providerSubtype,
					accountClass,
					isInvestmentAccount,
					connectionStatus: "Manual" as const,
					providerType,
					providerSubtype,
					currentBalance: account.currentBalance ?? null,
					availableBalance: null,
					currency: account.currency,
					isActive: account.isActive,
					institutionName: null,
					requiresReconnect: false,
					lastSuccessfulSyncAt: null,
					syncStatus: "never_synced" as const,
				};
			}),
			coverage,
		});
	},
};
