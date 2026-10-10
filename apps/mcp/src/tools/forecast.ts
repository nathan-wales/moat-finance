import type { ExplainForecastInput, ForecastInput } from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import { endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { McpAuthContext } from "~/auth/types";
import { schemaEnvelope, toNumber } from "./format";
import { splitParentExclusionWhere } from "./split-parent-exclusion";
import type { McpToolImplementation } from "./types";

async function getScenario(
	context: McpAuthContext,
	scenarioId: string | undefined,
) {
	if (scenarioId) {
		const scenario = await context.db.forecastScenario.findFirst({
			where: { id: scenarioId, userId: context.userId },
		});
		if (!scenario) throw new Error("Forecast scenario not found");
		return scenario;
	}

	return context.db.forecastScenario.findFirst({
		where: { userId: context.userId, isActive: true },
		orderBy: { createdAt: "asc" },
	});
}

async function getStartingNetWorth(context: McpAuthContext) {
	const latest = await context.db.balanceSnapshot.findFirst({
		where: { userId: context.userId },
		orderBy: { date: "desc" },
		select: { date: true },
	});
	if (latest) {
		const snapshots = await context.db.balanceSnapshot.findMany({
			where: { userId: context.userId, date: latest.date },
		});
		return snapshots.reduce((sum, snapshot) => sum + snapshot.balance, 0);
	}

	const [accounts, investments, realEstate] = await Promise.all([
		context.db.plaidAccount.findMany({
			where: { userId: context.userId, isActive: true, accountHidden: false },
			select: { type: true, currentBalance: true },
		}),
		context.db.investment.findMany({
			where: { userId: context.userId },
			select: { startingBalance: true },
		}),
		context.db.realEstateInvestment.findMany({
			where: { userId: context.userId },
			select: { currentEstimatedValue: true, currentLoanBalance: true },
		}),
	]);

	const accountBalance = accounts.reduce((sum, account) => {
		const balance = account.currentBalance ?? 0;
		return ["credit", "loan"].includes(account.type)
			? sum - balance
			: sum + balance;
	}, 0);
	const investmentBalance = investments.reduce(
		(sum, investment) => sum + investment.startingBalance,
		0,
	);
	const realEstateEquity = realEstate.reduce(
		(sum, property) =>
			sum + property.currentEstimatedValue - property.currentLoanBalance,
		0,
	);
	return accountBalance + investmentBalance + realEstateEquity;
}

async function getMonthlyCashFlow(context: McpAuthContext) {
	const monthStart = startOfMonth(subMonths(new Date(), 1));
	const monthEnd = endOfMonth(monthStart);
	const rows = await context.db.transaction.findMany({
		where: {
			userId: context.userId,
			hidden: false,
			removedAt: null,
			pending: false,
			date: { gte: monthStart, lte: monthEnd },
			AND: [splitParentExclusionWhere],
		},
		select: { amount: true, type: true },
	});
	const income = rows
		.filter((transaction) => transaction.type === "INCOME")
		.reduce((sum, transaction) => sum + (toNumber(transaction.amount) ?? 0), 0);
	const expenses = rows
		.filter((transaction) => transaction.type === "EXPENSE")
		.reduce((sum, transaction) => sum + (toNumber(transaction.amount) ?? 0), 0);
	return {
		income,
		expenses,
		net: income - expenses,
		basis: "posted_previous_month" as const,
	};
}

async function buildForecast(input: ForecastInput, context: McpAuthContext) {
	const [scenario, startingNetWorth, monthlyCashFlow] = await Promise.all([
		getScenario(context, input.scenarioId),
		getStartingNetWorth(context),
		getMonthlyCashFlow(context),
	]);
	const assumptions = scenario ?? {
		id: null,
		name: "Default",
		type: "STANDARD",
		investmentReturn: 0.07,
		inflationRate: 0.03,
		salaryGrowth: 0.03,
		contributionChange: 0,
		expenseGrowth: 0.03,
	};
	const series = [];
	let netWorth = startingNetWorth;
	let annualIncome = monthlyCashFlow.income * 12;
	let annualExpenses = monthlyCashFlow.expenses * 12;

	for (let yearOffset = 0; yearOffset <= input.years; yearOffset += 1) {
		const year = new Date().getFullYear() + yearOffset;
		if (yearOffset > 0) {
			annualIncome *=
				1 + assumptions.salaryGrowth + assumptions.contributionChange;
			annualExpenses *=
				1 + assumptions.expenseGrowth + assumptions.inflationRate;
			netWorth =
				netWorth * (1 + assumptions.investmentReturn) +
				(annualIncome - annualExpenses);
		}
		series.push({
			year,
			netWorth,
			income: annualIncome,
			expenses: annualExpenses,
			cashFlow: annualIncome - annualExpenses,
		});
	}

	return schemaEnvelope("forecast.series", {
		resultType: "estimate",
		disclaimer:
			"This is an estimate based on posted history and scenario assumptions, not a guaranteed outcome.",
		asOf: new Date().toISOString(),
		scenario: {
			id: assumptions.id,
			name: assumptions.name,
			type: assumptions.type,
			investmentReturn: assumptions.investmentReturn,
			inflationRate: assumptions.inflationRate,
			salaryGrowth: assumptions.salaryGrowth,
			contributionChange: assumptions.contributionChange,
			expenseGrowth: assumptions.expenseGrowth,
		},
		assumptions: {
			baselineCashFlow: monthlyCashFlow.basis,
			compoundsAnnually: true,
			includesPendingTransactions: false,
		},
		startingNetWorth,
		baselineMonthlyCashFlow: monthlyCashFlow,
		years: input.years,
		series,
		dataCoverage: {
			limitations: [
				"Baseline income/expenses are annualized from the previous calendar month of posted transactions.",
				"Pending transactions are excluded from the baseline.",
				"Investment returns and inflation are scenario assumptions, not market forecasts.",
			],
		},
	});
}

export const getForecastTool: McpToolImplementation<ForecastInput> = {
	contract: mcpToolContracts["moat.getForecast"],
	execute: buildForecast,
};

export const explainForecastTool: McpToolImplementation<ExplainForecastInput> =
	{
		contract: mcpToolContracts["moat.explainForecast"],
		async execute(input, context) {
			const forecast = await buildForecast(input, context);
			const series = forecast.series;
			const first = series[0];
			const last = series.at(-1);
			const netWorthDelta = first && last ? last.netWorth - first.netWorth : 0;
			const endingCashFlow = last?.cashFlow ?? 0;

			return schemaEnvelope("forecast.explanation", {
				resultType: "estimate",
				disclaimer:
					"This explanation describes an estimate, not a guaranteed financial outcome.",
				focus: input.focus,
				forecast,
				summary: {
					netWorthDelta,
					endingCashFlow,
					trajectory: netWorthDelta >= 0 ? "increasing" : "decreasing",
					cashFlowRisk:
						endingCashFlow < 0 ? "negative_cashflow" : "positive_cashflow",
				},
				drivers: [
					"Projection uses latest net-worth snapshot when available.",
					"Income and expenses are annualized from the previous month of posted transactions.",
					"Scenario assumptions compound annually across the requested horizon.",
				],
			});
		},
	};
