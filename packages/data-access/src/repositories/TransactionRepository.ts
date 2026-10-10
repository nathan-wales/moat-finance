import type {
	CreateTransactionInput,
	DashboardTransaction,
	PaginatedTransactions,
	TransactionListQuery,
	TransactionSummary,
	TransactionSummaryInput,
	UpdateTransactionInput,
} from "../types";

export interface TransactionRepository {
	listRecent(input: {
		userId: string;
		limit: number;
		startDate?: Date;
		endDate?: Date;
	}): Promise<DashboardTransaction[]>;

	findById(input: {
		userId: string;
		transactionId: string;
	}): Promise<DashboardTransaction | null>;

	listByAppliedRuleId?(input: {
		userId: string;
		appliedRuleId: string;
	}): Promise<DashboardTransaction[]>;

	listPaginated(
		input: {
			userId: string;
		} & TransactionListQuery,
	): Promise<PaginatedTransactions>;

	count(input: {
		userId: string;
		search?: string;
		category?: string;
		categories?: string[];
		hashtag?: string;
		accountId?: string;
		accountIds?: string[];
		minAmount?: number;
		maxAmount?: number;
		startDate?: Date;
		endDate?: Date;
		type?: string;
		retailLinkedRetailer?: "amazon";
	}): Promise<number>;

	getSummary?(
		input: { userId: string } & TransactionSummaryInput,
	): Promise<TransactionSummary>;

	createMany(input: {
		userId: string;
		transactions: CreateTransactionInput[];
	}): Promise<number>;

	findFingerprints(input: {
		userId: string;
		fingerprints: string[];
	}): Promise<string[]>;

	findAccountFingerprint?(input: {
		userId: string;
		accountId: string;
	}): Promise<string | null>;

	listUnfingerprintedForDedupe?(input: {
		userId: string;
		startDate: Date;
		endDate: Date;
		amounts: number[];
	}): Promise<Array<{ date: Date; amount: number; description: string }>>;

	update(input: {
		userId: string;
		transactionId: string;
		data: UpdateTransactionInput;
	}): Promise<DashboardTransaction | null>;

	delete(input: { userId: string; transactionId: string }): Promise<void>;

	hide?(input: { userId: string; transactionId: string }): Promise<void>;

	bulkHide?(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number>;

	bulkDelete(input: {
		userId: string;
		transactionIds: string[];
	}): Promise<number>;

	listCategories(input: { userId: string }): Promise<string[]>;

	listHashtags?(input: { userId: string }): Promise<string[]>;

	setHashtags?(input: {
		userId: string;
		transactionId: string;
		hashtags: string[];
	}): Promise<void>;

	split?(input: {
		userId: string;
		id: string;
		type: "INCOME" | "EXPENSE";
		legs: Array<{
			id?: string;
			description: string;
			amount: number;
			categoryName: string;
			hashtags: string[];
			notes?: string | null;
			hidden?: boolean;
			date?: string;
		}>;
	}): Promise<{ originalId: string; splitIds: string[] }>;

	updateSplit?(input: {
		userId: string;
		id: string;
		type: "INCOME" | "EXPENSE";
		legs: Array<{
			id?: string;
			description: string;
			amount: number;
			categoryName: string;
			hashtags: string[];
			notes?: string | null;
			hidden?: boolean;
			date?: string;
		}>;
	}): Promise<{ originalId: string; splitIds: string[] }>;

	unsplit?(input: {
		userId: string;
		id: string;
	}): Promise<{ restoredId: string; removedIds: string[] }>;

	getSplitGroup?(input: { userId: string; id: string }): Promise<{
		original: DashboardTransaction;
		legs: DashboardTransaction[];
	} | null>;
}
