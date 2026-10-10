import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { disconnectItem } from "./disconnect-item";

type ItemRow = {
	id: string;
	userId: string;
	plaidItemId: string;
	accessTokenEncrypted: string | null;
	accessRevokedAt: Date | null;
	cursor: string | null;
};

function createMockDb(item: ItemRow) {
	const items = [item];
	const connections: Array<{
		id: string;
		status: string;
		providerAccessTokenEncrypted: string | null;
	}> = [
		{ id: "conn-1", status: "ACTIVE", providerAccessTokenEncrypted: "tok" },
	];
	const cancelledJobs: string[] = [];
	const deletedItemIds: string[] = [];
	const nulledTransactionItemIds: string[] = [];
	const deactivatedAccountItemIds: string[] = [];

	const db = {
		plaidItem: {
			findFirstOrThrow: async ({
				where,
			}: {
				where: { id: string; userId: string };
			}) => {
				const row = items.find(
					(itemRow) =>
						itemRow.id === where.id && itemRow.userId === where.userId,
				);
				if (!row) throw new Error("PlaidItem not found");
				return row;
			},
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Partial<ItemRow>;
			}) => {
				const row = items.find((itemRow) => itemRow.id === where.id);
				if (!row) return null;
				Object.assign(row, data);
				return row;
			},
			delete: async ({ where }: { where: { id: string } }) => {
				deletedItemIds.push(where.id);
			},
		},
		plaidAccount: {
			updateMany: async ({ where }: { where: { plaidItemId: string } }) => {
				deactivatedAccountItemIds.push(where.plaidItemId);
				return { count: 1 };
			},
		},
		transaction: {
			updateMany: async ({ where }: { where: { plaidItemId: string } }) => {
				nulledTransactionItemIds.push(where.plaidItemId);
				return { count: 1 };
			},
		},
		financialConnection: {
			findMany: async () => connections.map((row) => ({ id: row.id })),
			updateMany: async ({
				data,
			}: {
				data: { status: string; providerAccessTokenEncrypted: null };
			}) => {
				for (const row of connections) {
					row.status = data.status;
					row.providerAccessTokenEncrypted = data.providerAccessTokenEncrypted;
				}
				return { count: connections.length };
			},
		},
		financialAccount: {
			updateMany: async () => ({ count: 1 }),
		},
		providerSyncJob: {
			updateMany: async ({
				where,
			}: {
				where: { connectionId: { in: string[] } };
			}) => {
				cancelledJobs.push(...where.connectionId.in);
				return { count: where.connectionId.in.length };
			},
		},
		items,
		connections,
		cancelledJobs,
		deletedItemIds,
		nulledTransactionItemIds,
		deactivatedAccountItemIds,
	};

	return db;
}

describe("disconnectItem", () => {
	it("revokes provider access, keeps the item, and does not null transactions", async () => {
		const db = createMockDb({
			id: "item-1",
			userId: "user-1",
			plaidItemId: "plaid-item-1",
			accessTokenEncrypted: null,
			accessRevokedAt: null,
			cursor: "cursor",
		});

		await disconnectItem("item-1", "user-1", db as never);

		assert.equal(db.items[0]?.accessTokenEncrypted, null);
		assert.ok(db.items[0]?.accessRevokedAt instanceof Date);
		assert.equal(db.items[0]?.cursor, null);
		assert.equal(db.connections[0]?.status, "DISCONNECTED");
		assert.deepEqual(db.deletedItemIds, []);
		assert.deepEqual(db.nulledTransactionItemIds, []);
		assert.deepEqual(db.deactivatedAccountItemIds, ["item-1"]);
		assert.deepEqual(db.cancelledJobs, ["conn-1"]);
	});
});
