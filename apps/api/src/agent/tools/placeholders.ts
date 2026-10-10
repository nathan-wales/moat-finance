import { z } from "zod";
import { buildNetWorthSeries, SCENARIO_PRESETS } from "~/lib/forecasting";
import { getMonthlyTransactionTotals } from "~/lib/transaction-scope";
import { db } from "~/server/db";

import type { MoatToolDefinition } from "./types";

const chartMonthsSchema = z.object({
	months: z.number().int().min(1).max(60).optional(),
});

const transactionListSchema = z.object({
	limit: z.number().int().min(1).max(100).optional(),
	type: z.enum(["INCOME", "EXPENSE"]).optional(),
	startDate: z.string().optional(),
	endDate: z.string().optional(),
});

type ChartMonthsInput = z.infer<typeof chartMonthsSchema>;
type TransactionListInput = z.infer<typeof transactionListSchema>;

type NetWorthPoint = {
	month: string;
	actual: number;
};

function parseOptionalDate(value: string | undefined): Date | undefined {
	if (!value) return undefined;
	const date = new Date(value);
	return Number.isNaN(date.getTime()) ? undefined : date;
}

async function takeBalanceSnapshot(userId: string): Promise<void> {
	const today = new Date();
	today.setHours(0, 0, 0, 0);

	const [plaidAccounts, investments, realEstate] = await Promise.all([
		db.plaidAccount.findMany({
			where: { userId, isActive: true, accountHidden: false },
			select: { id: true, type: true, currentBalance: true },
		}),
		db.investment.findMany({
			where: { userId },
			select: { id: true, startingBalance: true },
		}),
		db.realEstateInvestment.findMany({
			where: { userId },
			select: {
				id: true,
				currentEstimatedValue: true,
				currentLoanBalance: true,
			},
		}),
	]);

	const snapshots = [
		...plaidAccounts.map((account) => ({
			source: "PLAID" as const,
			sourceId: account.id,
			balance: ["credit", "loan"].includes(account.type)
				? -(account.currentBalance ?? 0)
				: (account.currentBalance ?? 0),
		})),
		...investments.map((investment) => ({
			source: "INVESTMENT" as const,
			sourceId: investment.id,
			balance: investment.startingBalance,
		})),
		...realEstate.map((property) => ({
			source: "REAL_ESTATE" as const,
			sourceId: property.id,
			balance: property.currentEstimatedValue - property.currentLoanBalance,
		})),
	];

	await Promise.all(
		snapshots.map((snapshot) =>
			db.balanceSnapshot.upsert({
				where: {
					userId_date_source_sourceId: {
						userId,
						date: today,
						source: snapshot.source,
						sourceId: snapshot.sourceId,
					},
				},
				create: { userId, date: today, ...snapshot },
				update: { balance: snapshot.balance },
			}),
		),
	);
}

async function getNetWorthSeries(
	userId: string,
	months: number,
): Promise<NetWorthPoint[]> {
	const existingCount = await db.balanceSnapshot.count({ where: { userId } });
	if (existingCount === 0) await takeBalanceSnapshot(userId);

	const startDate = new Date();
	startDate.setMonth(startDate.getMonth() - months);
	startDate.setHours(0, 0, 0, 0);

	const snapshots = await db.balanceSnapshot.findMany({
		where: { userId, date: { gte: startDate } },
		orderBy: { date: "asc" },
		select: { date: true, balance: true },
	});

	const dailyTotals = new Map<string, number>();
	for (const snapshot of snapshots) {
		const dateKey = snapshot.date.toISOString().slice(0, 10);
		dailyTotals.set(
			dateKey,
			(dailyTotals.get(dateKey) ?? 0) + snapshot.balance,
		);
	}

	const monthlyTotals = new Map<string, number>();
	for (const [date, total] of Array.from(dailyTotals.entries()).sort()) {
		monthlyTotals.set(date.slice(0, 7), total);
	}

	return Array.from(monthlyTotals.entries()).map(([month, actual]) => ({
		month,
		actual,
	}));
}

