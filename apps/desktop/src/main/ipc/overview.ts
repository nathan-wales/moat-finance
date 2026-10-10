import {
	AccountBalanceHistoryResponseSchema,
	AssetValueHistoryResponseSchema,
	BalanceSnapshotHistoryResponseSchema,
	CashFlowResponseSchema,
	GetAccountBalanceHistoryInputSchema,
	GetAssetValueHistoryInputSchema,
	GetBalanceSnapshotHistoryInputSchema,
	GetMonthlyAggregatesInputSchema,
	GetPreviousMonthCashFlowInputSchema,
	MonthlyAggregatesResponseSchema,
	OVERVIEW_CHANNELS,
	PortfolioAllocationResponseSchema,
	SummaryMetricsSchema,
} from "@moat/contracts";
import {
	type AccountBalanceHistoryStore,
	buildAccountBalanceHistory,
	formatAccountTypeLabel,
	formatBalanceSyncLabel,
	getBalanceSnapshotHistory,
	getMonthlyAggregates,
	getPreviousMonthCashFlow,
	getSummaryMetrics,
	toAccountHistoryId,
	toMonthlyAssetHistory,
} from "@moat/domain";
import { ipcMain } from "electron";
import { getUnlockedDesktopDb } from "./vault-guard";

/**
 * Registers all IPC handlers for the overview / dashboard feature.
 *
 * Handler pattern:
 *   1. Parse input with Zod (rejects malformed payloads before domain layer)
 *   2. Call domain service with AppRuntime (AppContext) from getDesktopDb()
 *   3. Validate response with Zod schema before returning to renderer
 *   4. Log and rethrow errors — no silent failures
 *
 * All handlers use userId: "local-user" (single-user desktop, no auth in v1).
 */
