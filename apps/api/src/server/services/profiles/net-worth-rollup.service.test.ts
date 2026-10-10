import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	getRolledUpCurrentNetWorth,
	getRolledUpNetWorthOnOrBefore,
} from "./net-worth-rollup.service";

process.env.MOAT_DATABASE_ACTOR_CONTEXT = "false";

type SnapshotRow = {
	userId: string;
	date: Date;
	balance: number;
};

function matchesDateFilter(date: Date, filter: unknown): boolean {
	if (filter instanceof Date) return date.getTime() === filter.getTime();
	if (!filter || typeof filter !== "object") return true;
	const range = filter as { gte?: Date; lte?: Date };
	if (range.gte && date < range.gte) return false;
	if (range.lte && date > range.lte) return false;
	return true;
}

function createMockDb(options: {
	snapshots: SnapshotRow[];
	children?: Array<{
		id: string;
		displayName: string;
		profileUserId: string;
		kind: "FAMILY" | "BUSINESS";
	}>;
}) {
	const rowsFor = (userId: string) =>
		options.snapshots.filter((row) => row.userId === userId);

	return {
		profileLink: {
			findMany: async () => options.children ?? [],
		},
		balanceSnapshot: {
			count: async ({ where }: { where: { userId: string } }) =>
				Math.max(rowsFor(where.userId).length, 1),
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
	};
}

const identity = {
	actorUserId: "owner-1",
	effectiveUserId: "owner-1",
	isHouseholdMember: false,
};

describe("getRolledUpCurrentNetWorth", () => {
	it("returns the last monthly snapshot total, including child profiles", async () => {
		const db = createMockDb({
			snapshots: [
				{
					userId: "owner-1",
					date: new Date("2026-07-31T00:00:00.000Z"),
					balance: 200_000,
				},
				{
					userId: "owner-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: 249_673,
				},
				{
					userId: "child-1",
					date: new Date("2026-08-20T00:00:00.000Z"),
					balance: 263_983,
				},
			],
			children: [
				{
					id: "link-1",
					displayName: "Family",
					profileUserId: "child-1",
					kind: "FAMILY",
				},
			],
		});

		const total = await getRolledUpCurrentNetWorth(db as never, identity);
		assert.equal(total, 249_673 + 263_983);
	});
});

describe("getRolledUpNetWorthOnOrBefore", () => {
	it("sums the latest snapshot day on or before the as-of date", async () => {
		const db = createMockDb({
			snapshots: [
				{
					userId: "owner-1",
					date: new Date("2026-08-16T00:00:00.000Z"),
					balance: 240_000,
				},
				{
					userId: "owner-1",
					date: new Date("2026-08-23T00:00:00.000Z"),
					balance: 245_000,
				},
				{
					userId: "owner-1",
					date: new Date("2026-08-27T00:00:00.000Z"),
					balance: 249_673,
				},
				{
					userId: "child-1",
					date: new Date("2026-08-23T00:00:00.000Z"),
					balance: 10_000,
				},
			],
			children: [
				{
					id: "link-1",
					displayName: "Family",
					profileUserId: "child-1",
					kind: "FAMILY",
				},
			],
		});

		const total = await getRolledUpNetWorthOnOrBefore(
			db as never,
			identity,
			new Date("2026-08-23T23:59:59.999Z"),
		);
		assert.equal(total, 245_000 + 10_000);
	});
});
