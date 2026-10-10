import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { AccountBase } from "plaid";
import { adoptRevokedPlaidAccountsForInstitution } from "./adopt-revoked-accounts";

type MockAccount = {
	id: string;
	plaidAccountId: string;
	name: string;
	mask: string | null;
	type: string;
	subtype: string | null;
	plaidItemId?: string;
	isActive?: boolean;
};

type MockItem = {
	id: string;
	institutionId: string | null;
	institutionName: string;
	accessRevokedAt: Date | null;
	accessTokenEncrypted: string | null;
	plaidAccounts: MockAccount[];
};

function createMockDb(items: MockItem[]) {
	const allAccounts = items.flatMap((item) =>
		item.plaidAccounts.map((account) => ({ ...account, plaidItemId: item.id })),
	);
	const updates: Array<{ id: string; data: Record<string, unknown> }> = [];

	return {
		plaidItem: {
			findMany: async ({ where }: { where: { id: { not: string } } }) =>
				items.filter((item) => item.id !== where.id.not),
		},
		plaidAccount: {
			findMany: async ({
				where,
			}: {
				where: { plaidAccountId: { in: string[] } };
			}) =>
				allAccounts.filter((account) =>
					where.plaidAccountId.in.includes(account.plaidAccountId),
				),
			update: async ({
				where,
				data,
			}: {
				where: { id: string };
				data: Record<string, unknown>;
			}) => {
				updates.push({ id: where.id, data });
				return { id: where.id };
			},
		},
		updates,
	};
}

function plaidAccount(overrides: {
	account_id: string;
	name: string;
	mask?: string | null;
	type?: string;
	subtype?: string | null;
}): AccountBase {
	return {
		mask: null,
		type: "depository",
		subtype: "checking",
		official_name: null,
		balances: {
			available: null,
			current: null,
			iso_currency_code: "USD",
			limit: null,
			unofficial_currency_code: null,
		},
		...overrides,
	} as unknown as AccountBase;
}

describe("adoptRevokedPlaidAccountsForInstitution", () => {
	it("repoints a paused row at the new Plaid account id when mask and type match", async () => {
		const db = createMockDb([
			{
				id: "old-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				plaidAccounts: [
					{
						id: "row-checking",
						plaidAccountId: "old-checking",
						name: "Total Checking",
						mask: "1234",
						type: "depository",
						subtype: "checking",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-chase",
			institutionId: "ins_1",
			institutionName: "Chase",
			plaidAccounts: [
				plaidAccount({
					account_id: "new-checking",
					name: "Total Checking",
					mask: "1234",
				}),
			],
		});

		assert.equal(result.adopted, 1);
		assert.deepEqual(db.updates, [
			{
				id: "row-checking",
				data: {
					plaidAccountId: "new-checking",
					plaidItemId: "new-chase",
					isActive: true,
				},
			},
		]);
	});

	it("falls back to name and type when the mask is missing", async () => {
		const db = createMockDb([
			{
				id: "old-fidelity",
				institutionId: null,
				institutionName: "Fidelity",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				plaidAccounts: [
					{
						id: "row-brokerage",
						plaidAccountId: "old-brokerage",
						name: "  Individual   Brokerage ",
						mask: null,
						type: "investment",
						subtype: "brokerage",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-fidelity",
			institutionName: "Fidelity",
			plaidAccounts: [
				plaidAccount({
					account_id: "new-brokerage",
					name: "Individual Brokerage",
					type: "investment",
					subtype: "brokerage",
				}),
			],
		});

		assert.equal(result.adopted, 1);
		assert.equal(db.updates[0]?.id, "row-brokerage");
	});

	it("does not adopt accounts from a different institution", async () => {
		const db = createMockDb([
			{
				id: "old-amex",
				institutionId: "ins_2",
				institutionName: "Amex",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				plaidAccounts: [
					{
						id: "row-amex",
						plaidAccountId: "old-amex-card",
						name: "Platinum Card",
						mask: "1234",
						type: "credit",
						subtype: "credit card",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-chase",
			institutionId: "ins_1",
			institutionName: "Chase",
			plaidAccounts: [
				plaidAccount({
					account_id: "new-chase-card",
					name: "Platinum Card",
					mask: "1234",
					type: "credit",
					subtype: "credit card",
				}),
			],
		});

		assert.equal(result.adopted, 0);
		assert.deepEqual(db.updates, []);
	});

	it("leaves live items alone", async () => {
		const db = createMockDb([
			{
				id: "other-live-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: null,
				accessTokenEncrypted: "enc",
				plaidAccounts: [
					{
						id: "row-live",
						plaidAccountId: "live-checking",
						name: "Total Checking",
						mask: "1234",
						type: "depository",
						subtype: "checking",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-chase",
			institutionId: "ins_1",
			institutionName: "Chase",
			plaidAccounts: [
				plaidAccount({
					account_id: "new-checking",
					name: "Total Checking",
					mask: "1234",
				}),
			],
		});

		assert.equal(result.adopted, 0);
	});

	it("skips incoming accounts we already store", async () => {
		const db = createMockDb([
			{
				id: "old-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				plaidAccounts: [
					{
						id: "row-checking",
						plaidAccountId: "same-checking",
						name: "Total Checking",
						mask: "1234",
						type: "depository",
						subtype: "checking",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-chase",
			institutionId: "ins_1",
			institutionName: "Chase",
			plaidAccounts: [
				plaidAccount({
					account_id: "same-checking",
					name: "Total Checking",
					mask: "1234",
				}),
			],
		});

		assert.equal(result.adopted, 0);
		assert.deepEqual(db.updates, []);
	});

	it("matches each paused row at most once", async () => {
		const db = createMockDb([
			{
				id: "old-chase",
				institutionId: "ins_1",
				institutionName: "Chase",
				accessRevokedAt: new Date(),
				accessTokenEncrypted: null,
				plaidAccounts: [
					{
						id: "row-checking",
						plaidAccountId: "old-checking",
						name: "Checking",
						mask: "1234",
						type: "depository",
						subtype: "checking",
					},
				],
			},
		]);

		const result = await adoptRevokedPlaidAccountsForInstitution(db as never, {
			userId: "user-1",
			keepItemId: "new-chase",
			institutionId: "ins_1",
			institutionName: "Chase",
			plaidAccounts: [
				plaidAccount({
					account_id: "new-checking-a",
					name: "Checking",
					mask: "1234",
				}),
				plaidAccount({
					account_id: "new-checking-b",
					name: "Checking",
					mask: "1234",
				}),
			],
		});

		assert.equal(result.adopted, 1);
		assert.equal(db.updates.length, 1);
	});
});
