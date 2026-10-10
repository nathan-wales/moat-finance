import type { TransactionSyncAudit as DomainTransactionSyncAudit } from "@moat/domain";

export type NormalizedAccount = {
	providerAccountId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	syncEnabled: boolean;
	hidden: boolean;
	currentBalance: number | null;
	availableBalance: number | null;
};

export type NormalizedTransaction = {
	providerTransactionId: string;
	providerAccountId: string | null;
	amount: number;
	date: string;
	category: string;
	description: string;
	type: "INCOME" | "EXPENSE";
	pending: boolean;
	hidden: boolean;
	autoHiddenAsTransfer: boolean;
	removed: boolean;
	transferPairKey: string | null;
	hashtags: string[];
};

export type NormalizedAggregates = {
	spending: number;
	income: number;
	transfers: number;
	netWorth: number;
};

export type NormalizedFinancialState = {
	accounts: NormalizedAccount[];
	transactions: NormalizedTransaction[];
	aggregates: NormalizedAggregates;
};

export type TransactionSyncAudit = DomainTransactionSyncAudit;

export type GoldenDumpPhase = "initial" | "final";

export type UserCategoryOverride = {
	providerTransactionId: string;
	category: string;
};

export type GoldenCostcoRule = {
	descriptionContains: string;
	setCategory: string;
};
