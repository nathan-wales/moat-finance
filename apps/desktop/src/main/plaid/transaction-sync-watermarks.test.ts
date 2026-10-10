import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { loadDesktopHistoricalOverlapWindows } from "./transaction-sync-watermarks";

const from = new Date("2026-03-01T00:00:00.000Z");
const through = new Date("2026-03-31T00:00:00.000Z");

const checkingAccount = {
	name: "Checking",
	officialName: null,
	mask: "1234",
	type: "depository",
	subtype: "checking",
	currency: "USD",
};

describe("loadDesktopHistoricalOverlapWindows", () => {
	it("uses leftover-item MIN/MAX grouped by live plaidAccountId", async () => {
		const db = {
			transaction: {
				findMany: async ({
					where,
				}: {
					where: { OR?: unknown; plaidAccountId: { in: string[] } };
				}) => {
					assert.ok(where.OR);
					assert.deepEqual(where.plaidAccountId.in, ["pa-live"]);
					return [
						{ plaidAccountId: "pa-live", date: from },
						{ plaidAccountId: "pa-live", date: through },
					];
				},
				count: async () => 12,
			},
			plaidItem: {
				findUnique: async () => {
					throw new Error("should not fall back");
				},
			},
			plaidAccount: {
				findMany: async () => {
					throw new Error("should not fall back");
				},
			},
		};

		const result = await loadDesktopHistoricalOverlapWindows({
			db: db as never,
			plaidAccountIds: ["pa-live"],
			currentPlaidItemDbId: "item-new",
		});
		assert.deepEqual(result.get("pa-live"), { from, through });
	});

	it("falls back to leftover txs on another account with the same fingerprint", async () => {
		let leftoverQueries = 0;
		const db = {
			transaction: {
				findMany: async ({
					where,
				}: {
					where: { plaidAccountId: { in: string[] } };
				}) => {
					leftoverQueries += 1;
					if (leftoverQueries === 1) {
						assert.deepEqual(where.plaidAccountId.in, ["pa-live"]);
						return [];
					}
					assert.deepEqual(where.plaidAccountId.in, ["pa-prior"]);
					return [
						{ plaidAccountId: "pa-prior", date: from },
						{ plaidAccountId: "pa-prior", date: through },
					];
				},
				count: async () => 0,
			},
			plaidItem: {
				findUnique: async () => ({ userId: "user-1" }),
			},
			plaidAccount: {
				findMany: async ({
					where,
				}: {
					where: { id?: { in?: string[]; notIn?: string[] } };
				}) => {
					if (where.id?.in) {
						return [{ id: "pa-live", ...checkingAccount }];
					}
					return [{ id: "pa-prior", ...checkingAccount }];
				},
			},
		};

		const result = await loadDesktopHistoricalOverlapWindows({
			db: db as never,
			plaidAccountIds: ["pa-live"],
			currentPlaidItemDbId: "item-new",
		});
		assert.deepEqual(result.get("pa-live"), { from, through });
	});

	it("maps leftover coverage from a still-live prior item", async () => {
		const db = {
			transaction: {
				findMany: async ({
					where,
				}: {
					where: { plaidAccountId: { in: string[] } };
				}) => {
					if (where.plaidAccountId.in.includes("pa-live")) return [];
					return [
						{ plaidAccountId: "pa-old-live", date: from },
						{ plaidAccountId: "pa-old-live", date: through },
					];
				},
				count: async () => 0,
			},
			plaidItem: {
				findUnique: async () => ({ userId: "user-1" }),
			},
			plaidAccount: {
				findMany: async ({
					where,
				}: {
					where: { id?: { in?: string[]; notIn?: string[] } };
				}) => {
					if (where.id?.in) {
						return [{ id: "pa-live", ...checkingAccount }];
					}
					return [{ id: "pa-old-live", ...checkingAccount }];
				},
			},
		};

		const result = await loadDesktopHistoricalOverlapWindows({
			db: db as never,
			plaidAccountIds: ["pa-live"],
			currentPlaidItemDbId: "item-new",
		});
		assert.deepEqual(result.get("pa-live"), { from, through });
	});

	it("returns no window when leftover coverage is missing", async () => {
		const db = {
			transaction: {
				findMany: async () => [],
				count: async () => 0,
			},
			plaidItem: {
				findUnique: async () => ({ userId: "user-1" }),
			},
			plaidAccount: {
				findMany: async () => [
					{
						id: "pa-live",
						...checkingAccount,
					},
				],
			},
		};

		const result = await loadDesktopHistoricalOverlapWindows({
			db: db as never,
			plaidAccountIds: ["pa-live"],
			currentPlaidItemDbId: "item-new",
		});
		assert.equal(result.size, 0);
	});

	it("does not match leftover txs from a different account fingerprint", async () => {
		const db = {
			transaction: {
				findMany: async () => [],
				count: async () => 0,
			},
			plaidItem: {
				findUnique: async () => ({ userId: "user-1" }),
			},
			plaidAccount: {
				findMany: async ({
					where,
				}: {
					where: { id?: { in?: string[]; notIn?: string[] } };
				}) => {
					if (where.id?.in) {
						return [{ id: "pa-live", ...checkingAccount }];
					}
					return [
						{
							id: "pa-card",
							name: "Credit Card",
							officialName: null,
							mask: "5640",
							type: "credit",
							subtype: "credit card",
							currency: "USD",
						},
					];
				},
			},
		};

		const result = await loadDesktopHistoricalOverlapWindows({
			db: db as never,
			plaidAccountIds: ["pa-live"],
			currentPlaidItemDbId: "item-new",
		});
		assert.equal(result.size, 0);
	});
});
