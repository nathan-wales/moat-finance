import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildTransactionSyncAudit,
	unexplainedTransactionCount,
} from "./audit";

describe("transaction sync audit identity", () => {
	it("is zero when every received row is accounted for", () => {
		assert.equal(
			unexplainedTransactionCount({
				receivedFromPlaid: 10,
				persistedNew: 6,
				persistedUpdated: 2,
				reconnectOverlapSkipped: 1,
				disabledAccountSkipped: 1,
				markedRemoved: 0,
				removedNoOp: 0,
			}),
			0,
		);
	});

	it("counts leftover received rows as unexplained", () => {
		assert.equal(
			unexplainedTransactionCount({
				receivedFromPlaid: 5,
				persistedNew: 4,
				persistedUpdated: 0,
				reconnectOverlapSkipped: 0,
				disabledAccountSkipped: 0,
				markedRemoved: 0,
				removedNoOp: 0,
			}),
			1,
		);
	});

	it("treats a duplicate removed id as removedNoOp", () => {
		const audit = buildTransactionSyncAudit({
			receivedFromPlaid: 2,
			added: 0,
			modified: 0,
			removed: 2,
			persistedNew: 0,
			persistedUpdated: 0,
			reconnectOverlapSkipped: 0,
			disabledAccountSkipped: 0,
			markedRemoved: 1,
			removedNoOp: 1,
			seededCategories: 0,
			rulesApplied: 0,
			transferPairsCreated: 0,
			transferPairsRemoved: 0,
		});
		assert.equal(audit.unexplained, 0);
	});
});
