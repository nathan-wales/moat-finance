import { z } from "zod";
import type { McpAuthContext } from "~/auth/types";

const STALE_SYNC_MS = 7 * 24 * 60 * 60 * 1000;

const storedAccountSchema = z.object({
	id: z.string(),
	name: z.string(),
	institution: z.string(),
	type: z.string(),
	balance: z.number(),
	connectionStatus: z.enum(["Synced", "Manual"]),
	lastSynced: z.string(),
	includedInNetWorth: z.boolean(),
	hidden: z.boolean().optional(),
});

const storedInvestmentSchema = z.object({
	id: z.string(),
	accountLink: z.string().optional(),
});

export type ListedAccountSyncStatus =
	| "ok"
	| "reconnect_required"
	| "stale"
	| "never_synced"
	| "manual";

export type ListedAccountClass =
	| "depository"
	| "credit"
	| "loan"
	| "investment"
	| "other";

export type ListedAccount = {
	id: string;
	name: string;
	mask: string | null;
	/** Human-readable account type, e.g. Checking, Roth IRA, Brokerage, HSA. */
	type: string;
	/** Provider subtype when available (raw), else null. */
	subtype: string | null;
	/** Coarse class for AI routing: depository vs investment vs credit/loan. */
	accountClass: ListedAccountClass;
	isInvestmentAccount: boolean;
	connectionStatus: "Synced" | "Manual";
	/** Raw provider type when available (e.g. Plaid `depository`). */
	providerType: string | null;
	/** Raw provider subtype when available (e.g. Plaid `checking`). */
	providerSubtype: string | null;
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string | null;
	isActive: boolean;
	institutionName: string | null;
	requiresReconnect: boolean;
	lastSuccessfulSyncAt: string | null;
	syncStatus: ListedAccountSyncStatus;
};

type StoredAccount = z.infer<typeof storedAccountSchema>;
type StoredInvestment = z.infer<typeof storedInvestmentSchema>;

type ManualInvestment = {
	id: string;
	name: string;
	type: string;
	startingBalance: number;
};

type AccountTypeMeta = {
	type: string;
	accountClass: ListedAccountClass;
	isInvestmentAccount: boolean;
};

const DISPLAY_TYPE_BY_KEY: Record<string, string> = {
	checking: "Checking",
	savings: "Savings",
	"credit card": "Credit Card",
	credit: "Credit Card",
	loan: "Loan",
	mortgage: "Mortgage",
	brokerage: "Brokerage",
	"stock brokerage": "Brokerage",
	stocks: "Brokerage",
	investment: "Investment",
	"roth ira": "Roth IRA",
	roth: "Roth IRA",
	ira: "IRA",
	"401k": "401(k)",
	"401(k)": "401(k)",
	four01k: "401(k)",
	"403b": "403(b)",
	"403(b)": "403(b)",
	"457b": "457(b)",
	hsa: "HSA",
	"529": "529",
	"education savings account": "529",
	cd: "CD",
	"money market": "Money Market",
	paypal: "Other",
	prepaid: "Other",
	cash: "Other",
	other: "Other",
};

const INVESTMENT_DISPLAY_TYPES = new Set([
	"brokerage",
	"investment",
	"stocks",
	"stock brokerage",
	"roth ira",
	"ira",
	"401(k)",
	"403(b)",
	"457(b)",
	"hsa",
	"529",
	"cd",
	"mutual fund",
	"crypto",
]);

function parseStoredAccounts(value: unknown): StoredAccount[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((account) => {
		const parsed = storedAccountSchema.safeParse(account);
		return parsed.success ? [parsed.data] : [];
	});
}

function parseStoredInvestments(value: unknown): StoredInvestment[] {
	if (!Array.isArray(value)) return [];
	return value.flatMap((investment) => {
		const parsed = storedInvestmentSchema.safeParse(investment);
		return parsed.success ? [parsed.data] : [];
	});
}

function manualInvestmentAccountId(id: string) {
	return `investment-acct-${id}`;
}

