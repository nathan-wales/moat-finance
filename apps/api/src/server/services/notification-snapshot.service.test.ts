import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildFinancialSnapshot } from "./notification-snapshot.service";

process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";

type Tx = {
	id: string;
	date: Date;
	type: string;
	amount: number;
	merchantName: string | null;
	description: string | null;
	categoryId: string | null;
	category: string | null;
	categoryRef: { name: string } | null;
	hashtags: [];
	financialAccountId: string | null;
	pending: boolean;
};

type SnapshotRow = {
	userId: string;
	date: Date;
	balance: number;
};

type ChildProfile = {
	id: string;
	displayName: string;
	profileUserId: string;
	kind: "FAMILY" | "BUSINESS";
};

function expense(input: {
	id: string;
	date: string;
	amount: number;
	merchantName: string;
	description: string;
}): Tx {
	return {
		id: input.id,
		date: new Date(input.date),
		type: "EXPENSE",
		amount: input.amount,
		merchantName: input.merchantName,
		description: input.description,
		categoryId: null,
		category: null,
		categoryRef: null,
		hashtags: [],
		financialAccountId: "acct-1",
		pending: false,
	};
}

function matchesDateFilter(date: Date, filter: unknown): boolean {
	if (filter instanceof Date) return date.getTime() === filter.getTime();
	if (!filter || typeof filter !== "object") return true;
	const range = filter as { gte?: Date; lte?: Date };
	if (range.gte && date < range.gte) return false;
	if (range.lte && date > range.lte) return false;
	return true;
}

function createMockDb(options: {
	transactions?: Tx[];
	recurringRows?: Array<{
		normalized_description: string;
		year: number;
		month: number;
		monthly_total: number;
		last_date: Date;
	}>;
	accounts?: Array<{
		id: string;
		name: string;
		currentBalance: number;
		type: string;
	}>;
	snapshots?: SnapshotRow[];
	childProfiles?: ChildProfile[];
}) {
	const snapshots = options.snapshots ?? [];
	const rowsFor = (userId: string) =>
		snapshots.filter((row) => row.userId === userId);

	return {
		transaction: {
			findMany: async () => options.transactions ?? [],
			count: async () => 0,
		},
		financialAccount: {
			findMany: async () =>
				options.accounts ?? [
					{
						id: "acct-1",
						name: "Checking",
						currentBalance: 4000,
						type: "depository",
					},
				],
		},
		categoryBudget: { findMany: async () => [] },
		financialConnection: { findMany: async () => [] },
		expectedRecurringEvent: { findMany: async () => [] },
		profileLink: {
			findMany: async () => options.childProfiles ?? [],
		},
		balanceSnapshot: {
			count: async ({ where }: { where: { userId: string } }) =>
				Math.max(rowsFor(where.userId).length, snapshots.length > 0 ? 0 : 1),
			findFirst: async ({
				where,
			}: {
				where: { userId: string; date?: Date | { lte?: Date } };
			}) => {
				const matching = rowsFor(where.userId)
					.filter((row) => matchesDateFilter(row.date, where.date))
					.sort((a, b) => b.date.getTime() - a.date.getTime());
				const latest = matching[0];
				return latest ? { date: latest.date } : null;
			},
			findMany: async ({
				where,
			}: {
				where: { userId: string; date?: Date | { gte?: Date; lte?: Date } };
			}) =>
				rowsFor(where.userId)
					.filter((row) => matchesDateFilter(row.date, where.date))
					.map((row) => ({ date: row.date, balance: row.balance })),
		},
		$queryRaw: async () => options.recurringRows ?? [],
	};
}

