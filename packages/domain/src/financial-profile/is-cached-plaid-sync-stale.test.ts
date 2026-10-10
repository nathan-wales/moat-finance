import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	CACHED_PLAID_SYNC_STALE_MS,
	isCachedPlaidItemStale,
} from "./is-cached-plaid-sync-stale";

const NOW_MS = Date.parse("2026-08-25T19:00:00.000Z");

function minutesAgo(minutes: number): Date {
	return new Date(NOW_MS - minutes * 60_000);
}

describe("isCachedPlaidItemStale", () => {
	it("treats a never-synced item as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: null,
				accountLastBalanceSyncAts: [minutesAgo(1)],
				nowMs: NOW_MS,
			}),
			true,
		);
	});

	it("treats an item with no accounts as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: minutesAgo(1),
				accountLastBalanceSyncAts: [],
				nowMs: NOW_MS,
			}),
			true,
		);
	});

	it("treats a 31-minute-old transaction sync as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: minutesAgo(31),
				accountLastBalanceSyncAts: [minutesAgo(1)],
				nowMs: NOW_MS,
			}),
			true,
		);
	});

	it("treats a fresh transaction sync with a stale balance as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: minutesAgo(1),
				accountLastBalanceSyncAts: [minutesAgo(1), minutesAgo(48 * 60)],
				nowMs: NOW_MS,
			}),
			true,
		);
	});

	it("does not treat a 29-minute-old item as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: minutesAgo(29),
				accountLastBalanceSyncAts: [minutesAgo(29)],
				nowMs: NOW_MS,
			}),
			false,
		);
	});

	it("does not treat an item synced exactly at the threshold as stale", () => {
		assert.equal(
			isCachedPlaidItemStale({
				lastSuccessfulSyncAt: new Date(NOW_MS - CACHED_PLAID_SYNC_STALE_MS),
				accountLastBalanceSyncAts: [
					new Date(NOW_MS - CACHED_PLAID_SYNC_STALE_MS),
				],
				nowMs: NOW_MS,
			}),
			false,
		);
	});
});
