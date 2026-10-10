import {
	type FinancialProfileData,
	FinancialProfileDataSchema,
	getInsuranceBlockedCloudReasons,
	type InsuranceCloudBlockReason,
} from "@moat/contracts";
import {
	applyTaxProfileDefaults,
	formatBalanceSyncLabel,
	initialNextAccrualDueAt,
	isBalanceSyncStale,
	parseInvestmentNameParts,
	pruneMissingManualInvestmentsFromProfile,
	resolveAccountDisplayName,
	stripTaxProfileRecommendations,
	taxIncomeLookbackStartDate,
} from "@moat/domain";
import { z } from "zod";
import { logger } from "~/lib/logger";
import { createApiError } from "~/server/api-context";
import {
	collectLiveInstitutionKeys,
	shouldDisplayPlaidItem,
} from "~/server/plaid/access-state";
import { collapseLiveDuplicatePlaidAccountsSafely } from "~/server/plaid/collapse-live-duplicate-accounts";
import { takeSnapshot } from "~/server/services/balance-snapshot.service";
import {
	getFinancialProfileOverlay,
	updateFinancialProfileOverlay,
} from "~/server/services/demo/demo-overlay.service";
import type { InvestmentType, Prisma } from "../../../generated/prisma";
import { type DemoOrAuthContext, withDemoOrAuth } from "../handler-wrappers";
import { markFinancialProfileSetupGuideStep } from "../services/setup-guide.service";

const updateFinancialProfileInput = z.object({
	data: FinancialProfileDataSchema,
});

type AccountData = FinancialProfileData["accounts"][number];
type AssetData = FinancialProfileData["assets"][number];
type LiabilityData = FinancialProfileData["liabilities"][number];
type InvestmentData = FinancialProfileData["investments"][number];

type StoredFinancialProfileData = {
	profile: unknown;
	accounts: unknown;
	incomeSources: unknown;
	assets: unknown;
	liabilities: unknown;
	investments: unknown;
	insurancePolicies: unknown;
	taxProfile: unknown;
	forecastAssumptions: unknown;
	planningNotes: unknown;
};

const INSURANCE_CLOUD_STORAGE_BLOCKED = "INSURANCE_CLOUD_STORAGE_BLOCKED";

type PlaidAccountForDefaults = {
	id: string;
	plaidItemId: string;
	name: string;
	officialName: string | null;
	type: string;
	subtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	investmentHidden: boolean;
	forecastInputsUserEdited: boolean;
	lastBalanceSyncAt: Date | null;
	plaidItem: {
		institutionId: string | null;
		institutionName: string;
		accessRevokedAt: Date | null;
		accessTokenEncrypted: string | null;
		lastTransactionSyncAt: Date | null;
		lastBalanceSyncAt: Date | null;
		lastSuccessfulSyncAt: Date | null;
		lastSyncAt: Date | null;
	};
};

type AppleFinanceKitAccountForDefaults = {
	id: string;
	displayName: string;
	institutionName: string;
	accountType: string;
	accountSubtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	lastSyncedAt: Date | null;
};

type InvestmentForDefaults = {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
	monthlyContribution: number;
	annualReturnRate: number;
	notes?: string | null;
	autoUpdateBalance?: boolean;
};

type RealEstateForDefaults = {
	id: string;
	name: string;
	currentEstimatedValue: number;
	currentLoanBalance: number;
	interestRate: number | null;
	remainingTermMonths: number | null;
	monthlyMortgagePayment: number | null;
	loanTermYears: number | null;
	purchaseDate: Date | null;
	linkedPlaidAccount: {
		id: string;
		name: string;
		officialName: string | null;
		type: string;
		subtype: string | null;
		currentBalance: number | null;
	} | null;
};

type IncomeTransactionForDefaults = {
	amount: { toNumber: () => number } | number;
	date: Date;
	category: string;
	description: string | null;
	merchantName: string | null;
};

function todayString() {
	return new Date().toISOString().slice(0, 10);
}

