import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { describe, it } from "node:test";
import { fileURLToPath } from "node:url";
import type { SqliteDbClient } from "@moat/db-sqlite";
import { emptyTransactionSyncAudit } from "@moat/domain";
import {
	HISTORICAL_CATCH_UP_RETRY_DELAYS_MS,
	isTransactionsProductNotReady,
	nextHistoricalCatchUpState,
	retryInitialTransactionSyncUntilReady,
} from "./initial-sync-retry";
import type { SyncTransactionsResult } from "./sync-transactions";

function result(
	overrides: Partial<SyncTransactionsResult> = {},
): SyncTransactionsResult {
	return {
		addedCount: 0,
		modifiedCount: 0,
		removedCount: 0,
		nextCursor: null,
		skippedHistoricalCount: 0,
		skippedDisabledAccountCount: 0,
		reconnectOverlapSkipped: 0,
		audit: emptyTransactionSyncAudit(),
		...overrides,
	};
}

describe("isTransactionsProductNotReady", () => {
	it("is true only when Plaid returned nothing and no cursor", () => {
		assert.equal(isTransactionsProductNotReady(result()), true);
		assert.equal(
			isTransactionsProductNotReady(result({ nextCursor: "cur-1" })),
			false,
		);
		assert.equal(
			isTransactionsProductNotReady(result({ addedCount: 4, nextCursor: "c" })),
			false,
		);
	});
});

describe("nextHistoricalCatchUpState", () => {
	it("keeps polling empty pages until a post-ready add is seen", () => {
		assert.deepEqual(
			nextHistoricalCatchUpState({ sawPostReadyAdds: false, addedCount: 0 }),
			{ sawPostReadyAdds: false, done: false },
		);
	});

	it("continues after historical adds arrive", () => {
		assert.deepEqual(
			nextHistoricalCatchUpState({ sawPostReadyAdds: false, addedCount: 12 }),
			{ sawPostReadyAdds: true, done: false },
		);
	});

	it("stops once a later page is empty after historical adds", () => {
		assert.deepEqual(
			nextHistoricalCatchUpState({ sawPostReadyAdds: true, addedCount: 0 }),
			{ sawPostReadyAdds: true, done: true },
		);
	});

	it("treats leftover overlap skips as a historical page, then stops on empty", () => {
		assert.deepEqual(
			nextHistoricalCatchUpState({
				sawPostReadyAdds: false,
				addedCount: 0,
				skippedHistoricalCount: 406,
			}),
			{ sawPostReadyAdds: true, done: false },
		);
		assert.deepEqual(
			nextHistoricalCatchUpState({
				sawPostReadyAdds: true,
				addedCount: 0,
				skippedHistoricalCount: 0,
			}),
			{ sawPostReadyAdds: true, done: true },
		);
	});
});

