import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountBase } from "plaid";
import { syncAccountsForItem } from "./syncAccounts";

function plaidAccount(accountId: string, name: string): AccountBase {
	return {
		account_id: accountId,
		name,
		official_name: null,
		mask: "1111",
		type: "depository",
		subtype: "checking",
		balances: {
			available: 90,
			current: 100,
			iso_currency_code: "USD",
			unofficial_currency_code: null,
			limit: null,
		},
	} as AccountBase;
}

function createMockDb(existing: {
	id: string;
	plaidAccountId: string;
	syncEnabled: boolean;
	currentBalance: number | null;
}) {
	const row = { ...existing, isActive: true };
	const upserts: Array<{ data: Record<string, unknown> }> = [];
	const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

	const db = {
		plaidAccount: {
			findFirst: async ({ where }: { where: { plaidAccountId: string } }) =>
				where.plaidAccountId === row.plaidAccountId
					? { id: row.id, syncEnabled: row.syncEnabled }
					: null,
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				updates.push({ id: where.id, data });
				Object.assign(row, data);
				return row;
			},
			upsert: async ({ update }: { update: Record<string, unknown> }) => {
				upserts.push({ data: update });
				Object.assign(row, update);
				return {
					id: row.id,
					plaidAccountId: row.plaidAccountId,
					name: "Checking",
					officialName: null,
					mask: "1111",
					type: "depository",
					subtype: "checking",
					currentBalance: 100,
				};
			},
			updateMany: async () => ({ count: 0 }),
		},
		plaidItem: {
			findUnique: async () => null,
			update: async () => ({}),
		},
	};

	return { db, row, upserts, updates };
}

describe("syncAccountsForItem syncEnabled", () => {
	it("does not re-enable a disabled account or include it in the transaction map", async () => {
		const { db, row, upserts, updates } = createMockDb({
			id: "db-1",
			plaidAccountId: "acct_disabled",
			syncEnabled: false,
			currentBalance: 40,
		});

		const map = await syncAccountsForItem({
			db: db as never,
			userId: "user-1",
			plaidItemDbId: "item-1",
			accessToken: "token",
			plaidAccounts: [plaidAccount("acct_disabled", "Checking")],
		});

		assert.equal(map.size, 0);
		assert.equal(upserts.length, 0);
		assert.equal(row.syncEnabled, false);
		assert.equal(row.currentBalance, 40);
		assert.deepEqual(updates, [{ id: "db-1", data: { isActive: true } }]);
	});

	it("does not set syncEnabled true when refreshing an enabled account", async () => {
		const { db, upserts } = createMockDb({
			id: "db-2",
			plaidAccountId: "acct_live",
			syncEnabled: true,
			currentBalance: 40,
		});

		const map = await syncAccountsForItem({
			db: db as never,
			userId: "user-1",
			plaidItemDbId: "item-1",
			accessToken: "token",
			plaidAccounts: [plaidAccount("acct_live", "Checking")],
		});

		assert.equal(map.get("acct_live")?.id, "db-2");
		assert.equal(upserts.length, 1);
		assert.equal("syncEnabled" in (upserts[0]?.data ?? {}), false);
	});
});