function createEmptyFinancialProfileData(): FinancialProfileData {
	const today = todayString();
	return {
		profile: {
			id: "profile",
			householdType: "Individual",
			location: "",
			lifeStage: "Other",
			employmentType: "Other",
			planningHorizon: "10 years",
			riskTolerance: "Balanced",
			dependentsCount: 0,
			housingStatus: "Other",
			lastUpdated: today,
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
			estimatedFederalTaxBracket: "",
			estimatedStateTaxRate: "",
			totalAnnualIncome: 0,
			taxableIncomeEstimate: 0,
			deductionStrategy: "Standard",
			selfEmployedIncome: false,
			rentalIncome: false,
			lastUpdated: today,
		},
		forecastAssumptions: {
			inflationRate: 3,
			incomeGrowthRate: 3,
			expenseGrowthRate: 3,
			investmentReturnRate: 7,
			realEstateAppreciationRate: 3,
			defaultCashYield: 4,
			retirementAge: 65,
			forecastStyle: "Balanced",
			lastUpdated: today,
		},
		planningNotes: [],
	};
}

function parseStoredData(record: StoredFinancialProfileData) {
	return FinancialProfileDataSchema.parse({
		profile: record.profile,
		accounts: record.accounts,
		incomeSources: record.incomeSources,
		assets: record.assets,
		liabilities: record.liabilities,
		investments: record.investments,
		insurancePolicies: record.insurancePolicies,
		taxProfile: record.taxProfile,
		forecastAssumptions: record.forecastAssumptions,
		planningNotes: record.planningNotes,
	});
}

function toPrismaJson(value: unknown): Prisma.InputJsonValue {
	return value as Prisma.InputJsonValue;
}

function toStoredJsonData(data: FinancialProfileData) {
	return {
		profile: toPrismaJson(data.profile),
		accounts: toPrismaJson(data.accounts),
		incomeSources: toPrismaJson(data.incomeSources),
		assets: toPrismaJson(data.assets),
		liabilities: toPrismaJson(data.liabilities),
		investments: toPrismaJson(data.investments),
		insurancePolicies: toPrismaJson(data.insurancePolicies),
		taxProfile: toPrismaJson(data.taxProfile),
		forecastAssumptions: toPrismaJson(data.forecastAssumptions),
		planningNotes: toPrismaJson(data.planningNotes),
	};
}

function assertInsuranceCloudSafe(
	data: FinancialProfileData,
	ctx: DemoOrAuthContext,
) {
	const reasons = data.insurancePolicies.flatMap((policy) =>
		getInsuranceBlockedCloudReasons(policy),
	);
	if (reasons.length === 0) return;

	const reasonCodes = uniqueReasonCodes(reasons);
	void logger.warn("Blocked unsafe insurance cloud storage", {
		feature: "financialProfile",
		operation: "update",
		userId: ctx.userId,
		demoUser: ctx.isDemoMode ? true : undefined,
		blockedPolicyCount: new Set(reasons.map((reason) => reason.policyId)).size,
		reasonCodes,
	});

	throw createApiError(
		JSON.stringify({
			code: INSURANCE_CLOUD_STORAGE_BLOCKED,
			message:
				"Some insurance details can only be stored in Moat Private Desktop.",
			reasonCodes,
		}),
		400,
	);
}

function uniqueReasonCodes(reasons: InsuranceCloudBlockReason[]) {
	return Array.from(new Set(reasons.map((reason) => reason.code))).sort();
}

async function getOrCreateStoredData(ctx: DemoOrAuthContext) {
	const emptyData = createEmptyFinancialProfileData();
	return ctx.db.financialProfileData.upsert({
		where: { userId: ctx.userId },
		create: {
			userId: ctx.userId,
			...toStoredJsonData(emptyData),
		},
		update: {},
	});
}