describe("buildFinancialSnapshot recurring", () => {
	it("does not treat Costco twice in 100 days as recurring", async () => {
		const db = createMockDb({
			transactions: [
				expense({
					id: "c1",
					date: "2026-07-18T12:00:00.000Z",
					amount: 181.55,
					merchantName: "Costco",
					description: "COSTCO WHSE",
				}),
				expense({
					id: "c2",
					date: "2026-06-20T12:00:00.000Z",
					amount: 47.12,
					merchantName: "Costco",
					description: "COSTCO WHSE",
				}),
			],
			recurringRows: [
				{
					normalized_description: "costco whse",
					year: 2026,
					month: 6,
					monthly_total: 47.12,
					last_date: new Date("2026-06-20T12:00:00.000Z"),
				},
				{
					normalized_description: "costco whse",
					year: 2026,
					month: 7,
					monthly_total: 181.55,
					last_date: new Date("2026-07-18T12:00:00.000Z"),
				},
			],
		});

		const snapshot = await buildFinancialSnapshot(
			db as never,
			"user-1",
			new Date("2026-08-27T12:00:00.000Z"),
		);

		assert.deepEqual(snapshot.recurring, []);
		assert.equal(
			snapshot.transactions.every((tx) => tx.isRecurring === false),
			true,
		);
	});

	it("includes a stable 2-month subscription whose last charge jumped 20%", async () => {
		const db = createMockDb({
			transactions: [
				expense({
					id: "n1",
					date: "2026-07-15T12:00:00.000Z",
					amount: 19.19,
					merchantName: "Netflix",
					description: "NETFLIX.COM",
				}),
				expense({
					id: "n2",
					date: "2026-06-15T12:00:00.000Z",
					amount: 15.99,
					merchantName: "Netflix",
					description: "NETFLIX.COM",
				}),
			],
			recurringRows: [
				{
					normalized_description: "netflix.com",
					year: 2026,
					month: 6,
					monthly_total: 15.99,
					last_date: new Date("2026-06-15T12:00:00.000Z"),
				},
				{
					normalized_description: "netflix.com",
					year: 2026,
					month: 7,
					monthly_total: 19.19,
					last_date: new Date("2026-07-15T12:00:00.000Z"),
				},
			],
		});

		const snapshot = await buildFinancialSnapshot(
			db as never,
			"user-1",
			new Date("2026-08-27T12:00:00.000Z"),
		);

		assert.equal(snapshot.recurring.length, 1);
		assert.equal(snapshot.recurring[0]?.label, "netflix.com");
		assert.equal(snapshot.recurring[0]?.amount, 19.19);
		assert.equal(snapshot.recurring[0]?.previousAmount, 15.99);
		assert.equal(
			Math.abs(
				(snapshot.recurring[0]?.amount ?? 0) -
					(snapshot.recurring[0]?.previousAmount ?? 0),
			) /
				(snapshot.recurring[0]?.previousAmount ?? 1) >=
				0.1,
			true,
		);
		assert.equal(
			snapshot.transactions.filter((tx) => tx.isRecurring).length,
			2,
		);
	});
});

describe("buildFinancialSnapshot net worth", () => {
	it("uses signed snapshot totals instead of raw FinancialAccount balances", async () => {
		const db = createMockDb({
			accounts: [
				{
					id: "checking",
					name: "Checking",
					currentBalance: 4_000,
					type: "depository",
				},
				{
					id: "card",
					name: "Visa",
					currentBalance: 1_227,
					type: "credit",
				},
			],
			snapshots: [
				{
					userId: "user-1",
					date: new Date("2026-08-23T00:00:00.000Z"),
					balance: 90_000,
				},
				{
					userId: "user-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: 181_000,
				},
				{
					userId: "user-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: -1_227,
				},
			],
		});

		const snapshot = await buildFinancialSnapshot(
			db as never,
			"user-1",
			new Date("2026-08-27T12:00:00.000Z"),
		);

		assert.equal(snapshot.netWorth, 181_000 - 1_227);
		assert.equal(snapshot.previousWeekNetWorth, 90_000);
	});

	it("rolls opted-in child profile snapshots into owner net worth", async () => {
		const db = createMockDb({
			snapshots: [
				{
					userId: "user-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: 249_673,
				},
				{
					userId: "child-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: 263_983,
				},
			],
			childProfiles: [
				{
					id: "link-1",
					displayName: "Family",
					profileUserId: "child-1",
					kind: "FAMILY",
				},
			],
		});

		const snapshot = await buildFinancialSnapshot(
			db as never,
			"user-1",
			new Date("2026-08-27T12:00:00.000Z"),
		);

		assert.equal(snapshot.netWorth, 249_673 + 263_983);
	});
});
