import type { ActiveRule, ForecastScenario } from "@moat/data-access";
import {
	getForecast,
	getSummaryMetrics,
	matchRuleConditions,
} from "@moat/domain";
import {
	applyRulesPreviewInputSchema,
	explainForecastInputSchema,
	forecastInputSchema,
	listRulesInputSchema,
	mcpToolContracts,
} from "@moat/mcp-contracts";
import {
	listCandidateTransactions,
	previewRuleMatches,
	toMatchable,
} from "./financial-writes";
import { formatLocalTransactionCard, summarizeLocalRule } from "./format";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

const FORECAST_DISCLAIMER =
	"This is an estimate based on posted history and scenario assumptions, not a guaranteed outcome.";

async function buildLocalForecastSeries(
	ctx: LocalToolContext,
	input: { scenarioId?: string; years: number },
) {
	const appCtx = ctx.appRuntime;
	const scenarios = await getForecast(appCtx);
	const scenario = input.scenarioId
		? scenarios.find((item: ForecastScenario) => item.id === input.scenarioId)
		: (scenarios.find((item: ForecastScenario) => item.isActive) ??
			scenarios[0]);

	if (!scenario) {
		throw new Error(
			"No forecast scenario configured. Add income/expense assumptions in the app.",
		);
	}

	const metrics = await getSummaryMetrics(appCtx, { months: 3 });
	const accounts = await appCtx.repositories.accounts.listAll({
		userId: appCtx.userId,
	});
	const startingNetWorth = accounts.reduce(
		(sum: number, account: { type: string; currentBalance: number | null }) => {
			const balance = account.currentBalance ?? 0;
			return ["credit", "loan"].includes(account.type)
				? sum - balance
				: sum + balance;
		},
		0,
	);

	const series = [];
	let netWorth = startingNetWorth;
	let annualIncome = metrics.avgIncome * 12;
	let annualExpenses = metrics.avgExpenses * 12;

	for (let yearOffset = 0; yearOffset <= input.years; yearOffset += 1) {
		const year = new Date().getFullYear() + yearOffset;
		if (yearOffset > 0) {
			annualIncome *= 1 + scenario.salaryGrowth + scenario.contributionChange;
			annualExpenses *= 1 + scenario.expenseGrowth + scenario.inflationRate;
			netWorth =
				netWorth * (1 + scenario.investmentReturn) +
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

	return localSchemaEnvelope("forecast.series", {
		resultType: "estimate" as const,
		disclaimer: FORECAST_DISCLAIMER,
		asOf: new Date().toISOString(),
		scenario: {
			id: scenario.id,
			name: scenario.name,
			type: scenario.type,
			investmentReturn: scenario.investmentReturn,
			inflationRate: scenario.inflationRate,
			salaryGrowth: scenario.salaryGrowth,
			contributionChange: scenario.contributionChange,
			expenseGrowth: scenario.expenseGrowth,
		},
		assumptions: {
			baselineCashFlow: "posted_previous_month",
			compoundsAnnually: true,
			includesPendingTransactions: false,
		},
		startingNetWorth,
		baselineMonthlyCashFlow: {
			income: metrics.avgIncome,
			expenses: metrics.avgExpenses,
			net: metrics.avgNetGain,
			basis: "posted_previous_month",
		},
		years: input.years,
		series,
		dataCoverage: {
			limitations: [
				"Baseline income/expenses are annualized from recent local averages.",
				"Pending transactions are excluded from the baseline.",
				"Investment returns and inflation are scenario assumptions, not market forecasts.",
			],
		},
	});
}

export const getForecastTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getForecast"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = forecastInputSchema.parse(input ?? {});
		return buildLocalForecastSeries(ctx, {
			scenarioId: parsed.scenarioId,
			years: parsed.years,
		});
	},
};

export const explainForecastTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.explainForecast"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = explainForecastInputSchema.parse(input ?? {});
		const forecast = await buildLocalForecastSeries(ctx, {
			scenarioId: parsed.scenarioId,
			years: parsed.years,
		});
		const first = forecast.series[0];
		const last = forecast.series.at(-1);
		const netWorthDelta = first && last ? last.netWorth - first.netWorth : 0;
		const endingCashFlow = last?.cashFlow ?? 0;

		return localSchemaEnvelope("forecast.explanation", {
			resultType: "estimate" as const,
			disclaimer:
				"This explanation describes an estimate, not a guaranteed financial outcome.",
			focus: parsed.focus,
			forecast,
			summary: {
				netWorthDelta,
				endingCashFlow,
				trajectory: netWorthDelta >= 0 ? "increasing" : "decreasing",
				cashFlowRisk:
					endingCashFlow < 0 ? "negative_cashflow" : "positive_cashflow",
			},
			drivers: [
				`Scenario return assumption: ${(forecast.scenario.investmentReturn * 100).toFixed(1)}%.`,
				`Scenario inflation assumption: ${(forecast.scenario.inflationRate * 100).toFixed(1)}%.`,
				`Baseline monthly net cash flow: ${forecast.baselineMonthlyCashFlow.net.toFixed(0)}.`,
			],
		});
	},
};

export const listRulesTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listTransactionRules"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = listRulesInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;

		const rules = parsed.includeInactive
			? await repositories.rules.listAll({ userId })
			: await repositories.rules.listActive({ userId });

		return localSchemaEnvelope("rules.list", {
			rules: rules.map((rule: ActiveRule) => summarizeLocalRule(rule)),
		});
	},
};

export const applyRulesPreviewTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.previewRuleMatches"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = applyRulesPreviewInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;

		if (parsed.ruleId) {
			const rule = await repositories.rules.findById({
				userId,
				ruleId: parsed.ruleId,
			});
			if (!rule) throw new Error("Rule not found");
			const { matched, truncatedAt } = await previewRuleMatches(ctx, rule);
			return localSchemaEnvelope("rules.preview", {
				ruleId: parsed.ruleId,
				totalCount: matched.length,
				preview: matched.slice(0, 5).map(formatLocalTransactionCard),
				truncatedAt,
				countSource: "rules_engine" as const,
			});
		}

		const conditions = parsed.conditions?.map((condition, index) => ({
			...condition,
			id: `preview-${index}`,
			valueDate: condition.valueDate ? new Date(condition.valueDate) : null,
			secondValueDate: condition.secondValueDate
				? new Date(condition.secondValueDate)
				: null,
			sortOrder: index,
		}));
		if (!conditions) throw new Error("Rule or conditions not found");

		const transactions = await listCandidateTransactions(ctx);
		const matched = transactions.filter((tx) =>
			matchRuleConditions(toMatchable(tx), { conditions }),
		);

		return localSchemaEnvelope("rules.preview", {
			ruleId: null,
			totalCount: matched.length,
			preview: matched.slice(0, 5).map(formatLocalTransactionCard),
			truncatedAt: transactions.length,
			countSource: "condition_sample" as const,
		});
	},
};