function institutionFromInvestmentName(name: string) {
	const separators = [" — ", " – ", " - "];
	for (const separator of separators) {
		const separatorIndex = name.lastIndexOf(separator);
		if (separatorIndex === -1) continue;
		const institution = name.slice(separatorIndex + separator.length).trim();
		if (institution.length > 0) return institution;
	}
	return "Manual";
}

function titleCaseAccountType(value: string) {
	return value
		.split(/[\s_]+/)
		.filter(Boolean)
		.map((part) => part.charAt(0).toUpperCase() + part.slice(1).toLowerCase())
		.join(" ");
}

function normalizeTypeKey(value: string) {
	return value.trim().toLowerCase().replaceAll("_", " ");
}

export function formatInvestmentAccountType(value: string) {
	const key = normalizeTypeKey(value);
	if (key.includes("401") || value === "FOUR01K") return "401(k)";
	if (key.includes("roth") || value === "ROTH_IRA") return "Roth IRA";
	if (key.includes("ira")) return "IRA";
	if (key.includes("hsa") || value === "HSA") return "HSA";
	if (key.includes("529")) return "529";
	if (key.includes("brokerage") || value === "STOCKS" || key === "stocks") {
		return "Brokerage";
	}
	if (value === "OTHER" || key === "other") return "Other";
	return DISPLAY_TYPE_BY_KEY[key] ?? titleCaseAccountType(value);
}

function resolveDisplayType(type: string, subtype: string | null): string {
	const candidates = [subtype, type]
		.filter((value): value is string => Boolean(value?.trim()))
		.map(normalizeTypeKey);

	for (const candidate of candidates) {
		const mapped = DISPLAY_TYPE_BY_KEY[candidate];
		if (mapped) return mapped;
		if (candidate.includes("roth")) return "Roth IRA";
		if (candidate.includes("401")) return "401(k)";
		if (candidate.includes("403")) return "403(b)";
		if (candidate.includes("457")) return "457(b)";
		if (candidate.includes("hsa")) return "HSA";
		if (candidate.includes("529") || candidate.includes("education")) {
			return "529";
		}
		if (candidate.includes("brokerage") || candidate.includes("mutual fund")) {
			return "Brokerage";
		}
		if (candidate.includes("mortgage")) return "Mortgage";
		if (candidate.includes("credit")) return "Credit Card";
	}

	const preferred = subtype?.trim() || type.trim();
	return titleCaseAccountType(preferred);
}

function resolveAccountClass(
	providerType: string | null,
	displayType: string,
): ListedAccountClass {
	const normalizedProvider = normalizeTypeKey(providerType ?? "");
	const normalizedDisplay = normalizeTypeKey(displayType);

	if (
		INVESTMENT_DISPLAY_TYPES.has(normalizedDisplay) ||
		normalizedProvider === "investment" ||
		normalizedProvider === "brokerage"
	) {
		return "investment";
	}
	if (
		normalizedProvider === "credit" ||
		normalizedDisplay === "credit card" ||
		normalizedDisplay === "credit"
	) {
		return "credit";
	}
	if (
		normalizedProvider === "loan" ||
		normalizedDisplay === "loan" ||
		normalizedDisplay === "mortgage"
	) {
		return "loan";
	}
	if (
		normalizedProvider === "depository" ||
		normalizedDisplay === "checking" ||
		normalizedDisplay === "savings" ||
		normalizedDisplay === "money market"
	) {
		return "depository";
	}
	return "other";
}

export function classifyAccountType(input: {
	type: string;
	subtype?: string | null;
	providerType?: string | null;
}): AccountTypeMeta {
	const displayType = resolveDisplayType(input.type, input.subtype ?? null);
	const accountClass = resolveAccountClass(
		input.providerType ?? input.type,
		displayType,
	);
	return {
		type: displayType,
		accountClass,
		isInvestmentAccount: accountClass === "investment",
	};
}

