import type { AccountSummary } from "@moat/data-access";
import {
	cashFlowInputSchema,
	mcpToolContracts,
	netWorthInputSchema,
	recurringBillsInputSchema,
} from "@moat/mcp-contracts";
import { addDays, endOfMonth, startOfMonth, subMonths } from "date-fns";
import { localCoverage } from "./format";
import type { LocalToolContext, LocalToolImplementation } from "./types";
import { localSchemaEnvelope } from "./types";

function isTransferCategory(category: string | null | undefined): boolean {
	if (!category) return false;
	return category.trim().toLowerCase() === "transfer";
}

function classifyAccountBalance(account: AccountSummary) {
	const current = account.currentBalance ?? 0;
	const isLiability = ["credit", "loan"].includes(account.type);
	return {
		isLiability,
		assetValue: isLiability ? 0 : current,
		liabilityValue: isLiability ? Math.abs(current) : 0,
		availableCash: account.type === "depository" ? current : 0,
	};
}

function normalizeBillLabel(description: string | null): string {
	return (description ?? "Unknown")
		.trim()
		.toLowerCase()
		.replace(/\s+/g, " ")
		.slice(0, 80);
}

async function listActiveAccounts(ctx: LocalToolContext) {
	const { userId, repositories } = ctx.appRuntime;
	const accounts = await repositories.accounts.listForSummary({ userId });
	return accounts.filter((account) => !account.isHidden && account.isActive);
}

