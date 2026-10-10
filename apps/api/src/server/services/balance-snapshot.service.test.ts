import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	sumSnapshotsOnOrBefore,
	takeSnapshot,
} from "./balance-snapshot.service";

type SnapshotRow = {
	id: string;
	source: "PLAID" | "INVESTMENT" | "REAL_ESTATE";
	sourceId: string;
};

function createMockDb(options: {
	plaidAccounts?: Array<{
		id: string;
		type: string;
		subtype: string | null;
		currentBalance: number | null;
	}>;
	investments?: Array<{ id: string; startingBalance: number }>;
	realEstate?: Array<{
		id: string;
		currentEstimatedValue: number;
		currentLoanBalance: number;
	}>;
	existingToday?: SnapshotRow[];
	financialProfileData?: {
		accounts: unknown;
		assets: unknown;
	} | null;
}) {
	const deletedIds: string[] = [];
	const upserted: Array<{
		source: string;
		sourceId: string;
		balance: number;
	}> = [];

	const db = {
		plaidAccount: {
			findMany: async () => options.plaidAccounts ?? [],
		},
		investment: {
			findMany: async () => options.investments ?? [],
		},
		realEstateInvestment: {
			findMany: async () => options.realEstate ?? [],
		},
		financialProfileData: {
			findUnique: async () => options.financialProfileData ?? null,
		},
		balanceSnapshot: {
			findMany: async () => options.existingToday ?? [],
			deleteMany: async ({ where }: { where: { id: { in: string[] } } }) => {
				deletedIds.push(...where.id.in);
				return { count: where.id.in.length };
			},
			upsert: async ({
				create,
			}: {
				create: {
					source: string;
					sourceId: string;
					balance: number;
				};
			}) => {
				upserted.push({
					source: create.source,
					sourceId: create.sourceId,
					balance: create.balance,
				});
				return create;
			},
		},
		deletedIds,
		upserted,
	};

	return db;
}

describe("takeSnapshot", () => {
	it("deletes today's snapshot rows for disconnected Plaid accounts", async () => {
		const db = createMockDb({
			plaidAccounts: [
				{
					id: "acct-kept",
					type: "investment",
					subtype: "brokerage",
					currentBalance: 100_000,
				},
			],
			existingToday: [
				{ id: "snap-kept", source: "PLAID", sourceId: "acct-kept" },
				{ id: "snap-orphan-a", source: "PLAID", sourceId: "acct-dup-a" },
				{ id: "snap-orphan-b", source: "PLAID", sourceId: "acct-dup-b" },
			],
		});

		await takeSnapshot("user-1", db as never);

		assert.deepEqual(db.deletedIds.sort(), ["snap-orphan-a", "snap-orphan-b"]);
		assert.equal(db.upserted.length, 1);
		assert.equal(db.upserted[0]?.sourceId, "acct-kept");
		assert.equal(db.upserted[0]?.balance, 100_000);
	});

	it("deletes today's snapshot rows for removed investments and real estate", async () => {
		const db = createMockDb({
			investments: [{ id: "inv-kept", startingBalance: 50_000 }],
			realEstate: [
				{
					id: "re-kept",
					currentEstimatedValue: 400_000,
					currentLoanBalance: 200_000,
				},
			],
			existingToday: [
				{ id: "snap-inv-kept", source: "INVESTMENT", sourceId: "inv-kept" },
				{ id: "snap-inv-gone", source: "INVESTMENT", sourceId: "inv-gone" },
				{ id: "snap-re-kept", source: "REAL_ESTATE", sourceId: "re-kept" },
				{ id: "snap-re-gone", source: "REAL_ESTATE", sourceId: "re-gone" },
			],
		});

		await takeSnapshot("user-1", db as never);

		assert.deepEqual(db.deletedIds.sort(), ["snap-inv-gone", "snap-re-gone"]);
		assert.equal(db.upserted.length, 2);
	});

	it("does not delete when every today's row is still current", async () => {
		const db = createMockDb({
			plaidAccounts: [
				{
					id: "acct-1",
					type: "depository",
					subtype: "checking",
					currentBalance: 1_000,
				},
			],
			existingToday: [{ id: "snap-1", source: "PLAID", sourceId: "acct-1" }],
		});

		await takeSnapshot("user-1", db as never);

		assert.deepEqual(db.deletedIds, []);
		assert.equal(db.upserted.length, 1);
	});

	it("stores credit cards as negative and skips mortgage loans", async () => {
		const db = createMockDb({
			plaidAccounts: [
				{
					id: "brokerage",
					type: "investment",
					subtype: "brokerage",
					currentBalance: 181_000,
				},
				{
					id: "card",
					type: "credit",
					subtype: "credit card",
					currentBalance: 1_227,
				},
				{
					id: "mortgage",
					type: "loan",
					subtype: "mortgage",
					currentBalance: 750_000,
				},
			],
		});

		await takeSnapshot("user-1", db as never);

		assert.equal(db.upserted.length, 2);
		assert.equal(
			db.upserted.find((row) => row.sourceId === "brokerage")?.balance,
			181_000,
		);
		assert.equal(
			db.upserted.find((row) => row.sourceId === "card")?.balance,
			-1_227,
		);
		assert.equal(
			db.upserted.find((row) => row.sourceId === "mortgage"),
			undefined,
		);
	});
});

describe("sumSnapshotsOnOrBefore", () => {
	it("sums the latest snapshot day and ignores later days when asOf is set", async () => {
		const rows = [
			{
				userId: "user-1",
				date: new Date("2026-08-16T00:00:00.000Z"),
				balance: 10,
			},
			{
				userId: "user-1",
				date: new Date("2026-08-23T00:00:00.000Z"),
				balance: 40,
			},
			{
				userId: "user-1",
				date: new Date("2026-08-23T00:00:00.000Z"),
				balance: 5,
			},
			{
				userId: "user-1",
				date: new Date("2026-08-27T00:00:00.000Z"),
				balance: 100,
			},
		];

		const db = {
			balanceSnapshot: {
				findFirst: async ({
					where,
				}: {
					where: { userId: string; date?: { lte?: Date } };
				}) => {
					const matching = rows
						.filter((row) => row.userId === where.userId)
						.filter((row) => !where.date?.lte || row.date <= where.date.lte)
						.sort((a, b) => b.date.getTime() - a.date.getTime());
					const latest = matching[0];
					return latest ? { date: latest.date } : null;
				},
				findMany: async ({
					where,
				}: {
					where: { userId: string; date: Date };
				}) =>
					rows
						.filter(
							(row) =>
								row.userId === where.userId &&
								row.date.getTime() === where.date.getTime(),
						)
						.map((row) => ({ balance: row.balance })),
			},
		};

		assert.equal(
			await sumSnapshotsOnOrBefore(
				db as never,
				"user-1",
				new Date("2026-08-23T23:59:59.999Z"),
			),
			45,
		);
		assert.equal(await sumSnapshotsOnOrBefore(db as never, "user-1"), 100);
	});
});