export function syncedAccountStatus(input: {
	requiresReconnect: boolean;
	lastSuccessfulSyncAt: Date | null;
}): ListedAccountSyncStatus {
	if (input.requiresReconnect) return "reconnect_required";
	if (!input.lastSuccessfulSyncAt) return "never_synced";
	const ageMs = Date.now() - input.lastSuccessfulSyncAt.getTime();
	if (ageMs > STALE_SYNC_MS) return "stale";
	return "ok";
}

function buildListedAccount(input: {
	id: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	providerType?: string | null;
	providerSubtype?: string | null;
	connectionStatus: "Synced" | "Manual";
	currentBalance: number | null;
	availableBalance: number | null;
	currency: string | null;
	isActive: boolean;
	institutionName: string | null;
	requiresReconnect: boolean;
	lastSuccessfulSyncAt: string | null;
	syncStatus: ListedAccountSyncStatus;
}): ListedAccount {
	const classified = classifyAccountType({
		type: input.type,
		subtype: input.subtype,
		providerType: input.providerType ?? input.type,
	});
	return {
		id: input.id,
		name: input.name,
		mask: input.mask,
		type: classified.type,
		subtype: input.subtype,
		accountClass: classified.accountClass,
		isInvestmentAccount: classified.isInvestmentAccount,
		connectionStatus: input.connectionStatus,
		providerType: input.providerType ?? null,
		providerSubtype: input.providerSubtype ?? null,
		currentBalance: input.currentBalance,
		availableBalance: input.availableBalance,
		currency: input.currency,
		isActive: input.isActive,
		institutionName: input.institutionName,
		requiresReconnect: input.requiresReconnect,
		lastSuccessfulSyncAt: input.lastSuccessfulSyncAt,
		syncStatus: input.syncStatus,
	};
}

function toStoredListedAccount(account: StoredAccount): ListedAccount {
	return buildListedAccount({
		id: account.id,
		name: account.name,
		mask: null,
		type: account.type,
		subtype: null,
		providerType: null,
		providerSubtype: null,
		connectionStatus: account.connectionStatus,
		currentBalance: account.balance,
		availableBalance: null,
		currency: null,
		isActive: true,
		institutionName: account.institution,
		requiresReconnect: false,
		lastSuccessfulSyncAt: null,
		syncStatus:
			account.connectionStatus === "Manual" ? "manual" : "never_synced",
	});
}

export function mergeProfileSectionAccounts(input: {
	storedAccounts: StoredAccount[];
	storedInvestments: StoredInvestment[];
	manualInvestments: ManualInvestment[];
	plaidAccounts: ListedAccount[];
	appleAccounts: ListedAccount[];
}): ListedAccount[] {
	const storedById = new Map(
		input.storedAccounts.map((account) => [account.id, account]),
	);
	const hasSyncedSources =
		input.plaidAccounts.length > 0 || input.appleAccounts.length > 0;
	const storedVisibleAccounts = input.storedAccounts.filter(
		(account) => account.hidden !== true,
	);
	const retainedStoredAccounts = (
		hasSyncedSources
			? storedVisibleAccounts.filter(
					(account) => account.connectionStatus === "Manual",
				)
			: storedVisibleAccounts
	).map(toStoredListedAccount);

	const syncedAccounts = [...input.plaidAccounts, ...input.appleAccounts];
	const baseAccounts = [...retainedStoredAccounts, ...syncedAccounts];

	const storedInvestmentById = new Map(
		input.storedInvestments.map((investment) => [investment.id, investment]),
	);
	const generatedIds = new Set(
		input.manualInvestments.map((investment) =>
			manualInvestmentAccountId(investment.id),
		),
	);
	const accountIds = new Set(baseAccounts.map((account) => account.id));

	const investmentsNeedingAccounts = input.manualInvestments.filter(
		(investment) => {
			const linkedAccountId = storedInvestmentById.get(
				investment.id,
			)?.accountLink;
			if (!linkedAccountId) return true;
			if (generatedIds.has(linkedAccountId)) return true;
			return !accountIds.has(linkedAccountId);
		},
	);

	const otherAccounts = baseAccounts.filter(
		(account) => !generatedIds.has(account.id),
	);
	const generatedAccounts = investmentsNeedingAccounts.flatMap<ListedAccount>(
		(investment) => {
			const id = manualInvestmentAccountId(investment.id);
			const storedAccount = storedById.get(id);
			if (storedAccount?.hidden) return [];
			return [
				buildListedAccount({
					id,
					name: investment.name,
					mask: null,
					type: formatInvestmentAccountType(investment.type),
					subtype: investment.type,
					providerType: "investment",
					providerSubtype: investment.type,
					connectionStatus: "Manual",
					currentBalance: investment.startingBalance,
					availableBalance: null,
					currency: null,
					isActive: true,
					institutionName: institutionFromInvestmentName(investment.name),
					requiresReconnect: false,
					lastSuccessfulSyncAt: null,
					syncStatus: "manual",
				}),
			];
		},
	);

	return [...otherAccounts, ...generatedAccounts];
}

