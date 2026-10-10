import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildTransactionSyncAudit,
	unexplainedTransactionCount,
} from "./transaction-sync-audit";

describe("transaction-sync-audit identity", () => {
	it("is zero when received rows are fully accounted for", () => {
		assert.equal(
			unexplainedTransactionCount({
				receivedFromPlaid: 8,
				persistedNew: 5,
				persistedUpdated: 1,
				reconnectOverlapSkipped: 1,
				disabledAccountSkipped: 1,
				markedRemoved: 0,
				removedNoOp: 0,
			}),
			0,
		);
	});

	it("fills unexplained on the constructed audit", () => {
		const audit = buildTransactionSyncAudit({
			receivedFromPlaid: 3,
			added: 2,
			modified: 0,
			removed: 1,
			persistedNew: 2,
			persistedUpdated: 0,
			reconnectOverlapSkipped: 0,
			disabledAccountSkipped: 0,
			markedRemoved: 1,
			removedNoOp: 0,
			seededCategories: 2,
			rulesApplied: 0,
			transferPairsCreated: 0,
			transferPairsRemoved: 0,
		});
		assert.equal(audit.unexplained, 0);
	});
});