async function buildDefaultedFinancialProfileData(
	ctx: DemoOrAuthContext,
	storedData: FinancialProfileData,
): Promise<{
	data: FinancialProfileData;
	incomeTransactions: IncomeTransactionForDefaults[];
}> {
	const incomeSince = taxIncomeLookbackStartDate();
	const [
		plaidAccounts,
		appleFinanceKitAccounts,
		incomeTransactions,
		manualInvestments,
		realEstate,
	] = await Promise.all([
		ctx.db.plaidAccount.findMany({
			where: {
				userId: ctx.userId,
				isActive: true,
				accountHidden: false,
				syncEnabled: true,
			},
			select: {
				id: true,
				plaidItemId: true,
				name: true,
				officialName: true,
				type: true,
				subtype: true,
				currentBalance: true,
				availableBalance: true,
				monthlyContribution: true,
				annualReturnRate: true,
				notes: true,
				investmentHidden: true,
				forecastInputsUserEdited: true,
				lastBalanceSyncAt: true,
				plaidItem: {
					select: {
						institutionId: true,
						institutionName: true,
						accessRevokedAt: true,
						accessTokenEncrypted: true,
						lastTransactionSyncAt: true,
						lastBalanceSyncAt: true,
						lastSuccessfulSyncAt: true,
						lastSyncAt: true,
					},
				},
			},
			orderBy: [{ plaidItem: { sortOrder: "asc" } }, { name: "asc" }],
		}),
		ctx.db.appleFinanceKitAccount.findMany({
			where: {
				userId: ctx.userId,
				isActive: true,
				accountHidden: false,
				status: "ACTIVE",
			},
			select: {
				id: true,
				displayName: true,
				institutionName: true,
				accountType: true,
				accountSubtype: true,
				currentBalance: true,
				availableBalance: true,
				lastSyncedAt: true,
			},
			orderBy: { displayName: "asc" },
		}),
		ctx.db.transaction.findMany({
			where: {
				userId: ctx.userId,
				type: "INCOME",
				hidden: false,
				pending: false,
				removedAt: null,
				date: { gte: incomeSince },
			},
			select: {
				amount: true,
				date: true,
				category: true,
				description: true,
				merchantName: true,
			},
		}),
		ctx.db.investment.findMany({
			where: { userId: ctx.userId },
			select: {
				id: true,
				name: true,
				type: true,
				startingBalance: true,
				monthlyContribution: true,
				annualReturnRate: true,
				notes: true,
				autoUpdateBalance: true,
			},
			orderBy: { createdAt: "asc" },
		}),
		ctx.db.realEstateInvestment.findMany({
			where: { userId: ctx.userId },
			select: {
				id: true,
				name: true,
				currentEstimatedValue: true,
				currentLoanBalance: true,
				interestRate: true,
				remainingTermMonths: true,
				monthlyMortgagePayment: true,
				loanTermYears: true,
				purchaseDate: true,
				linkedPlaidAccount: {
					select: {
						id: true,
						name: true,
						officialName: true,
						type: true,
						subtype: true,
						currentBalance: true,
					},
				},
			},
			orderBy: { createdAt: "asc" },
		}),
	]);

	const liveInstitutionKeys = collectLiveInstitutionKeys(
		plaidAccounts.map((account) => account.plaidItem),
	);
	const visiblePlaidAccounts = plaidAccounts.filter((account) =>
		shouldDisplayPlaidItem(account.plaidItem, liveInstitutionKeys),
	);

	const accounts = mergeManualInvestmentAccounts(
		mergeSyncedAccounts(
			storedData.accounts,
			visiblePlaidAccounts,
			appleFinanceKitAccounts,
		),
		manualInvestments,
		storedData.investments,
	);

	return {
		data: {
			...storedData,
			accounts,
			assets: mergeRealEstateAssets(storedData.assets, realEstate),
			liabilities: mergeMortgageLiabilities(storedData.liabilities, realEstate),
			investments: mergeInvestments(
				storedData.investments,
				manualInvestments,
				visiblePlaidAccounts,
				accounts,
			),
			incomeSources: [],
		},
		incomeTransactions,
	};
}

function withTaxProfileDefaults(
	data: FinancialProfileData,
	incomeTransactions: IncomeTransactionForDefaults[],
): FinancialProfileData {
	const result = applyTaxProfileDefaults({
		taxProfile: data.taxProfile,
		location: data.profile.location,
		incomeTransactions: incomeTransactions.map((transaction) => ({
			amount: decimalToNumber(transaction.amount),
			date: transaction.date,
			category: transaction.category,
			description: transaction.description,
			merchantName: transaction.merchantName,
		})),
	});
	return {
		...data,
		taxProfile: result.taxProfile,
		taxProfileRecommendations: result.recommendations,
	};
}