export const getTransactionsTool: MoatToolDefinition<TransactionListInput> = {
	name: "get_transactions",
	displayName: "Transactions",
	description:
		"Fetch recent user transactions for summaries or transaction_table widgets. Use the returned rows as render_widget.rows.",
	enabled: true,
	capabilities: ["read:transactions"],
	safetyClass: "read_only_app_data",
	inputSchema: transactionListSchema,
	execute: async (input, context) => {
		const limit = input.limit ?? 25;
		const startDate = parseOptionalDate(input.startDate);
		const endDate = parseOptionalDate(input.endDate);
		const transactions = await db.transaction.findMany({
			where: {
				userId: context.userId,
				hidden: false,
				removedAt: null,
				...(input.type ? { type: input.type } : {}),
				...(startDate || endDate
					? {
							date: {
								...(startDate ? { gte: startDate } : {}),
								...(endDate ? { lte: endDate } : {}),
							},
						}
					: {}),
			},
			orderBy: { date: "desc" },
			take: limit,
			select: {
				id: true,
				date: true,
				merchantName: true,
				description: true,
				category: true,
				amount: true,
				type: true,
			},
		});

		const rows = transactions.map((transaction) => ({
			id: transaction.id,
			date: transaction.date.toISOString(),
			merchant:
				transaction.merchantName ?? transaction.description ?? "Transaction",
			category: transaction.category,
			amount:
				transaction.type === "EXPENSE"
					? -Number(transaction.amount)
					: Number(transaction.amount),
		}));

		return { rows, count: rows.length };
	},
};

const netWorthForecastSchema = z.object({
	forecastMonths: z
		.number()
		.int()
		.min(1)
		.max(360)
		.optional()
		.describe("Forecast horizon in months. Use 120 for 10 years."),
	forecastYears: z
		.number()
		.int()
		.min(1)
		.max(30)
		.optional()
		.describe(
			"Forecast horizon in years. Use this for requests like 'in 10 years'.",
		),
	scenario: z.enum(["CONSERVATIVE", "STANDARD", "AGGRESSIVE"]).optional(),
});

type NetWorthForecastInput = z.infer<typeof netWorthForecastSchema>;

export const getNetWorthTool: MoatToolDefinition<ChartMonthsInput> = {
	name: "get_net_worth",
	displayName: "Net worth",
	description:
		"Fetch historical monthly net worth for net_worth_chart widgets (up to 60 months of past data). Use the returned data as render_widget.data. For future projections, use get_net_worth_forecast instead.",
	enabled: true,
	capabilities: ["read:net_worth"],
	safetyClass: "read_only_app_data",
	inputSchema: chartMonthsSchema,
	execute: async (input, context) => {
		const months = input.months ?? 24;
		const data = await getNetWorthSeries(context.userId, months);
		return {
			data,
			currentNetWorth: data.at(-1)?.actual ?? 0,
			months,
			chartType: "net_worth_chart",
		};
	},
};

