import type {
	FinancialProfileData,
	ProfileAccount,
	ProfileInvestment,
} from "@moat/contracts";
import type { InvestmentType } from "@moat/data-access";
import type { AppContext } from "../context";
import { initialNextAccrualDueAt } from "../investments/accrual";
import { parseInvestmentNameParts } from "../investments/investment-display-name";
import {
	applyTaxProfileDefaults,
	taxIncomeLookbackStartDate,
} from "./apply-tax-profile-defaults";
import { formatBalanceSyncLabel } from "./format-balance-sync-label";
import {
	mergeMortgageLiabilities,
	mergeRealEstateAssets,
	type RealEstateForProfileMerge,
} from "./merge-real-estate-into-profile";
import { resolveAccountDisplayName } from "./resolve-account-display-name";
import { updateFinancialProfileData } from "./updateFinancialProfileData";

function currentDateString(): string {
	return new Date().toISOString().slice(0, 10);
}

function formatPlaidAccountType(type: string, subtype: string | null): string {
	const sub = subtype?.toLowerCase();
	if (sub === "401k") return "401(k)";
	if (sub === "roth") return "Roth IRA";
	if (sub === "roth 401k") return "Roth 401(k)";
	if (sub === "ira") return "IRA";
	if (sub) {
		return sub
			.split(" ")
			.map((word) => word.charAt(0).toUpperCase() + word.slice(1))
			.join(" ");
	}
	return type.charAt(0).toUpperCase() + type.slice(1);
}

function shouldDefaultAccountInNetWorth(
	type: string,
	subtype: string | null,
): boolean {
	const normalizedType = type.toLowerCase();
	const normalizedSubtype = subtype?.toLowerCase() ?? "";
	return normalizedType !== "loan" && !normalizedSubtype.includes("mortgage");
}

function formatInvestmentType(value: string) {
	const normalizedValue = value.toLowerCase();
	if (normalizedValue.includes("401") || value === "FOUR01K") return "401(k)";
	if (normalizedValue.includes("roth")) return "Roth IRA";
	if (normalizedValue.includes("ira") || value === "ROTH_IRA") return "IRA";
	if (normalizedValue.includes("hsa") || value === "HSA") return "HSA";
	if (normalizedValue.includes("real") || value === "REAL_ESTATE") {
		return "Real estate";
	}
	if (normalizedValue.includes("brokerage")) return "Brokerage";
	if (value === "OTHER" || normalizedValue === "other") return "Other";
	return value === "STOCKS" ? "Brokerage" : value;
}

function annualRateToPercent(annualReturnRate: number): number {
	return Math.round(annualReturnRate * 10000) / 100;
}

function manualInvestmentAccountId(id: string) {
	return `investment-acct-${id}`;
}

function getDefaultFinancialProfileData(): FinancialProfileData {
	return {
		profile: {
			id: "profile-default",
			householdType: "Individual",
			location: "",
			lifeStage: "Other",
			employmentType: "Other",
			planningHorizon: "5 years",
			riskTolerance: "Balanced",
			dependentsCount: 0,
			housingStatus: "Other",
			lastUpdated: currentDateString(),
			source: "Manual",
		},
		accounts: [],
		incomeSources: [],
		assets: [],
		liabilities: [],
		investments: [],
		insurancePolicies: [],
		taxProfile: {
			filingStatus: "Single",
			taxYear: new Date().getFullYear(),
			estimatedFederalTaxBracket: "22%",
			estimatedStateTaxRate: "5%",
			totalAnnualIncome: 0,
			taxableIncomeEstimate: 0,
			deductionStrategy: "Standard",
			selfEmployedIncome: false,
			rentalIncome: false,
			lastUpdated: currentDateString(),
		},
		forecastAssumptions: {
			inflationRate: 3.0,
			incomeGrowthRate: 3.0,
			expenseGrowthRate: 3.0,
			investmentReturnRate: 7.0,
			realEstateAppreciationRate: 3.0,
			defaultCashYield: 4.5,
			forecastStyle: "Balanced",
			lastUpdated: currentDateString(),
		},
		planningNotes: [],
	};
}

