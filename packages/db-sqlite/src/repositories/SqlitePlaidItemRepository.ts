import type {
	PlaidItemRepository,
	PlaidItemSummary,
} from "@moat/data-access";
import type { SqliteDbClient } from "../db-client";

export class SqlitePlaidItemRepository implements PlaidItemRepository {
	constructor(private db: SqliteDbClient) {}

	async findById(input: { userId: string; id: string }): Promise<PlaidItemSummary | null> {
		const row = await this.db.plaidItem.findFirst({
			where: { id: input.id, userId: input.userId },
			select: {
				id: true,
				plaidItemId: true,
				userId: true,
				institutionId: true,
				institutionName: true,
				requiresReconnect: true,
				lastErrorCode: true,
				lastErrorMessage: true,
				lastSyncAt: true,
				lastSuccessfulSyncAt: true,
				sortOrder: true,
			},
		}) as PlaidItemSummary | null;
		return row ?? null;
	}

	async findByPlaidItemId(input: { plaidItemId: string }): Promise<PlaidItemSummary | null> {
		const row = await this.db.plaidItem.findUnique({
			where: { plaidItemId: input.plaidItemId },
			select: {
				id: true,
				plaidItemId: true,
				userId: true,
				institutionId: true,
				institutionName: true,
				requiresReconnect: true,
				lastErrorCode: true,
				lastErrorMessage: true,
				lastSyncAt: true,
				lastSuccessfulSyncAt: true,
				sortOrder: true,
			},
		}) as PlaidItemSummary | null;
		return row ?? null;
	}

	async listForUser(input: { userId: string }): Promise<PlaidItemSummary[]> {
		return (await this.db.plaidItem.findMany({
			where: { userId: input.userId },
			select: {
				id: true,
				plaidItemId: true,
				userId: true,
				institutionId: true,
				institutionName: true,
				requiresReconnect: true,
				lastErrorCode: true,
				lastErrorMessage: true,
				lastSyncAt: true,
				lastSuccessfulSyncAt: true,
				sortOrder: true,
			},
			orderBy: { sortOrder: "asc" },
		})) as PlaidItemSummary[];
	}

	async updateSortOrder(input: {
		userId: string;
		orderedIds: string[];
	}): Promise<void> {
		for (let i = 0; i < input.orderedIds.length; i++) {
			await this.db.plaidItem.updateMany({
				where: { id: input.orderedIds[i], userId: input.userId },
				data: { sortOrder: i },
			});
		}
	}
}