export function registerOverviewHandlers(): void {
	// ─── getSummaryMetrics ────────────────────────────────────────────────────

	ipcMain.handle(OVERVIEW_CHANNELS.GET_SUMMARY_METRICS, async () => {
		try {
			const { appCtx } = getUnlockedDesktopDb();
			const result = await getSummaryMetrics(appCtx);
			return SummaryMetricsSchema.parse(result);
		} catch (err) {
			console.error("[overview:getSummaryMetrics] error", err);
			throw err;
		}
	});

	// ─── getMonthlyAggregates ─────────────────────────────────────────────────

	ipcMain.handle(
		OVERVIEW_CHANNELS.GET_MONTHLY_AGGREGATES,
		async (_event, rawInput: unknown) => {
			try {
				const input = GetMonthlyAggregatesInputSchema.parse(rawInput ?? {});
				const { appCtx } = getUnlockedDesktopDb();
				const result = await getMonthlyAggregates(appCtx, {
					months: input.months,
				});
				return MonthlyAggregatesResponseSchema.parse(result);
			} catch (err) {
				console.error("[overview:getMonthlyAggregates] error", err);
				throw err;
			}
		},
	);

	// ─── getBalanceSnapshotHistory ────────────────────────────────────────────
	//
	// Anchors historical net worth to accounts + manual investments + real
	// estate, then compounds investable assets / equity for the forecast
	// (same model as the cloud balance-snapshot handler).

	ipcMain.handle(
		OVERVIEW_CHANNELS.GET_BALANCE_SNAPSHOT_HISTORY,
		async (_event, rawInput: unknown) => {
			try {
				const input = GetBalanceSnapshotHistoryInputSchema.parse(
					rawInput ?? {},
				);
				const { appCtx } = getUnlockedDesktopDb();
				const result = await getBalanceSnapshotHistory(appCtx, {
					months: input.months,
					forecastMonths: input.forecastMonths,
				});
				return BalanceSnapshotHistoryResponseSchema.parse(result);
			} catch (err) {
				console.error("[overview:getBalanceSnapshotHistory] error", err);
				throw err;
			}
		},
	);

	ipcMain.handle(
		OVERVIEW_CHANNELS.GET_ACCOUNT_BALANCE_HISTORY,
		async (_event, rawInput: unknown) => {
			try {
				const input = GetAccountBalanceHistoryInputSchema.parse(rawInput);
				const { appCtx, db } = getUnlockedDesktopDb();
				const result = await buildAccountBalanceHistory(
					createAccountBalanceHistoryStore(db),
					appCtx.userId,
					input,
				);
				return AccountBalanceHistoryResponseSchema.parse(result);
			} catch (err) {
				console.error("[overview:getAccountBalanceHistory] error", err);
				throw err;
			}
		},
	);

	ipcMain.handle(
		OVERVIEW_CHANNELS.GET_ASSET_VALUE_HISTORY,
		async (_event, rawInput: unknown) => {
			try {
				const input = GetAssetValueHistoryInputSchema.parse(rawInput);
				const months = input.months ?? 24;
				const { appCtx, db } = getUnlockedDesktopDb();

				if (input.source === "REAL_ESTATE") {
					const property = (await db.realEstateInvestment.findFirst({
						where: { id: input.sourceId, userId: appCtx.userId },
						select: {
							currentEstimatedValue: true,
							currentLoanBalance: true,
						},
					})) as {
						currentEstimatedValue: number;
						currentLoanBalance: number;
					} | null;
					if (!property) {
						throw new Error("Asset not found");
					}
					const current =
						property.currentEstimatedValue - property.currentLoanBalance;
					return AssetValueHistoryResponseSchema.parse(
						toMonthlyAssetHistory([], current, months),
					);
				}

				const result = await buildAccountBalanceHistory(
					createAccountBalanceHistoryStore(db),
					appCtx.userId,
					{ accountId: toAccountHistoryId(input.source, input.sourceId) },
				);
				return AssetValueHistoryResponseSchema.parse(
					toMonthlyAssetHistory(
						result.points.map((point) => ({
							date: point.date,
							value: point.balance,
						})),
						result.currentBalance,
						months,
					),
				);
			} catch (err) {
				console.error("[overview:getAssetValueHistory] error", err);
				throw err;
			}
		},
	);

	// ─── getPortfolioAllocation ───────────────────────────────────────────────
	//
	// Aggregates Investment records + RealEstateInvestment records from local
	// SQLite, grouped by type into the PortfolioAllocationResponse contract.
	// Cash accounts are included as a "cash" section for net-worth completeness.

	ipcMain.handle(OVERVIEW_CHANNELS.GET_PORTFOLIO_ALLOCATION, async () => {
		try {
			const { appCtx } = getUnlockedDesktopDb();
			const { investments: investmentsRepo, realEstate: realEstateRepo } =
				appCtx.repositories;
			if (!investmentsRepo || !realEstateRepo) {
				throw new Error("Portfolio repositories are not available");
			}

			const plaidAccounts =
				(await appCtx.repositories.plaidAccounts?.listActiveForUser({
					userId: appCtx.userId,
				})) ?? [];

			const lastSyncedByAccountId = new Map(
				plaidAccounts.map((account) => [
					account.id,
					formatBalanceSyncLabel(account.lastBalanceSyncAt),
				]),
			);

			function lastSyncedForAccount(accountId: string): string | undefined {
				return lastSyncedByAccountId.get(accountId);
			}

			const [investments, realEstateItems, cashAccounts] = await Promise.all([
				investmentsRepo.list({ userId: appCtx.userId }),
				realEstateRepo.list({ userId: appCtx.userId }),
				appCtx.repositories.accounts.listForSummary({ userId: appCtx.userId }),
			]);

			// Map investment type → PortfolioAllocationSectionKey
			const typeToKey: Record<
				string,
				"stocks" | "rothIra" | "401k" | "hsa" | "realEstate"
			> = {
				STOCKS: "stocks",
				ROTH_IRA: "rothIra",
				FOUR01K: "401k",
				HSA: "hsa",
				REAL_ESTATE: "realEstate",
			};

			const sectionMap = new Map<
				string,
				{
					key: string;
					label: string;
					items: {
						id: string;
						name: string;
						subtitle?: string;
						lastSynced?: string;
						value: number;
					}[];
				}
			>();

			const sectionLabels: Record<string, string> = {
				stocks: "Stocks",
				rothIra: "Roth IRA",
				"401k": "401(k)",
				hsa: "HSA",
				realEstate: "Real Estate",
				cash: "Cash & Savings",
			};

			function getOrCreateSection(key: string) {
				let section = sectionMap.get(key);
				if (!section) {
					section = {
						key,
						label: sectionLabels[key] ?? key,
						items: [],
					};
					sectionMap.set(key, section);
				}
				return section;
			}

			// Populate from Investment records
			for (const inv of investments) {
				const key = typeToKey[inv.type] ?? "stocks";
				getOrCreateSection(key).items.push({
					id: inv.id,
					name: inv.name,
					value: inv.startingBalance,
				});
			}

			// Populate from RealEstateInvestment records (equity = value − loan)
			for (const re of realEstateItems) {
				const key = "realEstate";
				const equity = re.currentEstimatedValue - re.currentLoanBalance;
				getOrCreateSection(key).items.push({
					id: re.id,
					name: re.name,
					subtitle: re.usageType.toLowerCase().replace(/_/g, " "),
					value: equity,
				});
			}

			// Map Plaid investment account subtypes → section keys
			const plaidSubtypeToKey: Record<string, string> = {
				brokerage: "stocks",
				"mutual fund": "stocks",
				roth: "rothIra",
				"roth 401k": "rothIra",
				ira: "stocks",
				"traditional ira": "stocks",
				"401k": "401k",
				"403b": "401k",
				"401a": "401k",
				hsa: "hsa",
			};

			// Split accounts by type: depository → cash, investment → proper section
			const activeAccounts = cashAccounts.filter(
				(a) => !a.isHidden && a.isActive,
			);
			const depositoryAccounts = activeAccounts.filter(
				(a) => a.type === "depository" || (!a.type && !a.subtype),
			);
			const plaidInvestmentAccounts = activeAccounts.filter(
				(a) => a.type === "investment",
			);

			// Populate investment sections from Plaid-linked investment accounts
			for (const acct of plaidInvestmentAccounts) {
				const key =
					(acct.subtype && plaidSubtypeToKey[acct.subtype.toLowerCase()]) ??
					"stocks";
				getOrCreateSection(key).items.push({
					id: acct.id,
					name: acct.name,
					subtitle: formatAccountTypeLabel(acct.subtype),
					lastSynced: lastSyncedForAccount(acct.id),
					value: acct.currentBalance ?? 0,
				});
			}

			// Populate cash section from depository accounts
			if (depositoryAccounts.length > 0) {
				sectionMap.set("cash", {
					key: "cash",
					label: sectionLabels.cash,
					items: depositoryAccounts.map((a) => ({
						id: a.id,
						name: a.name,
						subtitle: formatAccountTypeLabel(a.subtype),
						lastSynced: lastSyncedForAccount(a.id),
						value: a.currentBalance ?? 0,
					})),
				});
			}

			const sections = Array.from(sectionMap.values()).map((s) => ({
				key: s.key as
					| "stocks"
					| "rothIra"
					| "401k"
					| "cash"
					| "hsa"
					| "realEstate",
				label: s.label,
				value: s.items.reduce((sum, item) => sum + item.value, 0),
				items: s.items,
			}));

			return PortfolioAllocationResponseSchema.parse({ sections });
		} catch (err) {
			console.error("[overview:getPortfolioAllocation] error", err);
			throw err;
		}
	});

	// ─── getPreviousMonthCashFlow ─────────────────────────────────────────────

	ipcMain.handle(
		OVERVIEW_CHANNELS.GET_PREVIOUS_MONTH_CASH_FLOW,
		async (_event, rawInput: unknown) => {
			try {
				const input = GetPreviousMonthCashFlowInputSchema.parse(rawInput ?? {});
				const { appCtx } = getUnlockedDesktopDb();
				const result = await getPreviousMonthCashFlow(appCtx, {
					month: input.month,
				});
				return CashFlowResponseSchema.parse(result);
			} catch (err) {
				console.error("[overview:getPreviousMonthCashFlow] error", err);
				throw err;
			}
		},
	);
}

function createAccountBalanceHistoryStore(
	db: ReturnType<typeof getUnlockedDesktopDb>["db"],
): AccountBalanceHistoryStore {
	return {
		async listPoints({ userId, source, sourceId }) {
			const rows = (await db.accountBalanceHistory.findMany({
				where: { userId, source, sourceId },
				orderBy: { date: "asc" },
				select: { date: true, balance: true },
			})) as Array<{ date: Date; balance: number }>;
			return rows;
		},
		async getCurrentBalance({ userId, source, sourceId }) {
			if (source === "PLAID") {
				const account = (await db.plaidAccount.findFirst({
					where: {
						id: sourceId,
						isActive: true,
						item: { userId },
					},
					select: {
						currentBalance: true,
						availableBalance: true,
					},
				})) as {
					currentBalance: number | null;
					availableBalance: number | null;
				} | null;
				if (!account) return null;
				return account.currentBalance ?? account.availableBalance ?? 0;
			}
			if (source === "INVESTMENT") {
				const investment = (await db.investment.findFirst({
					where: { id: sourceId, userId },
					select: { startingBalance: true },
				})) as { startingBalance: number } | null;
				return investment?.startingBalance ?? null;
			}
			return null;
		},
	};
}
