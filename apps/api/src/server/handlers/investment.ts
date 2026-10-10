import { FinancialProfileDataSchema } from "@moat/contracts";
import {
	formatAccountTypeLabel,
	formatBalanceSyncLabel,
	initialNextAccrualDueAt,
	stripManualInvestmentFromProfile,
} from "@moat/domain";
import { z } from "zod";
import {
	forecastInvestmentGrowth,
	projectRealEstateEquity,
} from "~/lib/forecasting";
import { logger } from "~/lib/logger";
import { takeSnapshot } from "~/server/services/balance-snapshot.service";
import {
	mergeInvestments,
	mergeProperties,
} from "~/server/services/demo/demo-merge.service";
import {
	deleteOverlayInvestment,
	getFinancialProfileOverlay,
	getInvestmentsOverlay,
	getPropertiesOverlay,
	updateFinancialProfileOverlay,
	upsertOverlayInvestment,
} from "~/server/services/demo/demo-overlay.service";
import type { InvestmentType, Prisma } from "../../../generated/prisma";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";
import {
	collectLiveInstitutionKeys,
	shouldDisplayPlaidItem,
} from "../plaid/access-state";
import { getAccountHoldings } from "../services/investment/account-holdings.service";
import { getRolledUpPortfolioAllocation } from "../services/profiles/net-worth-rollup.service";

const plaidItemAccessSelect = {
	institutionId: true,
	institutionName: true,
	accessRevokedAt: true,
	accessTokenEncrypted: true,
	lastBalanceSyncAt: true,
} as const;

function visiblePlaidInvestmentAccounts<
	T extends {
		plaidItem: {
			institutionId: string | null;
			institutionName: string;
			accessRevokedAt: Date | null;
			accessTokenEncrypted: string | null;
		};
	},
