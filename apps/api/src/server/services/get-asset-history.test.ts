import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { getAssetHistory } from "./balance-snapshot.service";

function createMockDb(options: {
	currentBalance?: number | null;
	snapshots?: Array<{ date: Date; balance: number }>;
}) {
	return {
		plaidAccount: {
			findFirst: async () =>
				options.currentBalance === null
					? null
					: { currentBalance: options.currentBalance ?? 0 },
		},
		investment: {
			findFirst: async () => null,
		},
		realEstateInvestment: {
			findFirst: async () => null,
		},
		balanceSnapshot: {
			findMany: async () => options.snapshots ?? [],
		},
	};
}

describe("getAssetHistory", () => {
	it("rolls snapshots to last value per month and appends current", async () => {
		const db = createMockDb({
			currentBalance: 150,
			snapshots: [
				{ date: new Date("2026-01-05T00:00:00.000Z"), balance: 100 },
				{ date: new Date("2026-01-20T00:00:00.000Z"), balance: 110 },
				{ date: new Date("2026-02-10T00:00:00.000Z"), balance: 120 },
			],
		});

		const result = await getAssetHistory(db as never, {
			userId: "user-1",
			source: "PLAID",
			sourceId: "acct-1",
			months: 24,
			now: new Date("2026-03-15T12:00:00"),
		});

		assert.ok(result);
		assert.equal(result.current, 150);
		assert.deepEqual(result.points, [
			{ month: "2026-01", total: 110 },
			{ month: "2026-02", total: 120 },
			{ month: "2026-03", total: 150 },
		]);
	});

	it("returns null when the asset does not exist", async () => {
		const db = createMockDb({ currentBalance: null });
		const result = await getAssetHistory(db as never, {
			userId: "user-1",
			source: "PLAID",
			sourceId: "missing",
		});
		assert.equal(result, null);
	});
});
