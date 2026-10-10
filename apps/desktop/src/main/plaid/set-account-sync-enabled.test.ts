import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { setAccountSyncEnabled } from "./set-account-sync-enabled";

function createMockDb() {
	const accounts = [
		{
			id: "acct-1",
			plaidAccountId: "plaid_acct_1",
			userId: "user-1",
			syncEnabled: true,
		},
	];

	const db = {
		plaidAccount: {
			findFirst: async ({
				where,
			}: {
				where: {
					item: { userId: string };
					OR: Array<{ id?: string; plaidAccountId?: string }>;
				};
			}) => {
				const userId = where.item.userId;
				return (
					accounts.find((account) => {
						if (account.userId !== userId) return false;
						return where.OR.some(
							(clause) =>
								clause.id === account.id ||
								clause.plaidAccountId === account.plaidAccountId,
						);
					}) ?? null
				);
			},
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: { syncEnabled: boolean };
			}) => {
				const row = accounts.find((account) => account.id === where.id);
				if (!row) return null;
				row.syncEnabled = data.syncEnabled;
				return row;
			},
		},
	};

	return { db, accounts };
}

describe("desktop setAccountSyncEnabled", () => {
	it("toggles syncEnabled on the owned PlaidAccount", async () => {
		const { db, accounts } = createMockDb();
		const result = await setAccountSyncEnabled({
			db: db as never,
			userId: "user-1",
			accountId: "plaid-acct-1",
			syncEnabled: false,
		});
		assert.deepEqual(result, { id: "acct-1", syncEnabled: false });
		assert.equal(accounts[0]?.syncEnabled, false);
	});

	it("throws when the account is missing", async () => {
		const { db } = createMockDb();
		await assert.rejects(
			() =>
				setAccountSyncEnabled({
					db: db as never,
					userId: "user-1",
					accountId: "missing",
					syncEnabled: false,
				}),
			/Account not found/,
		);
	});
});