function mapProfileTypeToInvestmentType(type: string): InvestmentType {
	const normalized = type.toLowerCase().trim();
	if (normalized.includes("401")) return "FOUR01K";
	if (normalized.includes("roth")) return "ROTH_IRA";
	if (normalized.includes("ira")) return "ROTH_IRA";
	if (normalized.includes("hsa")) return "HSA";
	if (normalized.includes("real")) return "REAL_ESTATE";
	if (
		normalized.includes("stock") ||
		normalized.includes("brokerage") ||
		normalized.includes("mutual")
	) {
		return "STOCKS";
	}
	return "OTHER";
}

async function promoteProfileOnlyManualInvestments(
	ctx: AppContext,
	storedData: FinancialProfileData,
): Promise<FinancialProfileData> {
	const investmentsRepo = ctx.repositories.investments;
	const profileRepo = ctx.repositories.financialProfileData;
	if (!investmentsRepo || !profileRepo) return storedData;

	const existing = await investmentsRepo.list({ userId: ctx.userId });
	const existingIds = new Set(existing.map((row) => row.id));
	const toPromote = storedData.investments.filter(
		(investment) =>
			!existingIds.has(investment.id) &&
			!investment.id.startsWith("plaid-") &&
			!investment.id.startsWith("plaid_"),
	);
	if (toPromote.length === 0) return storedData;

	const now = new Date();
	const accountsById = new Map(
		storedData.accounts.map((account) => [account.id, account]),
	);
	const promotedIds = new Set<string>();
	const promotedAccountLinks = new Set<string>();
	const prefsAccounts: ProfileAccount[] = [];
	const prefsInvestments: ProfileInvestment[] = [];

	for (const investment of toPromote) {
		const autoUpdateBalance = investment.autoUpdateBalance ?? false;
		const parsedName = parseInvestmentNameParts(investment.name);
		const linkedAccount = investment.accountLink
			? accountsById.get(investment.accountLink)
			: undefined;

		await investmentsRepo.create({
			userId: ctx.userId,
			id: investment.id,
			type: mapProfileTypeToInvestmentType(investment.type),
			name: parsedName.displayName,
			startingBalance: investment.currentValue,
			monthlyContribution: investment.monthlyContribution,
			annualReturnRate: investment.expectedReturn / 100,
			notes: investment.notes ?? null,
			autoUpdateBalance,
			nextBalanceAccrualDueAt: autoUpdateBalance
				? initialNextAccrualDueAt(now)
				: null,
		});

		promotedIds.add(investment.id);
		if (investment.accountLink) {
			promotedAccountLinks.add(investment.accountLink);
		}
		const accountId = manualInvestmentAccountId(investment.id);
		promotedAccountLinks.add(accountId);

		prefsAccounts.push({
			id: accountId,
			name: parsedName.displayName,
			institution:
				linkedAccount?.institution?.trim() ||
				parsedName.institution ||
				"Manual",
			type: investment.type,
			balance: investment.currentValue,
			connectionStatus: "Manual",
			lastSynced: linkedAccount?.lastSynced ?? "Manual",
			includedInNetWorth: linkedAccount?.includedInNetWorth ?? true,
			...(linkedAccount?.hidden ? { hidden: true } : {}),
			...(investment.notes ? { notes: investment.notes } : {}),
		});
		prefsInvestments.push({
			id: investment.id,
			name: parsedName.displayName,
			type: investment.type,
			currentValue: investment.currentValue,
			monthlyContribution: investment.monthlyContribution,
			expectedReturn: investment.expectedReturn,
			accountLink: accountId,
			includeInForecast: investment.includeInForecast ?? true,
			autoUpdateBalance,
			...(investment.notes ? { notes: investment.notes } : {}),
		});
	}

	const nextData: FinancialProfileData = {
		...storedData,
		accounts: [
			...storedData.accounts.filter(
				(account) =>
					!promotedAccountLinks.has(account.id) &&
					!account.id.startsWith("investment-acct-"),
			),
			...prefsAccounts,
		],
		investments: [
			...storedData.investments.filter(
				(investment) => !promotedIds.has(investment.id),
			),
			...prefsInvestments,
		],
	};

	await updateFinancialProfileData(ctx, nextData);
	return nextData;
}