function mergeSyncedAccounts(
	storedAccounts: AccountData[],
	plaidAccounts: PlaidAccountForDefaults[],
	appleFinanceKitAccounts: AppleFinanceKitAccountForDefaults[] = [],
): AccountData[] {
	if (plaidAccounts.length === 0 && appleFinanceKitAccounts.length === 0) {
		return storedAccounts;
	}

	const storedById = new Map(
		storedAccounts.map((account) => [account.id, account]),
	);
	const manualAccounts = storedAccounts.filter(
		(account) => account.connectionStatus !== "Synced",
	);
	const plaidSyncedAccounts = plaidAccounts.map<AccountData>((account) => {
		const storedAccount =
			storedById.get(account.id) ?? storedById.get(`plaid-${account.id}`);
		const notes = storedAccount?.notes ?? account.notes ?? undefined;
		const nameOverride = storedAccount?.nameOverride;
		return {
			id: account.id,
			name: resolveAccountDisplayName(nameOverride, account.name),
			institution: account.plaidItem.institutionName,
			type: formatAccountType(account.subtype ?? account.type),
			balance: normalizeAccountBalance(account),
			connectionStatus: "Synced",
			lastSynced: formatBalanceSyncLabel(
				account.lastBalanceSyncAt ?? account.plaidItem.lastBalanceSyncAt,
			),
			includedInNetWorth:
				storedAccount?.includedInNetWorth ??
				shouldDefaultAccountInNetWorth(account),
			plaidItemId: account.plaidItemId,
			...(notes ? { notes } : {}),
			...(nameOverride ? { nameOverride } : {}),
		};
	});
	const appleSyncedAccounts = appleFinanceKitAccounts.map<AccountData>(
		(account) => {
			const storedAccount = storedById.get(account.id);
			const notes = storedAccount?.notes;
			const nameOverride = storedAccount?.nameOverride;
			return {
				id: account.id,
				name: resolveAccountDisplayName(nameOverride, account.displayName),
				institution: account.institutionName,
				type: formatAccountType(account.accountSubtype ?? account.accountType),
				balance:
					account.currentBalance ??
					account.availableBalance ??
					storedAccount?.balance ??
					0,
				connectionStatus: "Synced",
				lastSynced: formatBalanceSyncLabel(account.lastSyncedAt),
				syncIsStale: isBalanceSyncStale(account.lastSyncedAt),
				includedInNetWorth: storedAccount?.includedInNetWorth ?? true,
				...(notes ? { notes } : {}),
				...(nameOverride ? { nameOverride } : {}),
			};
		},
	);

	return [...manualAccounts, ...plaidSyncedAccounts, ...appleSyncedAccounts];
}

function mergeRealEstateAssets(
	storedAssets: AssetData[],
	realEstate: RealEstateForDefaults[],
): AssetData[] {
	const generatedIds = new Set(
		realEstate.map((property) => realEstateAssetId(property.id)),
	);
	const storedById = new Map(storedAssets.map((asset) => [asset.id, asset]));
	const manualAssets = storedAssets.filter(
		(asset) => !generatedIds.has(asset.id),
	);
	const syncedAssets = realEstate.map<AssetData>((property) => {
		const id = realEstateAssetId(property.id);
		const storedAsset = storedById.get(id);
		return {
			id,
			name: property.name,
			type: "Real estate",
			estimatedValue: property.currentEstimatedValue,
			linkedLiability:
				storedAsset?.linkedLiability ?? mortgageLiabilityName(property),
			linkedInsurance: storedAsset?.linkedInsurance,
			includeInNetWorth: storedAsset?.includeInNetWorth ?? true,
			includeInForecast: storedAsset?.includeInForecast ?? true,
		};
	});

	return [...manualAssets, ...syncedAssets];
}

