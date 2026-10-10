import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TransactionsUpdateStatus } from "plaid";
import {
	assembleHistoricalImportStatus,
	coveredDaysFromOldest,
	summarizeHistoricalImportProbe,
	summarizeTransactionCoverage,
} from "./historical-import-status";

describe("summarizeHistoricalImportProbe", () => {
	it("keeps polling when Plaid has only finished the initial ~30 day window", () => {
		const summary = summarizeHistoricalImportProbe({
			transactions_update_status:
				TransactionsUpdateStatus.InitialUpdateComplete,
			has_more: false,
			added: [],
			modified: [],
			removed: [],
		});
		assert.equal(summary.historicalImportComplete, false);
		assert.equal(summary.shouldDrain, false);
		assert.equal(summary.pendingUpdates, false);
		assert.equal(summary.updateStatus, "INITIAL_UPDATE_COMPLETE");
	});

	it("drains pending pages even before historical complete", () => {
		const summary = summarizeHistoricalImportProbe({
			transactions_update_status:
				TransactionsUpdateStatus.InitialUpdateComplete,
			has_more: true,
			added: [{ id: "tx-1" }],
			modified: [],
			removed: [],
		});
		assert.equal(summary.historicalImportComplete, false);
		assert.equal(summary.shouldDrain, true);
		assert.equal(summary.pendingUpdates, true);
	});

	it("treats an empty HISTORICAL_UPDATE_COMPLETE probe as done without draining", () => {
		const summary = summarizeHistoricalImportProbe({
			transactions_update_status:
				TransactionsUpdateStatus.HistoricalUpdateComplete,
			has_more: false,
			added: [],
			modified: [],
			removed: [],
		});
		assert.equal(summary.historicalImportComplete, true);
		assert.equal(summary.shouldDrain, false);
		assert.equal(summary.pendingUpdates, false);
	});

	it("stays incomplete when historical complete still has unread pages", () => {
		const summary = summarizeHistoricalImportProbe({
			transactions_update_status:
				TransactionsUpdateStatus.HistoricalUpdateComplete,
			has_more: true,
			added: [{ id: "tx-1" }],
			modified: [],
			removed: [],
		});
		assert.equal(summary.historicalImportComplete, false);
		assert.equal(summary.shouldDrain, true);
		assert.equal(summary.pendingUpdates, true);
		assert.equal(summary.probeAddedCount, 1);
		assert.equal(summary.hasMore, true);
	});
});

describe("summarizeTransactionCoverage", () => {
	it("counts inclusive UTC days from the oldest posted date", () => {
		const coverage = summarizeTransactionCoverage({
			transactionCount: 12,
			oldestTransactionDate: new Date("2026-03-21T15:00:00.000Z"),
			now: new Date("2026-09-21T08:00:00.000Z"),
			daysRequested: 365,
		});
		assert.equal(coverage.oldestTransactionDate, "2026-03-21");
		assert.equal(coverage.coveredDays, 185);
		assert.equal(coverage.daysRequested, 365);
		assert.equal(coverage.transactionCount, 12);
	});

	it("caps coverage at daysRequested", () => {
		const coverage = summarizeTransactionCoverage({
			transactionCount: 400,
			oldestTransactionDate: new Date("2024-01-01T00:00:00.000Z"),
			now: new Date("2026-09-21T00:00:00.000Z"),
			daysRequested: 365,
		});
		assert.equal(coverage.coveredDays, 365);
	});

	it("returns zero coverage when there are no transactions", () => {
		const coverage = summarizeTransactionCoverage({
			transactionCount: 0,
			oldestTransactionDate: null,
			now: new Date("2026-09-21T00:00:00.000Z"),
		});
		assert.equal(coverage.coveredDays, 0);
		assert.equal(coverage.oldestTransactionDate, null);
	});
});

describe("coveredDaysFromOldest", () => {
	it("treats the same UTC day as one covered day", () => {
		assert.equal(
			coveredDaysFromOldest(
				new Date("2026-09-21T23:00:00.000Z"),
				new Date("2026-09-21T01:00:00.000Z"),
			),
			1,
		);
	});
});

describe("assembleHistoricalImportStatus", () => {
	const coverage = {
		transactionCount: 10,
		oldestTransactionDate: "2026-01-01",
		coveredDays: 264,
		daysRequested: 365,
	};

	it("reports complete once an empty probe lands on HISTORICAL_UPDATE_COMPLETE", () => {
		const status = assembleHistoricalImportStatus({
			summary: summarizeHistoricalImportProbe({
				transactions_update_status:
					TransactionsUpdateStatus.HistoricalUpdateComplete,
				has_more: false,
				added: [],
				modified: [],
				removed: [],
			}),
			coverage,
		});
		assert.equal(status.historicalImportComplete, true);
		assert.equal(status.pendingUpdates, false);
		assert.equal(status.coveredDays, 264);
	});

	it("stays incomplete while the post-drain probe still has pages", () => {
		const status = assembleHistoricalImportStatus({
			summary: summarizeHistoricalImportProbe({
				transactions_update_status:
					TransactionsUpdateStatus.HistoricalUpdateComplete,
				has_more: true,
				added: [],
				modified: [],
				removed: [],
			}),
			coverage,
		});
		assert.equal(status.historicalImportComplete, false);
		assert.equal(status.pendingUpdates, true);
	});
});
