import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	fingerprintForPlaidAccount,
	loadHistoricalOverlapWindowsForPlaidAccounts,
	seedTransactionSyncWatermarksForItem,
} from "./transaction-sync-watermarks";

describe("fingerprintForPlaidAccount", () => {
	it("prefers officialName when present", () => {
		const withOfficial = fingerprintForPlaidAccount({
			id: "a1",
			name: "Checking",
			officialName: "PNC Total Checking",
			type: "depository",
			subtype: "checking",
			mask: "1234",
			currency: "USD",
		});
		const withoutOfficial = fingerprintForPlaidAccount({
			id: "a1",
			name: "PNC Total Checking",
			officialName: null,
			type: "depository",
			subtype: "checking",
			mask: "1234",
			currency: "USD",
		});
		assert.equal(withOfficial, withoutOfficial);
	});
});

describe("seedTransactionSyncWatermarksForItem", () => {
	it("copies a disconnected FinancialAccount watermark onto a new PlaidAccount", async () => {
		const updates: Array<{ id: string; watermark: Date }> = [];
		const financialUpdates: Array<{ fingerprint: string; watermark: Date }> =
			[];
		const watermark = new Date("2026-08-01T00:00:00.000Z");
		const account = {
			id: "pa-1",
			name: "Checking",
			officialName: "PNC Total Checking",
			type: "depository",
			subtype: "checking",
			mask: "1234",
			currency: "USD",
		};
		const fingerprint = fingerprintForPlaidAccount(account);

		const db = {
			plaidAccount: {
				findMany: async () => [account],
				update: async ({
					where,
					data,
				}: {
					where: { id: string };
					data: { transactionsSyncedThrough: Date };
				}) => {
					updates.push({
						id: where.id,
						watermark: data.transactionsSyncedThrough,
					});
				},
			},
			financialAccount: {
				findMany: async () => [
					{
						accountFingerprint: fingerprint,
						transactionsSyncedThrough: watermark,
					},
				],
				updateMany: async ({
					where,
					data,
				}: {
					where: { accountFingerprint: string };
					data: { transactionsSyncedThrough: Date };
				}) => {
					financialUpdates.push({
						fingerprint: where.accountFingerprint,
						watermark: data.transactionsSyncedThrough,
					});
					return { count: 1 };
				},
			},
			transaction: {
				groupBy: async () => [],
			},
		};

		const result = await seedTransactionSyncWatermarksForItem(db as never, {
			userId: "user-1",
			plaidItemDbId: "item-2",
		});

		assert.equal(result.seeded, 1);
		assert.equal(updates[0]?.id, "pa-1");
		assert.equal(updates[0]?.watermark, watermark);
		assert.equal(financialUpdates[0]?.fingerprint, fingerprint);
	});

	it("falls back to MAX(date) grouped by accountFingerprint", async () => {
		const updates: Array<{ id: string; watermark: Date }> = [];
		const maxDate = new Date("2026-07-15T00:00:00.000Z");
		const account = {
			id: "pa-1",
			name: "Checking",
			officialName: null,
			type: "depository",
			subtype: "checking",
			mask: "9999",
			currency: "USD",
		};
		const fingerprint = fingerprintForPlaidAccount(account);

		const db = {
			plaidAccount: {
				findMany: async () => [account],
				update: async ({
					where,
					data,
				}: {
					where: { id: string };
					data: { transactionsSyncedThrough: Date };
				}) => {
					updates.push({
						id: where.id,
						watermark: data.transactionsSyncedThrough,
					});
				},
			},
			financialAccount: {
				findMany: async () => [],
				updateMany: async () => ({ count: 0 }),
			},
			transaction: {
				groupBy: async () => [
					{ accountFingerprint: fingerprint, _max: { date: maxDate } },
				],
			},
		};

		const result = await seedTransactionSyncWatermarksForItem(db as never, {
			userId: "user-1",
			plaidItemDbId: "item-2",
		});

		assert.equal(result.seeded, 1);
		assert.equal(updates[0]?.watermark, maxDate);
	});

	it("does not seed brand-new accounts with no prior history", async () => {
		const db = {
			plaidAccount: {
				findMany: async () => [
					{
						id: "pa-new",
						name: "New Checking",
						officialName: null,
						type: "depository",
						subtype: "checking",
						mask: "0000",
						currency: "USD",
					},
				],
				update: async () => {
					throw new Error("should not update");
				},
			},
			financialAccount: {
				findMany: async () => [],
				updateMany: async () => ({ count: 0 }),
			},
			transaction: {
				groupBy: async () => [],
			},
		};

		const result = await seedTransactionSyncWatermarksForItem(db as never, {
			userId: "user-1",
			plaidItemDbId: "item-new",
		});
		assert.equal(result.seeded, 0);
	});
});

describe("loadHistoricalOverlapWindowsForPlaidAccounts", () => {
	it("uses leftover-item MIN/MAX grouped by plaidAccountId", async () => {
		const from = new Date("2026-03-01T00:00:00.000Z");
		const through = new Date("2026-03-31T00:00:00.000Z");
		const db = {
			transaction: {
				groupBy: async ({
					by,
					where,
				}: {
					by: string[];
					where: { OR?: unknown };
				}) => {
					assert.deepEqual(by, ["plaidAccountId"]);
					assert.ok(where.OR);
					return [
						{
							plaidAccountId: "pa-1",
							_min: { date: from },
							_max: { date: through },
						},
					];
				},
			},
			plaidAccount: {
				findMany: async () => {
					throw new Error("should not fall back");
				},
			},
		};

		const result = await loadHistoricalOverlapWindowsForPlaidAccounts(
			db as never,
			{
				userId: "user-1",
				plaidAccountIds: ["pa-1"],
				currentPlaidItemDbId: "item-new",
			},
		);
		assert.deepEqual(result.get("pa-1"), { from, through });
	});

	it("falls back to accountFingerprint when the adopted row has no leftover txs", async () => {
		const from = new Date("2026-01-15T00:00:00.000Z");
		const through = new Date("2026-02-14T00:00:00.000Z");
		const account = {
			id: "pa-1",
			name: "Checking",
			officialName: null,
			type: "depository",
			subtype: "checking",
			mask: "1234",
			currency: "USD",
		};
		const fingerprint = fingerprintForPlaidAccount(account);
		const db = {
			transaction: {
				groupBy: async ({ by }: { by: string[] }) => {
					if (by[0] === "plaidAccountId") return [];
					return [
						{
							accountFingerprint: fingerprint,
							_min: { date: from },
							_max: { date: through },
						},
					];
				},
			},
			plaidAccount: {
				findMany: async () => [account],
			},
		};

		const result = await loadHistoricalOverlapWindowsForPlaidAccounts(
			db as never,
			{
				userId: "user-1",
				plaidAccountIds: ["pa-1"],
				currentPlaidItemDbId: "item-new",
			},
		);
		assert.deepEqual(result.get("pa-1"), { from, through });
	});
});
