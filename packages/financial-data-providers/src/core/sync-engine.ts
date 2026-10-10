import type {
	FinancialDataProvider,
	NormalizedAccount,
	NormalizedHolding,
	NormalizedTransaction,
	RemovedProviderTransaction,
	SyncTrigger,
} from "./types";

export type SyncFinancialConnectionPayload = {
	connectionId: string;
	trigger: SyncTrigger;
	webhookEventId?: string;
	force?: boolean;
};

export type ImportNormalizedFinancialDataInput = {
	userId: string;
	connectionId: string;
	canonicalInstitutionId?: string | null;
	provider: FinancialDataProvider;
	accounts: NormalizedAccount[];
	transactions: {
		added: NormalizedTransaction[];
		modified: NormalizedTransaction[];
		removed: RemovedProviderTransaction[];
	};
	holdings?: NormalizedHolding[];
};

export type ImportNormalizedFinancialDataResult = {
	accountCount: number;
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	holdingCount: number;
};
