import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	chunkArray,
	DESKTOP_SYNC_WRITE_CHUNK_SIZE,
	externalIdsNeedingPrefetch,
	removedTransactionIds,
} from "./sync-transaction-write-helpers";

describe("desktop sync write helpers", () => {
	it("chunks at the API-matching size of 100", () => {
		assert.equal(DESKTOP_SYNC_WRITE_CHUNK_SIZE, 100);
		const values = Array.from({ length: 250 }, (_, index) => index);
		const chunks = chunkArray(values, DESKTOP_SYNC_WRITE_CHUNK_SIZE);
		assert.equal(chunks.length, 3);
		assert.equal(chunks[0]?.length, 100);
		assert.equal(chunks[1]?.length, 100);
		assert.equal(chunks[2]?.length, 50);
	});

	it("returns a single empty chunk for an empty list so the final persist still runs", () => {
		assert.deepEqual(chunkArray([], 100), [[]]);
	});

	it("prefetches every row so upserts can preserve existing categorization", () => {
		const entries = [
			{ kind: "added" as const, transactionId: "tx-1" },
			{ kind: "added" as const, transactionId: "tx-2" },
			{ kind: "modified" as const, transactionId: "tx-3" },
		];
		assert.deepEqual(externalIdsNeedingPrefetch(entries), [
			"tx-1",
			"tx-2",
			"tx-3",
		]);
	});

	it("batches removed transaction ids", () => {
		assert.deepEqual(
			removedTransactionIds([
				{ transaction_id: "a" },
				{ transaction_id: null },
				{},
				{ transaction_id: "b" },
			]),
			["a", "b"],
		);
	});
});
