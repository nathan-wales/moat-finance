// Pure repository interface for Plaid Items.
// No Prisma, no runtime dependencies.

export interface PlaidItemSummary {
	id: string;
	plaidItemId: string;
	userId: string;
	institutionId: string | null;
	institutionName: string;
	requiresReconnect: boolean;
	lastErrorCode: string | null;
	lastErrorMessage: string | null;
	lastSyncAt: Date | null;
	lastSuccessfulSyncAt: Date | null;
	sortOrder: number;
}

export interface PlaidItemRepository {
	findById(input: { userId: string; id: string }): Promise<PlaidItemSummary | null>;
	findByPlaidItemId(input: { plaidItemId: string }): Promise<PlaidItemSummary | null>;
	listForUser(input: { userId: string }): Promise<PlaidItemSummary[]>;
	updateSortOrder(input: { userId: string; orderedIds: string[] }): Promise<void>;
}
