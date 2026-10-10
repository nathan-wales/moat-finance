import type {
	CashFlowInput,
	FinancialOverviewInput,
	InvestmentHoldingsInput,
	LiabilitiesInput,
	NetWorthInput,
	RecurringBillsInput,
} from "@moat/mcp-contracts";
import { mcpToolContracts } from "@moat/mcp-contracts";
import { addDays, endOfMonth, startOfMonth, subMonths } from "date-fns";
import type { McpAuthContext } from "~/auth/types";
import { getProfileOtherAssetsForNetWorth } from "./assets";
import { getAccountSyncCoverage, isTransferCategory } from "./coverage";
import { schemaEnvelope, toNumber } from "./format";
import { splitParentExclusionWhere } from "./split-parent-exclusion";
import type { McpToolImplementation } from "./types";

async function getActiveAccounts(context: McpAuthContext) {
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

function classifyAccountBalance(account: {
	type: string;
	currentBalance: number | null;
	availableBalance: number | null;
}) {
	const current = account.currentBalance ?? 0;
	const available = account.availableBalance;
	const isLiability = ["credit", "loan"].includes(account.type);
	return {
		isLiability,
		assetValue: isLiability ? 0 : current,
		liabilityValue: isLiability ? Math.abs(current) : 0,
		availableCash: account.type === "depository" ? (available ?? current) : 0,
	};
}

export const getFinancialOverviewTool: McpToolImplementation<FinancialOverviewInput> =
	{
		contract: mcpToolContracts["moat.getFinancialOverview"],
		async execute(_input, context) {
			const [accounts, manualInvestments, realEstate, coverage] =
				await Promise.all([
					getActiveAccounts(context),
					context.db.investment.findMany({
						where: { userId: context.userId },
						select: { startingBalance: true },
					}),
					context.db.realEstateInvestment.findMany({
						where: { userId: context.userId },
						select: {
							currentEstimatedValue: true,
							currentLoanBalance: true,
						},
					}),
					getAccountSyncCoverage(context),
				]);

			let assets = 0;
			let liabilities = 0;
			let availableCash = 0;
			for (const account of accounts) {
				const classified = classifyAccountBalance(account);
				assets += classified.assetValue;
				liabilities += classified.liabilityValue;
				availableCash += classified.availableCash;
			}

			const manualInvestmentTotal = manualInvestments.reduce(
				(sum, item) => sum + item.startingBalance,
				0,
			);
			const realEstateAssetTotal = realEstate.reduce(
				(sum, property) => sum + property.currentEstimatedValue,
				0,
			);
			const realEstateLiabilityTotal = realEstate.reduce(
				(sum, property) => sum + property.currentLoanBalance,
				0,
			);

			assets += manualInvestmentTotal + realEstateAssetTotal;
			liabilities += realEstateLiabilityTotal;
			const netWorth = assets - liabilities;

			return schemaEnvelope("finance.overview", {
				asOf: coverage.asOf,
				totals: {
					assets,
					liabilities,
					netWorth,
					availableCash,
					accountCount: accounts.length,
				},
				coverage,
				definitive: coverage.isComplete,
			});
		},
	};

export const getNetWorthTool: McpToolImplementation<NetWorthInput> = {
	contract: mcpToolContracts["moat.getNetWorth"],
	async execute(input, context) {
		const [accounts, manualInvestments, realEstate, otherAssets, coverage] =
			await Promise.all([
				getActiveAccounts(context),
				context.db.investment.findMany({
					where: { userId: context.userId },
					select: {
						id: true,
						name: true,
						startingBalance: true,
					},
				}),
				context.db.realEstateInvestment.findMany({
					where: { userId: context.userId },
					select: {
						id: true,
						name: true,
						currentEstimatedValue: true,
						currentLoanBalance: true,
					},
				}),
				getProfileOtherAssetsForNetWorth(context),
				getAccountSyncCoverage(context),
			]);

		const includedAccounts = accounts.map((account) => {
			const classified = classifyAccountBalance(account);
			return {
				id: account.id,
				name: account.name,
				mask: account.mask ? `••••${account.mask}` : null,
				type: account.type,
				subtype: account.subtype,
				institutionName: account.plaidItem.institutionName,
				role: classified.isLiability ? "liability" : "asset",
				balance: classified.isLiability
					? classified.liabilityValue
					: classified.assetValue,
			};
		});

		const otherAssetTotal = otherAssets.reduce(
			(sum, asset) => sum + asset.estimatedValue,
			0,
		);
		const assets =
			includedAccounts
				.filter((account) => account.role === "asset")
				.reduce((sum, account) => sum + account.balance, 0) +
			manualInvestments.reduce((sum, item) => sum + item.startingBalance, 0) +
			realEstate.reduce(
				(sum, property) => sum + property.currentEstimatedValue,
				0,
			) +
			otherAssetTotal;
		const liabilities =
			includedAccounts
				.filter((account) => account.role === "liability")
				.reduce((sum, account) => sum + account.balance, 0) +
			realEstate.reduce(
				(sum, property) => sum + property.currentLoanBalance,
				0,
			);

		return schemaEnvelope("finance.net_worth", {
			asOf: coverage.asOf,
			assets,
			liabilities,
			netWorth: assets - liabilities,
			includedAccounts: input.includeAccountDetails ? includedAccounts : [],
			manualInvestments: input.includeAccountDetails
				? manualInvestments.map((item) => ({
						id: item.id,
						name: item.name,
						balance: item.startingBalance,
					}))
				: [],
			realEstate: input.includeAccountDetails
				? realEstate.map((property) => ({
						id: property.id,
						name: property.name,
						estimatedValue: property.currentEstimatedValue,
						loanBalance: property.currentLoanBalance,
						equity:
							property.currentEstimatedValue - property.currentLoanBalance,
					}))
				: [],
			otherAssets: input.includeAccountDetails ? otherAssets : [],
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const getLiabilitiesTool: McpToolImplementation<LiabilitiesInput> = {
	contract: mcpToolContracts["moat.getLiabilities"],
	async execute(_input, context) {
		const [accounts, realEstate, coverage] = await Promise.all([
			getActiveAccounts(context),
			context.db.realEstateInvestment.findMany({
				where: { userId: context.userId },
				select: {
					id: true,
					name: true,
					currentLoanBalance: true,
					interestRate: true,
					monthlyMortgagePayment: true,
				},
			}),
			getAccountSyncCoverage(context),
		]);

		const creditAndLoans = accounts
			.filter((account) => ["credit", "loan"].includes(account.type))
			.map((account) => {
				const balance = Math.abs(account.currentBalance ?? 0);
				return {
					id: account.id,
					name: account.name,
					mask: account.mask ? `••••${account.mask}` : null,
					type: account.type,
					subtype: account.subtype,
					institutionName: account.plaidItem.institutionName,
					balance,
					availableCredit: account.availableBalance,
					apr: null as number | null,
					minimumPayment: null as number | null,
					dueDate: null as string | null,
					utilization:
						account.type === "credit" &&
						account.availableBalance != null &&
						account.availableBalance + balance > 0
							? balance / (account.availableBalance + balance)
							: null,
					fieldsUnavailable: ["apr", "minimumPayment", "dueDate"] as string[],
				};
			});

		const propertyLoans = realEstate
			.filter((property) => property.currentLoanBalance > 0)
			.map((property) => {
				const unavailable = ["dueDate"];
				if (property.interestRate == null) unavailable.push("apr");
				if (property.monthlyMortgagePayment == null) {
					unavailable.push("minimumPayment");
				}
				return {
					id: property.id,
					name: property.name,
					mask: null as string | null,
					type: "loan",
					subtype: "mortgage",
					institutionName: null as string | null,
					balance: property.currentLoanBalance,
					availableCredit: null as number | null,
					apr: property.interestRate,
					minimumPayment: property.monthlyMortgagePayment,
					dueDate: null as string | null,
					utilization: null as number | null,
					fieldsUnavailable: unavailable,
				};
			});

		const liabilities = [...creditAndLoans, ...propertyLoans];
		return schemaEnvelope("finance.liabilities", {
			asOf: coverage.asOf,
			totalLiabilities: liabilities.reduce(
				(sum, item) => sum + item.balance,
				0,
			),
			liabilities,
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const getCashFlowTool: McpToolImplementation<CashFlowInput> = {
	contract: mcpToolContracts["moat.getCashFlow"],
	async execute(input, context) {
		const endDate = input.endDate
			? new Date(`${input.endDate}T23:59:59.999Z`)
			: endOfMonth(new Date());
		const startDate = input.startDate
			? new Date(`${input.startDate}T00:00:00.000Z`)
			: startOfMonth(subMonths(endDate, input.months - 1));

		const [rows, coverage] = await Promise.all([
			context.db.transaction.findMany({
				where: {
					userId: context.userId,
					hidden: false,
					removedAt: null,
					date: { gte: startDate, lte: endDate },
					AND: [splitParentExclusionWhere],
				},
				select: {
					amount: true,
					type: true,
					pending: true,
					category: true,
					categoryRef: { select: { name: true } },
				},
			}),
			getAccountSyncCoverage(context),
		]);

		let inflows = 0;
		let outflows = 0;
		let transfers = 0;
		let pendingInflows = 0;
		let pendingOutflows = 0;
		let postedCount = 0;
		let pendingCount = 0;

		for (const row of rows) {
			const amount = Math.abs(toNumber(row.amount) ?? 0);
			const category = row.categoryRef?.name ?? row.category ?? null;
			const transfer = isTransferCategory(category);

			if (row.pending) {
				pendingCount += 1;
				if (row.type === "INCOME") pendingInflows += amount;
				else pendingOutflows += amount;
				continue;
			}

			postedCount += 1;
			if (transfer) {
				transfers += amount;
				continue;
			}
			if (row.type === "INCOME") inflows += amount;
			else outflows += amount;
		}

		const limitations = [...coverage.limitations];
		if (pendingCount > 0) {
			limitations.push(
				`${pendingCount} pending transaction(s) excluded from posted cash-flow totals.`,
			);
		}

		return schemaEnvelope("finance.cash_flow", {
			asOf: coverage.asOf,
			period: {
				startDate: startDate.toISOString().slice(0, 10),
				endDate: endDate.toISOString().slice(0, 10),
			},
			posted: {
				inflows,
				outflows,
				transfers,
				netCashFlow: inflows - outflows,
				transactionCount: postedCount,
			},
			pending: {
				inflows: pendingInflows,
				outflows: pendingOutflows,
				transactionCount: pendingCount,
			},
			coverage: {
				...coverage,
				limitations,
				isComplete: coverage.isComplete && pendingCount === 0,
			},
			definitive: coverage.isComplete && pendingCount === 0,
			notes: [
				"Income and expense totals exclude Transfer-categorized rows.",
				"Refunds appear as income or expense according to stored transaction type.",
			],
		});
	},
};

export const listRecurringBillsTool: McpToolImplementation<RecurringBillsInput> =
	{
		contract: mcpToolContracts["moat.listRecurringBills"],
		async execute(input, context) {
			const coverage = await getAccountSyncCoverage(context);
			const horizonEnd = addDays(new Date(), input.daysAhead);
			const events = await context.db.expectedRecurringEvent.findMany({
				where: {
					userId: context.userId,
					isActive: true,
				},
				orderBy: { updatedAt: "desc" },
				take: input.limit,
			});

			const bills = events.map((event) => {
				const now = new Date();
				const day = Math.min(
					Math.max(event.expectedWindowStartDay ?? now.getDate(), 1),
					28,
				);
				let nextExpected = new Date(
					Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), day),
				);
				if (nextExpected < now) {
					nextExpected = new Date(
						Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, day),
					);
				}
				const withinHorizon = nextExpected <= horizonEnd;
				return {
					id: event.id,
					label: event.label,
					amount: event.amount,
					cadence: event.cadence,
					nextExpectedDate: nextExpected.toISOString().slice(0, 10),
					status: withinHorizon
						? ("expected_soon" as const)
						: ("scheduled" as const),
					lastMatchedAt: event.lastMatchedAt?.toISOString() ?? null,
					accountIds: event.accountIds,
				};
			});

			const limitations = [...coverage.limitations];
			if (bills.length === 0) {
				limitations.push(
					"No active recurring obligations were detected for this user yet.",
				);
			}

			return schemaEnvelope("finance.recurring_bills", {
				asOf: coverage.asOf,
				daysAhead: input.daysAhead,
				bills,
				coverage: {
					...coverage,
					limitations,
					isComplete: coverage.isComplete && bills.length > 0,
				},
			});
		},
	};

export const getInvestmentHoldingsTool: McpToolImplementation<InvestmentHoldingsInput> =
	{
		contract: mcpToolContracts["moat.getInvestmentHoldings"],
		async execute(_input, context) {
			const [manualInvestments, plaidInvestmentAccounts, realEstate, coverage] =
				await Promise.all([
					context.db.investment.findMany({
						where: { userId: context.userId },
						select: {
							id: true,
							name: true,
							type: true,
							startingBalance: true,
							monthlyContribution: true,
						},
					}),
					context.db.plaidAccount.findMany({
						where: {
							userId: context.userId,
							type: "investment",
							isActive: true,
							investmentHidden: false,
							accountHidden: false,
						},
						select: {
							id: true,
							name: true,
							mask: true,
							subtype: true,
							currentBalance: true,
							plaidItem: {
								select: {
									institutionName: true,
									lastSuccessfulSyncAt: true,
								},
							},
						},
					}),
					context.db.realEstateInvestment.findMany({
						where: { userId: context.userId },
						select: {
							id: true,
							name: true,
							currentEstimatedValue: true,
							currentLoanBalance: true,
						},
					}),
					getAccountSyncCoverage(context),
				]);

			const holdings = [
				...plaidInvestmentAccounts.map((account) => ({
					id: account.id,
					name: account.name,
					mask: account.mask ? `••••${account.mask}` : null,
					source: "connected_account" as const,
					assetClass: account.subtype ?? "investment",
					institutionName: account.plaidItem.institutionName,
					quantity: null as number | null,
					marketValue: account.currentBalance ?? 0,
					costBasis: null as number | null,
					fieldsUnavailable: ["quantity", "costBasis"],
				})),
				...manualInvestments.map((investment) => ({
					id: investment.id,
					name: investment.name,
					mask: null as string | null,
					source: "manual" as const,
					assetClass: investment.type,
					institutionName: null as string | null,
					quantity: null as number | null,
					marketValue: investment.startingBalance,
					costBasis: null as number | null,
					fieldsUnavailable: ["quantity", "costBasis"],
				})),
				...realEstate.map((property) => ({
					id: property.id,
					name: property.name,
					mask: null as string | null,
					source: "real_estate" as const,
					assetClass: "real_estate",
					institutionName: null as string | null,
					quantity: 1,
					marketValue:
						property.currentEstimatedValue - property.currentLoanBalance,
					costBasis: null as number | null,
					fieldsUnavailable: ["costBasis"],
				})),
			];

			const totalValue = holdings.reduce(
				(sum, holding) => sum + holding.marketValue,
				0,
			);
			const limitations = [
				...coverage.limitations,
				"Security-level lot quantities and cost basis are not available for most connected brokerages in v1; values are account-level.",
			];

			return schemaEnvelope("finance.investment_holdings", {
				asOf: coverage.asOf,
				totalValue,
				allocation: holdings.map((holding) => ({
					id: holding.id,
					name: holding.name,
					assetClass: holding.assetClass,
					marketValue: holding.marketValue,
					percentOfTotal:
						totalValue > 0 ? (holding.marketValue / totalValue) * 100 : 0,
				})),
				holdings,
				coverage: {
					...coverage,
					limitations,
					isComplete: false,
				},
				definitive: false,
			});
		},
	};