function mergeMortgageLiabilities(
	storedLiabilities: LiabilityData[],
	realEstate: RealEstateForDefaults[],
): LiabilityData[] {
	const mortgageProperties = realEstate.filter(
		(property) =>
			property.currentLoanBalance > 0 || property.linkedPlaidAccount !== null,
	);
	const generatedIds = new Set(
		mortgageProperties.map((property) => mortgageLiabilityId(property.id)),
	);
	const storedById = new Map(
		storedLiabilities.map((liability) => [liability.id, liability]),
	);
	const manualLiabilities = storedLiabilities.filter(
		(liability) => !generatedIds.has(liability.id),
	);
	const syncedLiabilities = mortgageProperties.map<LiabilityData>(
		(property) => {
			const id = mortgageLiabilityId(property.id);
			const storedLiability = storedById.get(id);
			return {
				id,
				name: mortgageLiabilityName(property),
				type: "Mortgage",
				balance: mortgageBalance(property),
				interestRate:
					property.interestRate !== null ? property.interestRate * 100 : 0,
				monthlyPayment: property.monthlyMortgagePayment ?? 0,
				linkedAsset: property.name,
				payoffDate:
					storedLiability?.payoffDate ??
					formatPayoffDate(property.remainingTermMonths),
				loanStartDate:
					storedLiability?.loanStartDate ??
					formatDateOnly(property.purchaseDate),
				loanTermYears:
					storedLiability?.loanTermYears ?? property.loanTermYears ?? undefined,
				autoUpdateBalance: storedLiability?.autoUpdateBalance,
				lastBalanceAmortizedAt: storedLiability?.lastBalanceAmortizedAt,
				nextBalanceAmortizationDueAt:
					storedLiability?.nextBalanceAmortizationDueAt,
				includeInNetWorth: storedLiability?.includeInNetWorth ?? false,
				includeInForecast: storedLiability?.includeInForecast ?? true,
			};
		},
	);

	return [...manualLiabilities, ...syncedLiabilities];
}

function mergeManualInvestmentAccounts(
	storedAccounts: AccountData[],
	manualInvestments: InvestmentForDefaults[],
	storedInvestments: InvestmentData[],
): AccountData[] {
	const storedInvestmentById = new Map(
		storedInvestments.map((investment) => [investment.id, investment]),
	);
	const generatedIds = new Set(
		manualInvestments.map((investment) =>
			manualInvestmentAccountId(investment.id),
		),
	);
	const accountIds = new Set(storedAccounts.map((account) => account.id));

	const investmentsNeedingAccounts = manualInvestments.filter((investment) => {
		const linkedAccountId = storedInvestmentById.get(
			investment.id,
		)?.accountLink;
		if (!linkedAccountId) return true;
		if (generatedIds.has(linkedAccountId)) return true;
		return !accountIds.has(linkedAccountId);
	});

	const storedById = new Map(
		storedAccounts.map((account) => [account.id, account]),
	);
	const otherAccounts = storedAccounts.filter(
		(account) => !generatedIds.has(account.id),
	);
	const generatedAccounts = investmentsNeedingAccounts.map<AccountData>(
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
				connectionStatus: "Manual",
				lastSynced: storedAccount?.lastSynced ?? "Manual",
				includedInNetWorth: storedAccount?.includedInNetWorth ?? true,
				...(storedAccount?.hidden ? { hidden: true } : {}),
				...(notes ? { notes } : {}),
			};
		},
	);

	return [...otherAccounts, ...generatedAccounts];
}

