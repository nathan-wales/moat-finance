import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountBase } from "plaid";
import { syncAccountsForItem } from "./syncAccounts";

function plaidAccount(overrides: {
	account_id: string;
	name: string;
	mask?: string | null;
	type?: string;
	subtype?: string | null;
}): AccountBase {
	return {
		official_name: null,
		mask: "1234",
		type: "depository",
		subtype: "checking",
		balances: {
			available: 90,
			current: 100,
			iso_currency_code: "USD",
			unofficial_currency_code: null,
			limit: null,
		},
		...overrides,
	} as AccountBase;
}

function createMockDb() {
	const upserts: string[] = [];
	const db = {
		plaidItem: {
			findUnique: async () => ({
				institutionId: "ins_1",
				institutionName: "Chase",
			}),
			findMany: async () => [
				{
					id: "sibling-item",
					plaidItemId: "plaid-sibling",
					institutionId: "ins_1",
					institutionName: "Chase",
					accessRevokedAt: null,
					accessTokenEncrypted: "enc",
					plaidAccounts: [
						{
							id: "live-checking",
							plaidAccountId: "old-checking",
							plaidItemId: "sibling-item",
							name: "Total Checking",
							officialName: null,
							mask: "1234",
							type: "depository",
							subtype: "checking",
							currentBalance: 50,
							lastBalanceSyncAt: new Date(),
							createdAt: new Date(),
						},
					],
				},
			],
			update: async () => ({}),
		},
		plaidAccount: {
			findFirst: async () => null,
			upsert: async ({
				create,
			}: {
				create: { plaidAccountId: string; name: string };
			}) => {
				upserts.push(create.plaidAccountId);
				return {
					id: `db-${create.plaidAccountId}`,
					plaidAccountId: create.plaidAccountId,
					name: create.name,
					officialName: null,
					mask: "9999",
					type: "depository",
					subtype: "savings",
					currentBalance: 10,
				};
			},
			updateMany: async () => ({ count: 0 }),
		},
		upserts,
	};
	return db;
}

describe("syncAccountsForItem live sibling skip", () => {
	it("does not persist an account that uniquely matches a live sibling", async () => {
		const db = createMockDb();

		const map = await syncAccountsForItem({
			db: db as never,
			userId: "user-1",
			plaidItemDbId: "new-item",
			accessToken: "token",
			plaidAccounts: [
				plaidAccount({
					account_id: "fresh-checking",
					name: "Total Checking",
				}),
				plaidAccount({
					account_id: "fresh-savings",
					name: "Savings",
					mask: "9999",
					subtype: "savings",
				}),
			],
		});

		assert.deepEqual(db.upserts, ["fresh-savings"]);
		assert.equal(map.has("fresh-checking"), false);
		assert.equal(map.get("fresh-savings")?.id, "db-fresh-savings");
	});

	it("persists accounts when sibling matching fails", async () => {
		const db = createMockDb();
		db.plaidItem.findMany = async () => {
			throw new Error("sibling lookup failed");
		};

		const map = await syncAccountsForItem({
			db: db as never,
			userId: "user-1",
			plaidItemDbId: "new-item",
			accessToken: "token",
			plaidAccounts: [
				plaidAccount({
					account_id: "fresh-checking",
					name: "Total Checking",
				}),
				plaidAccount({
					account_id: "fresh-savings",
					name: "Savings",
					mask: "9999",
					subtype: "savings",
				}),
			],
		});

		assert.deepEqual(db.upserts, ["fresh-checking", "fresh-savings"]);
		assert.equal(map.size, 2);
	});
});