export const getFinancialOverviewTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getFinancialOverview"],
	async execute(_input, ctx: LocalToolContext) {
		const { userId, repositories } = ctx.appRuntime;
		const [accounts, investments, realEstate] = await Promise.all([
			listActiveAccounts(ctx),
			repositories.investments?.list({ userId }) ?? Promise.resolve([]),
			repositories.realEstate?.list({ userId }) ?? Promise.resolve([]),
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

		const manualInvestmentTotal = investments.reduce(
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
		const coverage = localCoverage(accounts.length);

		return localSchemaEnvelope("finance.overview", {
			asOf: coverage.asOf,
			totals: {
				assets,
				liabilities,
				netWorth: assets - liabilities,
				availableCash,
				accountCount: accounts.length,
			},
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const getNetWorthTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getNetWorth"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = netWorthInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const [accounts, investments, realEstate, profile] = await Promise.all([
			listActiveAccounts(ctx),
			repositories.investments?.list({ userId }) ?? Promise.resolve([]),
			repositories.realEstate?.list({ userId }) ?? Promise.resolve([]),
			repositories.financialProfileData?.get({ userId }) ??
				Promise.resolve(null),
		]);

		const otherAssets = (profile?.assets ?? [])
			.filter(
				(asset) =>
					asset.includeInNetWorth &&
					asset.type !== "Real estate" &&
					!asset.id.startsWith("real-estate-"),
			)
			.map((asset) => ({
				id: asset.id,
				name: asset.name,
				type: asset.type,
				estimatedValue: asset.estimatedValue,
			}));

		const includedAccounts = accounts.map((account) => {
			const classified = classifyAccountBalance(account);
			return {
				id: account.id,
				name: account.name,
				mask: account.mask ? `••••${account.mask}` : null,
				type: account.type,
				subtype: account.subtype,
				institutionName: null as string | null,
				role: classified.isLiability
					? ("liability" as const)
					: ("asset" as const),
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
			investments.reduce((sum, item) => sum + item.startingBalance, 0) +
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

		const coverage = localCoverage(accounts.length);

		return localSchemaEnvelope("finance.net_worth", {
			asOf: coverage.asOf,
			assets,
			liabilities,
			netWorth: assets - liabilities,
			includedAccounts: parsed.includeAccountDetails ? includedAccounts : [],
			manualInvestments: parsed.includeAccountDetails
				? investments.map((item) => ({
						id: item.id,
						name: item.name,
						balance: item.startingBalance,
					}))
				: [],
			realEstate: parsed.includeAccountDetails
				? realEstate.map((property) => ({
						id: property.id,
						name: property.name,
						estimatedValue: property.currentEstimatedValue,
						loanBalance: property.currentLoanBalance,
						equity:
							property.currentEstimatedValue - property.currentLoanBalance,
					}))
				: [],
			otherAssets: parsed.includeAccountDetails ? otherAssets : [],
			coverage,
			definitive: coverage.isComplete,
		});
	},
};

export const getLiabilitiesTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getLiabilities"],
	async execute(_input, ctx: LocalToolContext) {
		const { userId, repositories } = ctx.appRuntime;
		const [accounts, realEstate] = await Promise.all([
			listActiveAccounts(ctx),
			repositories.realEstate?.list({ userId }) ?? Promise.resolve([]),
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
					institutionName: null as string | null,
					balance,
					availableCredit: null as number | null,
					apr: null as number | null,
					minimumPayment: null as number | null,
					dueDate: null as string | null,
					utilization: null as number | null,
					fieldsUnavailable: [
						"apr",
						"minimumPayment",
						"dueDate",
						"availableCredit",
						"utilization",
					],
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
		const coverage = localCoverage(accounts.length);

		return localSchemaEnvelope("finance.liabilities", {
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

export const getCashFlowTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getCashFlow"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = cashFlowInputSchema.parse(input ?? {});
		const endDate = parsed.endDate
			? new Date(`${parsed.endDate}T23:59:59.999Z`)
			: endOfMonth(new Date());
		const startDate = parsed.startDate
			? new Date(`${parsed.startDate}T00:00:00.000Z`)
			: startOfMonth(subMonths(endDate, parsed.months - 1));

		const { userId, repositories } = ctx.appRuntime;
		const [rows, accounts] = await Promise.all([
			repositories.transactions.listRecent({
				userId,
				limit: 10_000,
				startDate,
				endDate,
			}),
			listActiveAccounts(ctx),
		]);

		let inflows = 0;
		let outflows = 0;
		let transfers = 0;
		let postedCount = 0;

		for (const row of rows) {
			const amount = Math.abs(row.amount);
			const transfer = isTransferCategory(row.category);
			postedCount += 1;
			if (transfer) {
				transfers += amount;
				continue;
			}
			if (row.type === "INCOME") inflows += amount;
			else outflows += amount;
		}

		const coverage = localCoverage(accounts.length);
		const limitations = [
			...coverage.limitations,
			"Local desktop transactions do not expose pending vs posted status; all rows are treated as posted.",
		];

		return localSchemaEnvelope("finance.cash_flow", {
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
				inflows: 0,
				outflows: 0,
				transactionCount: 0,
			},
			coverage: {
				...coverage,
				limitations,
				isComplete: coverage.isComplete,
			},
			definitive: coverage.isComplete,
			notes: [
				"Income and expense totals exclude Transfer-categorized rows.",
				"Refunds appear as income or expense according to stored transaction type.",
			],
		});
	},
};

export const listRecurringBillsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.listRecurringBills"],
	async execute(input, ctx: LocalToolContext) {
		const parsed = recurringBillsInputSchema.parse(input ?? {});
		const { userId, repositories } = ctx.appRuntime;
		const now = new Date();
		const horizonEnd = addDays(now, parsed.daysAhead);
		const lookbackStart = startOfMonth(subMonths(now, 5));

		const [rows, accounts] = await Promise.all([
			repositories.transactions.listRecent({
				userId,
				limit: 10_000,
				startDate: lookbackStart,
				endDate: now,
			}),
			listActiveAccounts(ctx),
		]);

		const groups = new Map<
			string,
			{
				label: string;
				amounts: number[];
				days: number[];
				months: Set<string>;
			}
		>();

		for (const row of rows) {
			if (row.type !== "EXPENSE") continue;
			if (isTransferCategory(row.category)) continue;
			const label = normalizeBillLabel(row.description);
			if (!label || label === "unknown") continue;
			const monthKey = row.date.toISOString().slice(0, 7);
			const existing = groups.get(label);
			if (existing) {
				existing.amounts.push(Math.abs(row.amount));
				existing.days.push(row.date.getUTCDate());
				existing.months.add(monthKey);
			} else {
				groups.set(label, {
					label: row.description?.trim() || "Unknown",
					amounts: [Math.abs(row.amount)],
					days: [row.date.getUTCDate()],
					months: new Set([monthKey]),
				});
			}
		}

		const bills = [...groups.entries()]
			.filter(([, group]) => group.months.size >= 2)
			.map(([id, group]) => {
				const avg =
					group.amounts.reduce((sum, amount) => sum + amount, 0) /
					group.amounts.length;
				const isStable = group.amounts.every(
					(amount) => avg > 0 && Math.abs(amount - avg) / avg < 0.2,
				);
				if (!isStable || avg <= 0) return null;

				const day = Math.min(
					Math.max(
						Math.round(
							group.days.reduce((sum, value) => sum + value, 0) /
								group.days.length,
						),
						1,
					),
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
					id,
					label: group.label,
					amount: Math.round(avg * 100) / 100,
					cadence: "monthly" as const,
					nextExpectedDate: nextExpected.toISOString().slice(0, 10),
					status: withinHorizon
						? ("expected_soon" as const)
						: ("scheduled" as const),
					lastMatchedAt: null as string | null,
					accountIds: [] as string[],
				};
			})
			.filter((bill): bill is NonNullable<typeof bill> => bill !== null)
			.sort((a, b) => a.nextExpectedDate.localeCompare(b.nextExpectedDate))
			.slice(0, parsed.limit);

		const coverage = localCoverage(accounts.length);
		const limitations = [
			...coverage.limitations,
			"Recurring bills are inferred from local expense history; dedicated recurring-obligation records are not stored on desktop yet.",
		];
		if (bills.length === 0) {
			limitations.push(
				"No recurring obligations were detected from recent expense history.",
			);
		}

		return localSchemaEnvelope("finance.recurring_bills", {
			asOf: coverage.asOf,
			daysAhead: parsed.daysAhead,
			bills,
			coverage: {
				...coverage,
				limitations,
				isComplete: coverage.isComplete && bills.length > 0,
			},
		});
	},
};

export const getInvestmentHoldingsTool: LocalToolImplementation = {
	contract: mcpToolContracts["moat.getInvestmentHoldings"],
	async execute(_input, ctx: LocalToolContext) {
		const { userId, repositories } = ctx.appRuntime;
		const [accounts, investments, realEstate] = await Promise.all([
			listActiveAccounts(ctx),
			repositories.investments?.list({ userId }) ?? Promise.resolve([]),
			repositories.realEstate?.list({ userId }) ?? Promise.resolve([]),
		]);

		const investmentAccounts = accounts.filter((account) => {
			const type = account.type.toLowerCase();
			const subtype = account.subtype?.toLowerCase() ?? "";
			return (
				type === "investment" ||
				type === "brokerage" ||
				["roth", "ira", "401k", "403b", "457b", "hsa", "529", "brokerage"].some(
					(token) => subtype.includes(token),
				)
			);
		});

		const holdings = [
			...investmentAccounts.map((account) => ({
				id: account.id,
				name: account.name,
				mask: account.mask ? `••••${account.mask}` : null,
				source: "connected_account" as const,
				assetClass: account.subtype ?? "investment",
				institutionName: null as string | null,
				quantity: null as number | null,
				marketValue: account.currentBalance ?? 0,
				costBasis: null as number | null,
				fieldsUnavailable: ["quantity", "costBasis"],
			})),
			...investments.map((investment) => ({
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
		const coverage = localCoverage(accounts.length);
		const limitations = [
			...coverage.limitations,
			"Security-level lot quantities and cost basis are not available; values are account-level.",
		];

		return localSchemaEnvelope("finance.investment_holdings", {
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