export const getNetWorthForecastTool: MoatToolDefinition<NetWorthForecastInput> =
	{
		name: "get_net_worth_forecast",
		displayName: "Net worth forecast",
		description:
			"Project future net worth using historical income/expense trends and investment growth. Use this for future questions like 'in 10 years' or 'forecast my net worth'. Supports forecastYears up to 30 or forecastMonths up to 360. Returns data for a net_worth_chart widget with historical + forecast points. Use render_widget.data with this output.",
		enabled: true,
		capabilities: ["read:net_worth", "read:transactions"],
		safetyClass: "read_only_app_data",
		inputSchema: netWorthForecastSchema,
		execute: async (input, context) => {
			const userId = context.userId;

			// Get 24 months of historical transaction data for baseline
			const historyStart = new Date();
			historyStart.setMonth(historyStart.getMonth() - 24);
			const monthlyTotals = await getMonthlyTransactionTotals(db, {
				userId,
				startDate: historyStart,
			});
			const monthlyData = monthlyTotals.map((m) => ({
				month: m.month,
				income: m.income,
				expenses: m.expenses,
				netGain: m.net,
			}));

			// Get current investment total
			const [manualInvestments, plaidInvestmentAccounts, realEstate] =
				await Promise.all([
					db.investment.findMany({
						where: { userId },
						select: { startingBalance: true },
					}),
					db.plaidAccount.findMany({
						where: {
							userId,
							type: "investment",
							isActive: true,
							investmentHidden: false,
							accountHidden: false,
						},
						select: { currentBalance: true },
					}),
					db.realEstateInvestment.findMany({
						where: { userId },
						select: {
							currentEstimatedValue: true,
							currentLoanBalance: true,
						},
					}),
				]);

			const currentInvestmentTotal =
				manualInvestments.reduce((sum, i) => sum + i.startingBalance, 0) +
				plaidInvestmentAccounts.reduce(
					(sum, a) => sum + (a.currentBalance ?? 0),
					0,
				) +
				realEstate.reduce(
					(sum, p) => sum + (p.currentEstimatedValue - p.currentLoanBalance),
					0,
				);

			const scenarioPreset = input.scenario
				? SCENARIO_PRESETS[input.scenario]
				: SCENARIO_PRESETS.STANDARD;

			const forecastMonths = Math.min(
				input.forecastMonths ?? (input.forecastYears ?? 10) * 12,
				360,
			);

			const series = buildNetWorthSeries(
				monthlyData,
				currentInvestmentTotal,
				forecastMonths,
				scenarioPreset,
			);

			const data = series.map((point) => ({
				month: point.month,
				...(point.isForecast
					? { forecast: point.netWorth }
					: { actual: point.netWorth }),
			}));

			return {
				data,
				forecastMonths,
				forecastYears: forecastMonths / 12,
				scenario: input.scenario ?? "STANDARD",
				chartType: "net_worth_chart",
			};
		},
	};

export const getInvestmentsTool: MoatToolDefinition<Record<string, never>> = {
	name: "get_investments",
	displayName: "Investments",
	description:
		"Fetch investment, cash, and real estate balances for summaries or spending_breakdown_chart-style allocation widgets.",
	enabled: true,
	capabilities: ["read:investments"],
	safetyClass: "read_only_app_data",
	inputSchema: z.object({}),
	execute: async (_input, context) => {
		const [
			manualInvestments,
			plaidInvestmentAccounts,
			cashAccounts,
			realEstate,
		] = await Promise.all([
			db.investment.findMany({
				where: { userId: context.userId },
				select: { id: true, name: true, type: true, startingBalance: true },
			}),
			db.plaidAccount.findMany({
				where: {
					userId: context.userId,
					type: "investment",
					isActive: true,
					investmentHidden: false,
					accountHidden: false,
				},
				select: { id: true, name: true, subtype: true, currentBalance: true },
			}),
			db.plaidAccount.findMany({
				where: {
					userId: context.userId,
					type: "depository",
					isActive: true,
					accountHidden: false,
				},
				select: { id: true, name: true, subtype: true, currentBalance: true },
			}),
			db.realEstateInvestment.findMany({
				where: { userId: context.userId },
				select: {
					id: true,
					name: true,
					currentEstimatedValue: true,
					currentLoanBalance: true,
				},
			}),
		]);

		const data = [
			...manualInvestments.map((investment) => ({
				category: investment.name,
				amount: investment.startingBalance,
				type: investment.type,
			})),
			...plaidInvestmentAccounts.map((account) => ({
				category: account.name,
				amount: account.currentBalance ?? 0,
				type: account.subtype ?? "investment",
			})),
			...cashAccounts.map((account) => ({
				category: account.name,
				amount: account.currentBalance ?? 0,
				type: account.subtype ?? "cash",
			})),
			...realEstate.map((property) => ({
				category: property.name,
				amount: property.currentEstimatedValue - property.currentLoanBalance,
				type: "real_estate",
			})),
		];

		return {
			data,
			total: data.reduce((sum, item) => sum + item.amount, 0),
			chartType: "spending_breakdown_chart",
		};
	},
};

export const placeholderTools: Record<string, MoatToolDefinition> = {
	get_transactions: getTransactionsTool,
	get_net_worth: getNetWorthTool,
	get_net_worth_forecast: getNetWorthForecastTool,
	get_investments: getInvestmentsTool,
};