function mergeInvestments(
	storedInvestments: InvestmentData[],
	manualInvestments: InvestmentForDefaults[],
	plaidAccounts: PlaidAccountForDefaults[],
	accounts: AccountData[],
): InvestmentData[] {
	const plaidInvestmentAccounts = plaidAccounts.filter(
		(account) =>
			(account.type === "investment" ||
				account.type === "brokerage" ||
				account.type === "depository" ||
				account.type === "cash") &&
			!account.investmentHidden,
	);
	const generatedIds = new Set([
		...manualInvestments.map((investment) => investment.id),
		...plaidInvestmentAccounts.map((account) => plaidInvestmentId(account.id)),
	]);
	const storedById = new Map(
		storedInvestments.map((investment) => [investment.id, investment]),
	);
	const accountIds = new Set(accounts.map((account) => account.id));
	const manualProfileInvestments = storedInvestments.filter(
		(investment) => !generatedIds.has(investment.id),
	);
	const canonicalManualInvestments = manualInvestments.map<InvestmentData>(
		(investment) => {
			const storedInvestment = storedById.get(investment.id);
			const notes = storedInvestment?.notes ?? investment.notes ?? undefined;
			const storedLink = storedInvestment?.accountLink;
			const accountLink =
				storedLink && accountIds.has(storedLink)
					? storedLink
					: manualInvestmentAccountId(investment.id);
			const parsedName = parseInvestmentNameParts(investment.name);
			return {
				id: investment.id,
				name: parsedName.displayName,
				type: formatInvestmentType(investment.type),
				currentValue: investment.startingBalance,
				monthlyContribution: investment.monthlyContribution,
				expectedReturn: Math.round(investment.annualReturnRate * 10000) / 100,
				accountLink,
				includeInForecast: storedInvestment?.includeInForecast ?? true,
				autoUpdateBalance: investment.autoUpdateBalance ?? true,
				...(notes ? { notes } : {}),
			};
		},
	);
	const accountById = new Map(accounts.map((account) => [account.id, account]));
	const syncedInvestments = plaidInvestmentAccounts.map<InvestmentData>(
		(account) => {
			const id = plaidInvestmentId(account.id);
			const storedInvestment = storedById.get(id);
			const notes = storedInvestment?.notes ?? account.notes ?? undefined;
			const linkedAccount =
				accountById.get(account.id) ?? accountById.get(`plaid-${account.id}`);
			return {
				id,
				name: resolveAccountDisplayName(
					linkedAccount?.nameOverride,
					account.name,
				),
				type: formatInvestmentType(account.subtype ?? account.type),
				currentValue: account.currentBalance ?? 0,
				monthlyContribution: account.monthlyContribution,
				expectedReturn: Math.round(account.annualReturnRate * 10000) / 100,
				accountLink: account.plaidItem.institutionName,
				includeInForecast: storedInvestment?.includeInForecast ?? true,
				forecastInputsUserEdited:
					account.type === "depository" || account.type === "cash"
						? account.forecastInputsUserEdited
						: true,
				...(notes ? { notes } : {}),
			};
		},
	);

	return [
		...manualProfileInvestments,
		...canonicalManualInvestments,
		...syncedInvestments,
	];
}

function manualInvestmentAccountId(id: string) {
	return `investment-acct-${id}`;
}

function realEstateAssetId(id: string) {
	return `real-estate-${id}`;
}

function mortgageLiabilityId(id: string) {
	return `mortgage-${id}`;
}

function plaidInvestmentId(id: string) {
	return `plaid-${id}`;
}

function mortgageLiabilityName(property: RealEstateForDefaults) {
	return (
		property.linkedPlaidAccount?.name ??
		property.linkedPlaidAccount?.officialName ??
		`${property.name} mortgage`
	);
}

function mortgageBalance(property: RealEstateForDefaults) {
	return Math.abs(
		property.linkedPlaidAccount?.currentBalance ?? property.currentLoanBalance,
	);
}

function formatPayoffDate(remainingTermMonths: number | null) {
	if (!remainingTermMonths || remainingTermMonths <= 0) return undefined;
	const date = new Date();
	date.setMonth(date.getMonth() + remainingTermMonths);
	return date.toISOString().slice(0, 10);
}

function formatDateOnly(value: Date | string | null | undefined) {
	if (!value) return undefined;
	if (typeof value === "string") {
		const trimmed = value.trim();
		return trimmed === "" ? undefined : trimmed.slice(0, 10);
	}
	if (Number.isNaN(value.getTime())) return undefined;
	return value.toISOString().slice(0, 10);
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
	return value === "STOCKS" ? "Brokerage" : formatAccountType(value);
}

function normalizeAccountBalance(account: PlaidAccountForDefaults) {
	const balance = account.currentBalance ?? account.availableBalance ?? 0;
	return ["credit", "loan"].includes(account.type) ? -balance : balance;
}

function shouldDefaultAccountInNetWorth(account: PlaidAccountForDefaults) {
	const normalizedType = account.type.toLowerCase();
	const normalizedSubtype = account.subtype?.toLowerCase() ?? "";
	return normalizedType !== "loan" && !normalizedSubtype.includes("mortgage");
}