export async function getFinancialProfileData(
	ctx: AppContext,
): Promise<FinancialProfileData> {
	const stored = await ctx.repositories.financialProfileData?.get({
		userId: ctx.userId,
	});
	const baseBeforePromote = stored ?? getDefaultFinancialProfileData();
	const promotedBase = await promoteProfileOnlyManualInvestments(
		ctx,
		baseBeforePromote,
	);

	const incomeSince = taxIncomeLookbackStartDate();
	const [
		plaidAccounts,
		plaidItems,
		manualInvestments,
		realEstateProperties,
		incomePage,
	] = await Promise.all([
		ctx.repositories.plaidAccounts?.listActiveForUser({
			userId: ctx.userId,
		}),
		ctx.repositories.plaidItems?.listForUser({ userId: ctx.userId }),
		ctx.repositories.investments?.list({ userId: ctx.userId }) ??
			Promise.resolve([]),
		ctx.repositories.realEstate?.list({ userId: ctx.userId }) ??
			Promise.resolve([]),
		ctx.repositories.transactions.listPaginated({
			userId: ctx.userId,
			type: "INCOME",
			startDate: incomeSince,
			limit: 500,
		}),
	]);

	const base = promotedBase;

	type ItemInfo = { institutionName: string };
	const itemMap = new Map<string, ItemInfo>();
	for (const item of plaidItems ?? []) {
		itemMap.set(item.id, {
			institutionName: item.institutionName,
		});
	}

	const storedById = new Map(
		base.accounts.map((account) => [account.id, account]),
	);

	const plaidProfileAccounts: ProfileAccount[] = (plaidAccounts ?? [])
		.filter((a) => !a.isHidden && a.syncEnabled !== false)
		.map((a) => {
			const itemInfo = itemMap.get(a.plaidItemId);
			const id = `plaid-${a.id}`;
			const storedAccount = storedById.get(id) ?? storedById.get(a.id);
			const notes = storedAccount?.notes;
			const nameOverride = storedAccount?.nameOverride;
			return {
				id,
				name: resolveAccountDisplayName(nameOverride, a.name),
				institution: itemInfo?.institutionName ?? "Unknown",
				type: formatPlaidAccountType(a.type, a.subtype),
				balance: a.currentBalance ?? a.availableBalance ?? 0,
				connectionStatus: "Synced" as const,
				lastSynced: formatBalanceSyncLabel(a.lastBalanceSyncAt),
				includedInNetWorth:
					storedAccount?.includedInNetWorth ??
					shouldDefaultAccountInNetWorth(a.type, a.subtype),
				plaidItemId: a.plaidItemId,
				...(notes ? { notes } : {}),
				...(nameOverride ? { nameOverride } : {}),
			};
		});

	const generatedInvestmentAccountIds = new Set(
		manualInvestments.map((investment) =>
			manualInvestmentAccountId(investment.id),
		),
	);

	const manualAccounts = base.accounts.filter(
		(a) =>
			!a.id.startsWith("plaid-") && !generatedInvestmentAccountIds.has(a.id),
	);

	const investmentAccounts: ProfileAccount[] = manualInvestments.map(
		(investment) => {
			const id = manualInvestmentAccountId(investment.id);
			const storedAccount = storedById.get(id);
			const notes = storedAccount?.notes ?? investment.notes ?? undefined;
			const parsedName = parseInvestmentNameParts(investment.name);
			return {
				id,
				name: parsedName.displayName,
				institution:
					storedAccount?.institution?.trim() ||
					parsedName.institution ||
					"Manual",
				type: formatInvestmentType(investment.type),
				balance: investment.startingBalance,
				connectionStatus: "Manual" as const,
				lastSynced: storedAccount?.lastSynced ?? "Manual",
				includedInNetWorth: storedAccount?.includedInNetWorth ?? true,
				...(storedAccount?.hidden ? { hidden: true } : {}),
				...(notes ? { notes } : {}),
			};
		},
	);

	const storedInvestmentsById = new Map(
		base.investments.map((investment) => [investment.id, investment]),
	);
	const canonicalInvestments: ProfileInvestment[] = manualInvestments.map(
		(investment) => {
			const storedInvestment = storedInvestmentsById.get(investment.id);
			const notes = storedInvestment?.notes ?? investment.notes ?? undefined;
			const parsedName = parseInvestmentNameParts(investment.name);
			return {
				id: investment.id,
				name: parsedName.displayName,
				type: formatInvestmentType(investment.type),
				currentValue: investment.startingBalance,
				monthlyContribution: investment.monthlyContribution,
				expectedReturn: annualRateToPercent(investment.annualReturnRate),
				accountLink: manualInvestmentAccountId(investment.id),
				includeInForecast: storedInvestment?.includeInForecast ?? true,
				autoUpdateBalance: investment.autoUpdateBalance ?? true,
				...(notes ? { notes } : {}),
			};
		},
	);

	const profileOnlyInvestments = base.investments.filter(
		(investment) =>
			!manualInvestments.some((row) => row.id === investment.id) &&
			!investment.id.startsWith("plaid-") &&
			!investment.id.startsWith("plaid_"),
	);

	const accountById = new Map(
		plaidProfileAccounts.map((account) => [account.id, account]),
	);
	const syncedInvestments: ProfileInvestment[] = (plaidAccounts ?? [])
		.filter(
			(account) =>
				!account.isHidden &&
				account.syncEnabled !== false &&
				(account.type === "investment" ||
					account.type === "brokerage" ||
					account.type === "depository" ||
					account.type === "cash"),
		)
		.map((account) => {
			const id = `plaid-${account.id}`;
			const storedInvestment =
				storedInvestmentsById.get(id) ??
				storedInvestmentsById.get(`plaid_${account.id}`);
			const linkedAccount =
				accountById.get(`plaid-${account.id}`) ?? accountById.get(account.id);
			const notes = storedInvestment?.notes ?? account.notes ?? undefined;
			const isCash = account.type === "depository" || account.type === "cash";
			return {
				id,
				name: resolveAccountDisplayName(
					linkedAccount?.nameOverride,
					account.name,
				),
				type: formatInvestmentType(account.subtype ?? account.type),
				currentValue: account.currentBalance ?? account.availableBalance ?? 0,
				monthlyContribution: account.monthlyContribution,
				expectedReturn: annualRateToPercent(account.annualReturnRate),
				accountLink: `plaid-${account.id}`,
				includeInForecast: storedInvestment?.includeInForecast ?? true,
				forecastInputsUserEdited: isCash
					? account.forecastInputsUserEdited
					: true,
				...(notes ? { notes } : {}),
			};
		});

	const plaidAccountsById = new Map(
		(plaidAccounts ?? []).map((account) => [account.id, account]),
	);
	const realEstateForMerge: RealEstateForProfileMerge[] =
		realEstateProperties.map((property) => {
			const linkedAccountId = property.linkedPlaidAccountId;
			const linkedAccount = linkedAccountId
				? plaidAccountsById.get(linkedAccountId)
				: undefined;
			return {
				...property,
				linkedPlaidAccount: linkedAccount
					? {
							id: linkedAccount.id,
							name: linkedAccount.name,
							officialName: linkedAccount.officialName,
							currentBalance: linkedAccount.currentBalance,
						}
					: null,
			};
		});

	const tax = applyTaxProfileDefaults({
		taxProfile: base.taxProfile,
		location: base.profile.location,
		incomeTransactions: incomePage.items.map((transaction) => ({
			amount: transaction.amount,
			date: transaction.date,
			category: transaction.category,
			description: transaction.description,
			merchantName: null,
		})),
	});

	return {
		...base,
		accounts: [
			...manualAccounts,
			...investmentAccounts,
			...plaidProfileAccounts,
		],
		assets: mergeRealEstateAssets(base.assets, realEstateForMerge),
		liabilities: mergeMortgageLiabilities(base.liabilities, realEstateForMerge),
		investments: [
			...profileOnlyInvestments,
			...canonicalInvestments,
			...syncedInvestments,
		],
		taxProfile: tax.taxProfile,
		taxProfileRecommendations: tax.recommendations,
	};
}