>(accounts: T[]): T[] {
	const liveKeys = collectLiveInstitutionKeys(
		accounts.map((account) => account.plaidItem),
	);
	return accounts.filter((account) =>
		shouldDisplayPlaidItem(account.plaidItem, liveKeys),
	);
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

async function stripInvestmentFromDemoFinancialProfile(
	sessionKey: string,
	investmentId: string,
): Promise<void> {
	const overlay = await getFinancialProfileOverlay(sessionKey);
	if (!overlay) return;
	const parsed = FinancialProfileDataSchema.safeParse(overlay);
	if (!parsed.success) return;
	const next = stripManualInvestmentFromProfile(parsed.data, investmentId);
	await updateFinancialProfileOverlay(sessionKey, next);
}

type PlaidInvestmentAccount = {
	id: string;
	userId: string;
	subtype: string | null;
	name: string;
	currentBalance: number | null;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	createdAt: Date;
	updatedAt: Date;
	lastBalanceSyncAt?: Date | null;
	plaidItem?: { lastBalanceSyncAt: Date | null };
};

type PortfolioAllocationInvestment = {
	id: string;
	name: string;
	startingBalance: number;
	lastSynced?: string;
	subtitle?: string;
};

const InvestmentTypeEnum = z.enum([
	"STOCKS",
	"REAL_ESTATE",
	"ROTH_IRA",
	"FOUR01K",
	"HSA",
	"OTHER",
]);

const financialProfileAssetSchema = z.object({
	id: z.string(),
	name: z.string(),
	type: z.string(),
	estimatedValue: z.number(),
	includeInNetWorth: z.boolean(),
});

/**
 * Maps a Plaid account subtype to an InvestmentType enum.
 * Returns null if the subtype doesn't map to a known investment type.
 */
function mapPlaidSubtypeToInvestmentType(
	subtype: string | null,
): InvestmentType {
	if (!subtype) return "STOCKS";
	const sub = subtype.toLowerCase();
	if (sub.includes("401")) return "FOUR01K";
	if (sub.includes("roth")) return "ROTH_IRA";
	if (sub.includes("ira") && !sub.includes("roth")) return "ROTH_IRA"; // Default IRA to Roth for now
	if (sub.includes("brokerage")) return "STOCKS";
	if (sub.includes("hsa")) return "HSA";
	return "STOCKS"; // Default to STOCKS for other investment types
}

function mapPlaidAccountToInvestment(acc: PlaidInvestmentAccount) {
	return {
		id: `plaid_${acc.id}`,
		userId: acc.userId,
		type: mapPlaidSubtypeToInvestmentType(acc.subtype),
		name: acc.name,
		startingBalance: acc.currentBalance ?? 0,
		monthlyContribution: acc.monthlyContribution,
		annualReturnRate: acc.annualReturnRate,
		notes: acc.notes ?? null,
		autoUpdateBalance: false,
		lastBalanceAccruedAt: null,
		nextBalanceAccrualDueAt: null,
		createdAt: acc.createdAt,
		updatedAt: acc.updatedAt,
		lastSynced: formatBalanceSyncLabel(
			acc.lastBalanceSyncAt ?? acc.plaidItem?.lastBalanceSyncAt,
		),
		subtitle: formatAccountTypeLabel(acc.subtype),
	};
}

const createInvestmentInput = z.object({
	id: z.string().min(1).optional(),
	type: InvestmentTypeEnum,
	name: z.string().min(1),
	startingBalance: z.number().min(0),
	monthlyContribution: z.number().min(0),
	annualReturnRate: z.number().min(0).max(1),
	notes: z.string().nullable().optional(),
	autoUpdateBalance: z.boolean().optional(),
});

const updateInvestmentInput = z.object({
	id: z.string(),
	name: z.string().min(1).optional(),
	startingBalance: z.number().min(0).optional(),
	monthlyContribution: z.number().min(0).optional(),
	annualReturnRate: z.number().min(0).max(1).optional(),
	notes: z.string().nullable().optional(),
	investmentHidden: z.boolean().optional(),
	autoUpdateBalance: z.boolean().optional(),
});

const deleteInvestmentInput = z.object({ id: z.string() });

const getHoldingsInput = z.object({ accountId: z.string().min(1) });

const getForecastInput = z.object({
	months: z.number().min(1).max(60),
	scenarioOverrides: z
		.object({
			annualReturnRate: z.number().optional(),
			monthlyContribution: z.number().optional(),
		})
		.optional(),
});

function optionalNumberInput(value: unknown): number | undefined {
	const rawValue = Array.isArray(value) ? value[0] : value;
	if (rawValue === undefined || rawValue === "") return undefined;
	return Number(rawValue);
}

function parseFinancialProfileAssets(value: unknown) {
	const result = z.array(financialProfileAssetSchema).safeParse(value);
	if (!result.success) return [];
	return result.data.filter(
		(asset) => asset.includeInNetWorth && asset.type !== "Real estate",
	);
}

export const investment = {
	getAll: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) {
			// In demo mode, fetch the DEMO user's investments, not the real user's
			const demoUserId = ctx.userId;

			const seeded = await ctx.db.investment.findMany({
				where: { userId: demoUserId },
				orderBy: { createdAt: "asc" },
			});

			if (!ctx.demoOverlaySessionKey) {
				return seeded;
			}

			const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
			const merged = mergeInvestments(seeded, overlay);

			return merged;
		}

		// Personal mode - use the authenticated user's ID
		const userId = ctx.userId;

		return ctx.db.investment.findMany({
			where: { userId },
			orderBy: { createdAt: "asc" },
		});
	}),

	create: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = createInvestmentInput.parse(body);
		const autoUpdateBalance = input.autoUpdateBalance ?? true;

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const now = new Date();
			const overlayInvestment = {
				id: input.id ?? crypto.randomUUID(),
				userId: demoUserId,
				type: input.type,
				name: input.name,
				startingBalance: input.startingBalance,
				monthlyContribution: input.monthlyContribution,
				annualReturnRate: input.annualReturnRate,
				notes: input.notes ?? null,
				autoUpdateBalance,
				lastBalanceAccruedAt: null,
				nextBalanceAccrualDueAt: autoUpdateBalance
					? initialNextAccrualDueAt(now)
					: null,
				createdAt: now,
				updatedAt: now,
				_isOverlay: true as const,
			};
			return upsertOverlayInvestment(
				ctx.demoOverlaySessionKey,
				overlayInvestment,
			);
		}

		const userId = ctx.userId;
		const now = new Date();
		const { id: requestedId, ...createFields } = input;
		const investment = await ctx.db.investment.create({
			data: {
				...createFields,
				...(requestedId ? { id: requestedId } : {}),
				userId,
				autoUpdateBalance,
				nextBalanceAccrualDueAt: autoUpdateBalance
					? initialNextAccrualDueAt(now)
					: null,
			},
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after investment create", err, {
				feature: "investment",
				operation: "create",
				userId,
			}),
		);
		return investment;
	}),

	update: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = updateInvestmentInput.parse(body);

		if (input.id.startsWith("plaid_") || input.id.startsWith("plaid-")) {
			if (ctx.isDemoMode) {
				throw new Error("Cannot update Plaid investment accounts in demo mode");
			}

			const userId = ctx.userId;
			const plaidAccountId = input.id.replace(/^plaid[-_]/, "");
			const data: {
				name?: string;
				monthlyContribution?: number;
				annualReturnRate?: number;
				notes?: string | null;
				investmentHidden?: boolean;
				forecastInputsUserEdited: boolean;
			} = { forecastInputsUserEdited: true };

			if (input.name !== undefined) data.name = input.name;
			if (input.monthlyContribution !== undefined)
				data.monthlyContribution = input.monthlyContribution;
			if (input.annualReturnRate !== undefined)
				data.annualReturnRate = input.annualReturnRate;
			if (input.notes !== undefined) data.notes = input.notes;
			if (input.investmentHidden !== undefined)
				data.investmentHidden = input.investmentHidden;

			if (
				input.name === undefined &&
				input.monthlyContribution === undefined &&
				input.annualReturnRate === undefined &&
				input.notes === undefined &&
				input.investmentHidden === undefined
			) {
				throw new Error("No editable fields provided");
			}

			const account = await ctx.db.plaidAccount.findFirst({
				where: {
					id: plaidAccountId,
					userId,
					type: { in: ["investment", "brokerage", "depository", "cash"] },
				},
			});
			if (!account) throw new Error("Plaid account not found");

			const updated = await ctx.db.plaidAccount.update({
				where: { id: account.id },
				data,
			});
			return mapPlaidAccountToInvestment(updated);
		}

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			const demoUserId = ctx.userId;
			const seeded = await ctx.db.investment.findMany({
				where: { userId: demoUserId },
			});
			const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
			const merged = mergeInvestments(seeded, overlay);
			const existing = merged.find((i) => i.id === input.id);
			if (!existing) throw new Error("Investment not found");
			const { id, ...data } = input;
			const updated = { ...existing, ...data, updatedAt: new Date() };
			return upsertOverlayInvestment(ctx.demoOverlaySessionKey, updated);
		}

		const userId = ctx.userId;
		const { id, investmentHidden: _investmentHidden, ...data } = input;
		const existing = await ctx.db.investment.findFirst({
			where: { id, userId },
		});
		if (!existing) throw new Error("Investment not found");

		const now = new Date();
		const updateData: Prisma.InvestmentUpdateInput = { ...data };

		if (data.autoUpdateBalance === true && !existing.nextBalanceAccrualDueAt) {
			updateData.nextBalanceAccrualDueAt = initialNextAccrualDueAt(now);
		}

		if (
			data.startingBalance !== undefined &&
			data.startingBalance !== existing.startingBalance
		) {
			updateData.lastBalanceAccruedAt = now;
			updateData.nextBalanceAccrualDueAt = initialNextAccrualDueAt(now);
		}

		const investment = await ctx.db.investment.update({
			where: { id, userId },
			data: updateData,
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after investment update", err, {
				feature: "investment",
				operation: "update",
				userId,
			}),
		);
		return investment;
	}),

	delete: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = deleteInvestmentInput.parse(body);

		// Profile merge uses `plaid-`; investment list uses `plaid_`.
		if (input.id.startsWith("plaid_") || input.id.startsWith("plaid-")) {
			if (ctx.isDemoMode) {
				throw new Error(
					"Cannot disconnect Plaid investment accounts in demo mode",
				);
			}
			const userId = ctx.userId;
			const plaidAccountId = input.id.replace(/^plaid[-_]/, "");
			const account = await ctx.db.plaidAccount.findFirst({
				where: {
					id: plaidAccountId,
					userId,
					type: { in: ["investment", "brokerage", "depository", "cash"] },
				},
			});
			if (!account) throw new Error("Plaid investment account not found");
			await ctx.db.plaidAccount.update({
				where: { id: account.id },
				data: { investmentHidden: true, accountHidden: true },
			});
			return { id: input.id };
		}

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			await deleteOverlayInvestment(ctx.demoOverlaySessionKey, input.id);
			await stripInvestmentFromDemoFinancialProfile(
				ctx.demoOverlaySessionKey,
				input.id,
			);
			return { id: input.id };
		}

		const userId = ctx.userId;
		const deleted = await ctx.db.$transaction(async (tx) => {
			const row = await tx.investment.delete({
				where: { id: input.id, userId },
			});
			const stored = await tx.financialProfileData.findUnique({
				where: { userId },
			});
			if (!stored) return row;

			const parsed = FinancialProfileDataSchema.safeParse({
				profile: stored.profile,
				accounts: stored.accounts,
				incomeSources: stored.incomeSources,
				assets: stored.assets,
				liabilities: stored.liabilities,
				investments: stored.investments,
				insurancePolicies: stored.insurancePolicies,
				taxProfile: stored.taxProfile,
				forecastAssumptions: stored.forecastAssumptions,
				planningNotes: stored.planningNotes,
			});
			if (!parsed.success) {
				logger.warn(
					"Skipping profile strip after investment delete; invalid JSON",
					{
						feature: "investment",
						operation: "delete-strip-profile",
						userId,
					},
				);
				return row;
			}

			const next = stripManualInvestmentFromProfile(parsed.data, input.id);
			await tx.financialProfileData.update({
				where: { userId },
				data: {
					profile: toPrismaJson(next.profile),
					accounts: toPrismaJson(next.accounts),
					incomeSources: toPrismaJson(next.incomeSources),
					assets: toPrismaJson(next.assets),
					liabilities: toPrismaJson(next.liabilities),
					investments: toPrismaJson(next.investments),
					insurancePolicies: toPrismaJson(next.insurancePolicies),
					taxProfile: toPrismaJson(next.taxProfile),
					forecastAssumptions: toPrismaJson(next.forecastAssumptions),
					planningNotes: toPrismaJson(next.planningNotes),
				},
			});
			return row;
		});
		await takeSnapshot(userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after investment delete", err, {
				feature: "investment",
				operation: "delete",
				userId,
			}),
		);
		return deleted;
	}),

	getForecast: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = getForecastInput.parse(body);

		let investments: Array<{
			id: string;
			name: string;
			type: InvestmentType;
			startingBalance: number;
			monthlyContribution: number;
			annualReturnRate: number;
		}>;

		if (ctx.isDemoMode) {
			const demoUserId = ctx.userId;
			const seeded = await ctx.db.investment.findMany({
				where: { userId: demoUserId },
			});
			if (ctx.demoOverlaySessionKey) {
				const overlay = await getInvestmentsOverlay(ctx.demoOverlaySessionKey);
				investments = mergeInvestments(seeded, overlay);
			} else {
				investments = seeded;
			}
		} else {
			const userId = ctx.userId;
			const [manualInvestments, plaidInvestmentAccounts] = await Promise.all([
				ctx.db.investment.findMany({
					where: { userId },
				}),
				ctx.db.plaidAccount.findMany({
					where: {
						userId,
						type: "investment",
						isActive: true,
						investmentHidden: false,
					},
					include: { plaidItem: { select: plaidItemAccessSelect } },
				}),
			]);
			investments = [
				...manualInvestments,
				...visiblePlaidInvestmentAccounts(plaidInvestmentAccounts).map(
					mapPlaidAccountToInvestment,
				),
			];
		}

		return investments.map((inv) => ({
			id: inv.id,
			name: inv.name,
			type: inv.type,
			projections: forecastInvestmentGrowth(
				{
					startingBalance: inv.startingBalance,
					monthlyContribution:
						input.scenarioOverrides?.monthlyContribution ??
						inv.monthlyContribution,
					annualReturnRate:
						input.scenarioOverrides?.annualReturnRate ?? inv.annualReturnRate,
				},
				input.months,
			),
		}));
	}),

	/**
	 * Returns per-security positions for one connected investment account.
	 * Empty for accounts without Plaid Investments holdings, which keeps the
	 * account detail UI a no-op until the product is enabled for that user.
	 */
	getHoldings: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = getHoldingsInput.parse(body);
		return getAccountHoldings({
			db: ctx.db,
			userId: ctx.userId,
			accountId: input.accountId,
		});
	}),

	/**
	 * Returns a pre-grouped, sorted portfolio allocation across all asset classes:
	 * investment types (STOCKS, ROTH_IRA, etc.), real estate equity, and cash.
	 * This is the canonical single-call endpoint for portfolio composition —
	 * used by the dashboard and available to AI agents and native clients.
	 *
	 * When the owner Personal profile is active, opted-in Family/Business
	 * profile holdings are merged into sections (items labeled with profile name).
	 */
	getPortfolioAllocation: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (ctx.isDemoMode) {
			const userId = ctx.userId;
			const [
				manualInvestments,
				plaidInvestmentAccounts,
				realEstateRaw,
				plaidDepositoryAccounts,
				financialProfileData,
			] = await Promise.all([
				ctx.db.investment.findMany({
					where: { userId },
					orderBy: { createdAt: "asc" },
				}),
				ctx.db.plaidAccount.findMany({
					where: {
						userId,
						type: "investment",
						isActive: true,
						investmentHidden: false,
					},
					include: {
						plaidItem: { select: plaidItemAccessSelect },
					},
				}),
				ctx.db.realEstateInvestment.findMany({
					where: { userId },
					orderBy: { createdAt: "asc" },
				}),
				ctx.db.plaidAccount.findMany({
					where: { userId, type: "depository", isActive: true },
					select: {
						id: true,
						name: true,
						subtype: true,
						currentBalance: true,
						availableBalance: true,
						lastBalanceSyncAt: true,
						plaidItem: { select: { lastBalanceSyncAt: true } },
					},
				}),
				ctx.db.financialProfileData.findUnique({
					where: { userId },
					select: { assets: true },
				}),
			]);

			let investments = [
				...manualInvestments,
				...visiblePlaidInvestmentAccounts(plaidInvestmentAccounts).map(
					mapPlaidAccountToInvestment,
				),
			];
			let realEstate = realEstateRaw;
			const financialProfileAssets = parseFinancialProfileAssets(
				financialProfileData?.assets,
			);

			if (ctx.demoOverlaySessionKey) {
				const [invOverlay, reOverlay] = await Promise.all([
					getInvestmentsOverlay(ctx.demoOverlaySessionKey),
					getPropertiesOverlay(ctx.demoOverlaySessionKey),
				]);
				investments = mergeInvestments(manualInvestments, invOverlay);
				realEstate = mergeProperties(realEstateRaw, reOverlay);
			}

			const byType = (type: string) =>
				investments.filter((i) => i.type === type) as Array<
					(typeof investments)[number] & PortfolioAllocationInvestment
				>;
			const toItems = (invs: PortfolioAllocationInvestment[]) =>
				invs.map((i) => ({
					id: i.id,
					name: i.name,
					value: i.startingBalance,
					...(i.subtitle ? { subtitle: i.subtitle } : {}),
					...(i.lastSynced ? { lastSynced: i.lastSynced } : {}),
				}));

			const sections = [
				{
					key: "stocks",
					label: "Stocks",
					value: byType("STOCKS").reduce((s, i) => s + i.startingBalance, 0),
					items: toItems(byType("STOCKS")),
				},
				{
					key: "rothIra",
					label: "Roth IRA",
					value: byType("ROTH_IRA").reduce((s, i) => s + i.startingBalance, 0),
					items: toItems(byType("ROTH_IRA")),
				},
				{
					key: "401k",
					label: "401(k)",
					value: byType("FOUR01K").reduce((s, i) => s + i.startingBalance, 0),
					items: toItems(byType("FOUR01K")),
				},
				{
					key: "hsa",
					label: "HSA",
					value: byType("HSA").reduce((s, i) => s + i.startingBalance, 0),
					items: toItems(byType("HSA")),
				},
				{
					key: "other",
					label: "Other",
					value: byType("OTHER").reduce((s, i) => s + i.startingBalance, 0),
					items: toItems(byType("OTHER")),
				},
				{
					key: "cash",
					label: "Cash",
					value: plaidDepositoryAccounts.reduce(
						(s, a) => s + (a.currentBalance ?? a.availableBalance ?? 0),
						0,
					),
					items: plaidDepositoryAccounts.map((a) => ({
						id: a.id,
						name: a.name,
						value: a.currentBalance ?? a.availableBalance ?? 0,
						subtitle: formatAccountTypeLabel(a.subtype),
						lastSynced: formatBalanceSyncLabel(
							a.lastBalanceSyncAt ?? a.plaidItem.lastBalanceSyncAt,
						),
					})),
				},
				{
					key: "realEstate",
					label: "Real Estate",
					value: realEstate.reduce(
						(s, p) => s + (p.currentEstimatedValue - p.currentLoanBalance),
						0,
					),
					items: realEstate.map((p) => ({
						id: p.id,
						name: p.name,
						value: p.currentEstimatedValue - p.currentLoanBalance,
						subtitle: `Loan balance: $${p.currentLoanBalance.toLocaleString("en-US", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`,
					})),
				},
				{
					key: "otherAssets",
					label: "Other Assets",
					value: financialProfileAssets.reduce(
						(sum, asset) => sum + asset.estimatedValue,
						0,
					),
					items: financialProfileAssets.map((asset) => ({
						id: asset.id,
						name: asset.name,
						value: asset.estimatedValue,
						subtitle: asset.type,
					})),
				},
			]
				.filter((s) => s.value > 0)
				.sort((a, b) => b.value - a.value);

			return { sections };
		}

		return getRolledUpPortfolioAllocation(ctx.db, {
			actorUserId: ctx.actorUserId,
			effectiveUserId: ctx.effectiveUserId,
			isHouseholdMember: ctx.isHouseholdMember,
		});
	}),

	/**
	 * Returns portfolio-wide summary totals and a forecasted portfolio value.
	 * Intended as a single endpoint for "what is my portfolio worth now and in N months"
	 * for dashboard summaries, AI agents, and native clients.
	 */
	getSummary: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = z
			.object({
				forecastMonths: z.preprocess(
					optionalNumberInput,
					z.number().int().min(1).max(600).default(60),
				),
				scenarioReturnRate: z.preprocess(
					optionalNumberInput,
					z.number().min(0).max(1).optional(),
				),
			})
			.parse(body);

		const userId = ctx.userId;

		const [manualInvestments, plaidInvestmentAccounts, realEstateRaw] =
			await Promise.all([
				ctx.db.investment.findMany({ where: { userId } }),
				ctx.db.plaidAccount.findMany({
					where: {
						userId,
						type: "investment",
						isActive: true,
						investmentHidden: false,
					},
					include: { plaidItem: { select: plaidItemAccessSelect } },
				}),
				ctx.db.realEstateInvestment.findMany({ where: { userId } }),
			]);

		let investments = [
			...manualInvestments,
			...visiblePlaidInvestmentAccounts(plaidInvestmentAccounts).map(
				mapPlaidAccountToInvestment,
			),
		];
		let realEstate = realEstateRaw;

		if (ctx.isDemoMode && ctx.demoOverlaySessionKey) {
			const [invOverlay, reOverlay] = await Promise.all([
				getInvestmentsOverlay(ctx.demoOverlaySessionKey),
				getPropertiesOverlay(ctx.demoOverlaySessionKey),
			]);
			investments = mergeInvestments(manualInvestments, invOverlay);
			realEstate = mergeProperties(realEstateRaw, reOverlay);
		}

		const totalBalance = investments.reduce((s, i) => s + i.startingBalance, 0);
		const totalMonthly = investments.reduce(
			(s, i) => s + i.monthlyContribution,
			0,
		);
		const totalRealEstateEquity = realEstate.reduce(
			(s, p) => s + (p.currentEstimatedValue - p.currentLoanBalance),
			0,
		);

		const forecastYears = input.forecastMonths / 12;
		const forecastedBalance = investments.reduce((sum, inv) => {
			const returnRate = input.scenarioReturnRate ?? inv.annualReturnRate;
			const projection = forecastInvestmentGrowth(
				{
					startingBalance: inv.startingBalance,
					monthlyContribution: inv.monthlyContribution,
					annualReturnRate: returnRate,
				},
				input.forecastMonths,
			);
			return sum + (projection.at(-1)?.balance ?? inv.startingBalance);
		}, 0);

		const forecastedRealEstateEquity = realEstate.reduce((sum, p) => {
			const projection = projectRealEstateEquity(
				{
					currentEstimatedValue: p.currentEstimatedValue,
					currentLoanBalance: p.currentLoanBalance,
					appreciationRate: p.appreciationRate,
					interestRate: p.interestRate,
					monthlyMortgagePayment: p.monthlyMortgagePayment,
				},
				input.forecastMonths,
			);
			return (
				sum +
				(projection.at(-1)?.equity ??
					p.currentEstimatedValue - p.currentLoanBalance)
			);
		}, 0);

		return {
			totalBalance,
			totalMonthly,
			totalRealEstateEquity,
			forecastedPortfolio: forecastedBalance + forecastedRealEstateEquity,
			forecastedBalance,
			forecastedRealEstateEquity,
			forecastMonths: input.forecastMonths,
			forecastYears,
		};
	}),
};