function formatAccountType(value: string) {
	return value
		.split(/[\s_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function decimalToNumber(value: IncomeTransactionForDefaults["amount"]) {
	return typeof value === "number" ? value : value.toNumber();
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

/**
 * Promote legacy profile-only linked investments into canonical Investment rows.
 * Preserves profile investment ids and keeps prefs stubs (institution / forecast / net worth).
 */
async function promoteProfileOnlyManualInvestments(
	ctx: DemoOrAuthContext,
	storedData: FinancialProfileData,
): Promise<FinancialProfileData> {
	if (ctx.isDemoMode) return storedData;

	const existing = await ctx.db.investment.findMany({
		where: { userId: ctx.userId },
		select: { id: true },
	});
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

	const nextData = await ctx.db.$transaction(async (tx) => {
		const prefsAccounts: AccountData[] = [];
		const prefsInvestments: InvestmentData[] = [];
		const promotedIds = new Set<string>();
		const promotedAccountLinks = new Set<string>();

		for (const investment of toPromote) {
			const autoUpdateBalance = investment.autoUpdateBalance ?? false;
			const parsedName = parseInvestmentNameParts(investment.name);
			const linkedAccount = investment.accountLink
				? accountsById.get(investment.accountLink)
				: undefined;

			await tx.investment.create({
				data: {
					id: investment.id,
					userId: ctx.userId,
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
				},
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

		const updated: FinancialProfileData = {
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

		await tx.financialProfileData.update({
			where: { userId: ctx.userId },
			data: toStoredJsonData(updated),
		});

		return updated;
	});

	logger.info("Promoted profile-only investments to Investment rows", {
		feature: "financialProfile",
		operation: "promote-investments",
		userId: ctx.userId,
		count: toPromote.length,
	});

	return nextData;
}

export const financialProfile = {
	get: withDemoOrAuth(async (ctx: DemoOrAuthContext) => {
		if (!ctx.isDemoMode) {
			await collapseLiveDuplicatePlaidAccountsSafely(ctx.db, ctx.userId);
		}
		const stored = await getOrCreateStoredData(ctx);
		const parsed = parseStoredData(stored);
		const promoted = await promoteProfileOnlyManualInvestments(ctx, parsed);
		const live = await buildDefaultedFinancialProfileData(ctx, promoted);

		if (ctx.isDemoMode && ctx.demoOverlaySessionKey) {
			const overlay = await getFinancialProfileOverlay(
				ctx.demoOverlaySessionKey,
			);
			if (overlay) {
				return withTaxProfileDefaults(
					FinancialProfileDataSchema.parse(overlay),
					live.incomeTransactions,
				);
			}
		}

		return withTaxProfileDefaults(live.data, live.incomeTransactions);
	}),

	update: withDemoOrAuth(async (ctx: DemoOrAuthContext, body: unknown) => {
		const input = updateFinancialProfileInput.parse(body);
		let data = stripTaxProfileRecommendations(input.data);
		assertInsuranceCloudSafe(data, ctx);

		if (ctx.isDemoMode) {
			if (!ctx.demoOverlaySessionKey) throw new Error("No demo session key");
			await updateFinancialProfileOverlay(ctx.demoOverlaySessionKey, data);
			return data;
		}

		const existingInvestments = await ctx.db.investment.findMany({
			where: { userId: ctx.userId },
			select: { id: true },
		});
		data = pruneMissingManualInvestmentsFromProfile(
			data,
			new Set(existingInvestments.map((row) => row.id)),
		);

		await ctx.db.financialProfileData.upsert({
			where: { userId: ctx.userId },
			create: {
				userId: ctx.userId,
				...toStoredJsonData(data),
			},
			update: toStoredJsonData(data),
		});
		await takeSnapshot(ctx.userId, ctx.db).catch((err) =>
			logger.logError("Snapshot failed after financial profile update", err, {
				feature: "financialProfile",
				operation: "update",
				userId: ctx.userId,
			}),
		);
		await markFinancialProfileSetupGuideStep(ctx.db, ctx.userId).catch(
			(err) => {
				logger.logError(
					"Failed to mark financial profile setup guide step",
					err,
					{
						feature: "setupGuide",
						operation: "markFinancialProfile",
						userId: ctx.userId,
					},
				);
			},
		);

		logger.info("Financial profile updated", {
			feature: "financialProfile",
			operation: "update",
			userId: ctx.userId,
		});

		return data;
	}),
};
