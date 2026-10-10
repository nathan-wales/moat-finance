import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { collapseLiveDuplicatePlaidAccounts } from "./collapse-live-duplicate-accounts";

type MockAccount = {
	id: string;
	plaidAccountId: string;
	plaidItemId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	lastBalanceSyncAt: Date | null;
	createdAt: Date;
	isActive: boolean;
};

type MockItem = {
	id: string;
	plaidItemId: string;
	institutionId: string | null;
	institutionName: string;
	accessRevokedAt: Date | null;
	accessTokenEncrypted: string | null;
	plaidAccounts: MockAccount[];
};

function createMockDb(items: MockItem[]) {
	const updates: Array<{ ids: string[]; data: Record<string, unknown> }> = [];
	const disconnected: string[] = [];

	const db = {
		plaidItem: {
			findMany: async () => items,
		},
		plaidAccount: {
			updateMany: async ({
				where,
				data,
			}: {
				where: { id: { in: string[] } };
				data: Record<string, unknown>;
			}) => {
				updates.push({ ids: where.id.in, data });
				for (const item of items) {
					for (const account of item.plaidAccounts) {
						if (!where.id.in.includes(account.id)) continue;
						Object.assign(account, data);
					}
				}
				return { count: where.id.in.length };
			},
		},
		updates,
		disconnected,
	};

	return db;
}

describe("collapseLiveDuplicatePlaidAccounts", () => {
	it("keeps the most recently synced row and deactivates the rest", async () => {
		const older = new Date("2026-01-01T00:00:00.000Z");
		const newer = new Date("2026-09-08T00:00:00.000Z");
		const db = createMockDb([
			{
				id: "item-old",
				plaidItemId: "plaid-old",
				institutionId: "ins_robinhood",
				institutionName: "Robinhood",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc-old",
				plaidAccounts: [
					{
						id: "row-old",
						plaidAccountId: "acct-old",
						plaidItemId: "item-old",
						name: "Robinhood individual",
						mask: null,
						type: "investment",
						subtype: "brokerage",
						lastBalanceSyncAt: older,
						createdAt: older,
						isActive: true,
					},
				],
			},
			{
				id: "item-new",
				plaidItemId: "plaid-new",
				institutionId: "ins_robinhood",
				institutionName: "Robinhood",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc-new",
				plaidAccounts: [
					{
						id: "row-new",
						plaidAccountId: "acct-new",
						plaidItemId: "item-new",
						name: "Robinhood individual",
						mask: null,
						type: "investment",
						subtype: "brokerage",
						lastBalanceSyncAt: newer,
						createdAt: newer,
						isActive: true,
					},
				],
			},
		]);
		const disconnected: string[] = [];

		const result = await collapseLiveDuplicatePlaidAccounts(
			db as never,
			"user-1",
			async (itemId) => {
				disconnected.push(itemId);
			},
		);

		assert.equal(result.deactivatedAccountCount, 1);
		assert.deepEqual(db.updates[0]?.ids, ["row-old"]);
		assert.deepEqual(db.updates[0]?.data, {
			isActive: false,
			syncEnabled: false,
			accountHidden: true,
		});
		assert.deepEqual(disconnected, ["item-old"]);
		assert.equal(result.disconnectedItemCount, 1);
	});

	it("does not collapse different names that share a mask", async () => {
		const db = createMockDb([
			{
				id: "item-1",
				plaidItemId: "plaid-1",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc",
				plaidAccounts: [
					{
						id: "row-checking",
						plaidAccountId: "acct-checking",
						plaidItemId: "item-1",
						name: "Total Checking",
						mask: "1234",
						type: "depository",
						subtype: "checking",
						lastBalanceSyncAt: new Date(),
						createdAt: new Date(),
						isActive: true,
					},
					{
						id: "row-savings",
						plaidAccountId: "acct-savings",
						plaidItemId: "item-1",
						name: "Savings",
						mask: "1234",
						type: "depository",
						subtype: "savings",
						lastBalanceSyncAt: new Date(),
						createdAt: new Date(),
						isActive: true,
					},
				],
			},
		]);

		const result = await collapseLiveDuplicatePlaidAccounts(
			db as never,
			"user-1",
			async () => {
				throw new Error("should not disconnect");
			},
		);

		assert.equal(result.deactivatedAccountCount, 0);
		assert.equal(result.disconnectedItemCount, 0);
		assert.deepEqual(db.updates, []);
	});

	it("does not disconnect an item that still has a unique inactive account", async () => {
		const older = new Date("2026-01-01T00:00:00.000Z");
		const newer = new Date("2026-09-08T00:00:00.000Z");
		const db = createMockDb([
			{
				id: "item-old",
				plaidItemId: "plaid-old",
				institutionId: "ins_robinhood",
				institutionName: "Robinhood",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc-old",
				plaidAccounts: [
					{
						id: "row-old-dup",
						plaidAccountId: "acct-old-dup",
						plaidItemId: "item-old",
						name: "Robinhood individual",
						mask: null,
						type: "investment",
						subtype: "brokerage",
						lastBalanceSyncAt: older,
						createdAt: older,
						isActive: true,
					},
					{
						id: "row-old-unique",
						plaidAccountId: "acct-old-unique",
						plaidItemId: "item-old",
						name: "Joint Brokerage",
						mask: null,
						type: "investment",
						subtype: "brokerage",
						lastBalanceSyncAt: older,
						createdAt: older,
						isActive: false,
					},
				],
			},
			{
				id: "item-new",
				plaidItemId: "plaid-new",
				institutionId: "ins_robinhood",
				institutionName: "Robinhood",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc-new",
				plaidAccounts: [
					{
						id: "row-new",
						plaidAccountId: "acct-new",
						plaidItemId: "item-new",
						name: "Robinhood individual",
						mask: null,
						type: "investment",
						subtype: "brokerage",
						lastBalanceSyncAt: newer,
						createdAt: newer,
						isActive: true,
					},
				],
			},
		]);
		const disconnected: string[] = [];

		const result = await collapseLiveDuplicatePlaidAccounts(
			db as never,
			"user-1",
			async (itemId) => {
				disconnected.push(itemId);
			},
		);

		assert.equal(result.deactivatedAccountCount, 1);
		assert.deepEqual(db.updates[0]?.ids, ["row-old-dup"]);
		assert.deepEqual(disconnected, []);
		assert.equal(result.disconnectedItemCount, 0);
	});
});
