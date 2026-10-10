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
	const financialUpdates: Array<{
		where: Record<string, unknown>;
		data: { syncEnabled: boolean };
	}> = [];

	const db = {
		plaidAccount: {
			findFirst: async ({
				where,
			}: {
				where: { userId: string; OR: Array<{ id: string }> };
			}) => {
				const ids = where.OR.map((clause) => clause.id);
				return (
					accounts.find(
						(account) =>
							account.userId === where.userId && ids.includes(account.id),
					) ?? null
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
		financialAccount: {
			updateMany: async (args: {
				where: Record<string, unknown>;
				data: { syncEnabled: boolean };
			}) => {
				financialUpdates.push(args);
				return { count: 1 };
			},
		},
	};

	return { db, accounts, financialUpdates };
}

describe("setAccountSyncEnabled", () => {
	it("sets PlaidAccount and matching FinancialAccount without removing the Item", async () => {
		const { db, accounts, financialUpdates } = createMockDb();
		const result = await setAccountSyncEnabled({
			db: db as never,
			userId: "user-1",
			accountId: "plaid-acct-1",
			syncEnabled: false,
		});

		assert.deepEqual(result, { id: "acct-1", syncEnabled: false });
		assert.equal(accounts[0]?.syncEnabled, false);
		assert.equal(financialUpdates.length, 1);
		assert.equal(financialUpdates[0]?.data.syncEnabled, false);
		assert.equal(financialUpdates[0]?.where.provider, "PLAID");
		assert.equal(financialUpdates[0]?.where.providerAccountId, "plaid_acct_1");
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