describe("retryInitialTransactionSyncUntilReady", () => {
	const db = {} as SqliteDbClient;

	it("polls until the product is ready, then until historical catch-up drains", async () => {
		const syncResults = [
			result(),
			result({ addedCount: 8, nextCursor: "c1" }),
			result({ addedCount: 40, nextCursor: "c2" }),
			result({ addedCount: 0, nextCursor: "c3" }),
		];
		const sleeps: number[] = [];

		const last = await retryInitialTransactionSyncUntilReady({
			userId: "user-1",
			plaidItemDbId: "item-1",
			db,
			deps: {
				sleep: async (ms) => {
					sleeps.push(ms);
				},
				productNotReadyDelays: [1, 2],
				historicalCatchUpDelays: [3, 4, 5],
				sync: async () => {
					const next = syncResults.shift();
					assert.ok(next);
					return next;
				},
			},
		});

		assert.deepEqual(last, result({ addedCount: 0, nextCursor: "c3" }));
		assert.deepEqual(sleeps, [1, 2, 3, 4]);
		assert.equal(syncResults.length, 0);
	});

	it("skips product-not-ready delays when the first page already has data", async () => {
		const syncResults = [
			result({ addedCount: 20, nextCursor: "hist" }),
			result({ addedCount: 0, nextCursor: "done" }),
		];
		const sleeps: number[] = [];

		const last = await retryInitialTransactionSyncUntilReady({
			userId: "user-1",
			plaidItemDbId: "item-1",
			db,
			lastResult: result({ addedCount: 30, nextCursor: "init" }),
			deps: {
				sleep: async (ms) => {
					sleeps.push(ms);
				},
				productNotReadyDelays: [99],
				historicalCatchUpDelays: [3, 4],
				sync: async () => {
					const next = syncResults.shift();
					assert.ok(next);
					return next;
				},
			},
		});

		assert.deepEqual(last, result({ addedCount: 0, nextCursor: "done" }));
		assert.deepEqual(sleeps, [3, 4]);
	});

	it("stops catch-up on the first empty page when the initial sync already had history", async () => {
		let syncCount = 0;
		const sleeps: number[] = [];

		const last = await retryInitialTransactionSyncUntilReady({
			userId: "user-1",
			plaidItemDbId: "item-1",
			db,
			lastResult: result({ addedCount: 30, nextCursor: "init" }),
			deps: {
				sleep: async (ms) => {
					sleeps.push(ms);
				},
				historicalCatchUpDelays: [3, 4, 5],
				sync: async () => {
					syncCount += 1;
					return result({ addedCount: 0, nextCursor: "done" });
				},
			},
		});

		assert.equal(syncCount, 1);
		assert.deepEqual(sleeps, [3]);
		assert.deepEqual(last, result({ addedCount: 0, nextCursor: "done" }));
	});

	it("stops historical catch-up after overlap skips then an empty page", async () => {
		const syncResults = [
			result({ skippedHistoricalCount: 406, nextCursor: "hist" }),
			result({ nextCursor: "done" }),
			result({ nextCursor: "should-not-run" }),
		];
		const sleeps: number[] = [];

		const last = await retryInitialTransactionSyncUntilReady({
			userId: "user-1",
			plaidItemDbId: "item-1",
			db,
			lastResult: result({ skippedHistoricalCount: 36, nextCursor: "init" }),
			deps: {
				sleep: async (ms) => {
					sleeps.push(ms);
				},
				historicalCatchUpDelays: [3, 4, 5],
				sync: async () => {
					const next = syncResults.shift();
					assert.ok(next);
					return next;
				},
			},
		});

		assert.deepEqual(last, result({ nextCursor: "done" }));
		assert.deepEqual(sleeps, [3, 4]);
		assert.equal(syncResults.length, 1);
	});

	it("exhausts the historical budget when leftover skip yields empty pages", async () => {
		let syncCount = 0;
		const last = await retryInitialTransactionSyncUntilReady({
			userId: "user-1",
			plaidItemDbId: "item-1",
			db,
			lastResult: result({ addedCount: 0, nextCursor: "c1" }),
			deps: {
				sleep: async () => {},
				historicalCatchUpDelays: [1, 1, 1],
				sync: async () => {
					syncCount += 1;
					return result({ addedCount: 0, nextCursor: "c1" });
				},
			},
		});

		assert.equal(syncCount, 3);
		assert.deepEqual(last, result({ addedCount: 0, nextCursor: "c1" }));
	});

	it("historical catch-up delays total about ten minutes", () => {
		const total = HISTORICAL_CATCH_UP_RETRY_DELAYS_MS.reduce(
			(sum, delay) => sum + delay,
			0,
		);
		assert.equal(total, 600_000);
	});
});

describe("PLAID_CATCH_UP_DELAYS_MS seam", () => {
	it("reads optional comma-separated delays without changing production defaults", () => {
		const retrySource = readFileSync(
			join(dirname(fileURLToPath(import.meta.url)), "initial-sync-retry.ts"),
			"utf8",
		);
		assert.match(
			retrySource,
			/delaysFromNamedEnv\("PLAID_CATCH_UP_DELAYS_MS"\)/,
		);
		assert.match(
			retrySource,
			/delaysFromNamedEnv\("PLAID_HISTORICAL_CATCH_UP_DELAYS_MS"\)/,
		);
		assert.match(
			retrySource,
			/params\.deps\?\.productNotReadyDelays \?\?[\s\S]*delaysFromEnv\(\) \?\?[\s\S]*PRODUCT_NOT_READY_RETRY_DELAYS_MS/,
		);
		assert.match(
			retrySource,
			/params\.deps\?\.historicalCatchUpDelays \?\?[\s\S]*historicalDelaysFromEnv\(\) \?\?[\s\S]*HISTORICAL_CATCH_UP_RETRY_DELAYS_MS/,
		);
	});
});