export async function getProfileSectionAccounts(
	context: McpAuthContext,
): Promise<ListedAccount[]> {
	const [plaidAccounts, appleAccounts, profileData, manualInvestments] =
		await Promise.all([
			context.db.plaidAccount.findMany({
				where: {
					userId: context.userId,
					isActive: true,
					accountHidden: false,
				},
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
			}),
			context.db.appleFinanceKitAccount.findMany({
				where: {
					userId: context.userId,
					isActive: true,
					accountHidden: false,
					status: "ACTIVE",
				},
				orderBy: { displayName: "asc" },
			}),
			context.db.financialProfileData.findUnique({
				where: { userId: context.userId },
				select: { accounts: true, investments: true },
			}),
			context.db.investment.findMany({
				where: {
					userId: context.userId,
					type: { not: "REAL_ESTATE" },
				},
				select: {
					id: true,
					name: true,
					type: true,
					startingBalance: true,
				},
				orderBy: { createdAt: "asc" },
			}),
		]);

	const listedPlaid = plaidAccounts.map((account) =>
		buildListedAccount({
			id: account.id,
			name: account.officialName ?? account.name,
			mask: account.mask ? `••••${account.mask}` : null,
			type: account.type,
			subtype: account.subtype,
			providerType: account.type,
			providerSubtype: account.subtype,
			connectionStatus: "Synced",
			currentBalance: account.currentBalance,
			availableBalance: account.availableBalance,
			currency: account.currency,
			isActive: account.isActive,
			institutionName: account.plaidItem.institutionName,
			requiresReconnect: account.plaidItem.requiresReconnect,
			lastSuccessfulSyncAt:
				account.plaidItem.lastSuccessfulSyncAt?.toISOString() ?? null,
			syncStatus: syncedAccountStatus({
				requiresReconnect: account.plaidItem.requiresReconnect,
				lastSuccessfulSyncAt: account.plaidItem.lastSuccessfulSyncAt,
			}),
		}),
	);

	const listedApple = appleAccounts.map((account) =>
		buildListedAccount({
			id: account.id,
			name: account.displayName,
			mask: null,
			type: account.accountType,
			subtype: account.accountSubtype,
			providerType: account.accountType,
			providerSubtype: account.accountSubtype,
			connectionStatus: "Synced",
			currentBalance: account.currentBalance,
			availableBalance: account.availableBalance,
			currency: account.currency,
			isActive: account.isActive,
			institutionName: account.institutionName,
			requiresReconnect: false,
			lastSuccessfulSyncAt: account.lastSyncedAt?.toISOString() ?? null,
			syncStatus: syncedAccountStatus({
				requiresReconnect: false,
				lastSuccessfulSyncAt: account.lastSyncedAt,
			}),
		}),
	);

	return mergeProfileSectionAccounts({
		storedAccounts: parseStoredAccounts(profileData?.accounts),
		storedInvestments: parseStoredInvestments(profileData?.investments),
		manualInvestments,
		plaidAccounts: listedPlaid,
		appleAccounts: listedApple,
	});
}
