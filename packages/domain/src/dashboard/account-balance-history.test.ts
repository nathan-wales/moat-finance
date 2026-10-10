import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	computeAccountHistoryDelta,
	filterAccountHistoryPoints,
	resolveAccountHistorySource,
	resolveAccountHistorySourceCandidates,
} from "./account-balance-history";

describe("resolveAccountHistorySource", () => {
	it("resolves plaid and investment prefixes", () => {
		assert.deepEqual(resolveAccountHistorySource("plaid-abc"), {
			source: "PLAID",
			sourceId: "abc",
		});
		assert.deepEqual(resolveAccountHistorySource("investment-acct-xyz"), {
			source: "INVESTMENT",
			sourceId: "xyz",
		});
		assert.deepEqual(resolveAccountHistorySource("apple-row-1"), {
			source: "PLAID",
			sourceId: "apple-row-1",
		});
	});
});

describe("resolveAccountHistorySourceCandidates", () => {
	it("tries Plaid before Apple for unprefixed ids", () => {
		assert.deepEqual(resolveAccountHistorySourceCandidates("acct_123"), [
			{ source: "PLAID", sourceId: "acct_123" },
			{ source: "APPLE_FINANCEKIT", sourceId: "acct_123" },
		]);
	});

	it("keeps prefixed ids unambiguous", () => {
		assert.deepEqual(resolveAccountHistorySourceCandidates("plaid-abc"), [
			{ source: "PLAID", sourceId: "abc" },
		]);
		assert.deepEqual(
			resolveAccountHistorySourceCandidates("investment-acct-xyz"),
			[{ source: "INVESTMENT", sourceId: "xyz" }],
		);
	});
});

describe("filterAccountHistoryPoints", () => {
	const points = [
		{ date: "2026-01-01", balance: 100 },
		{ date: "2026-01-02", balance: 110 },
		{ date: "2026-02-01", balance: 120 },
		{ date: "2026-08-17", balance: 150 },
	];

	it("returns last two points for 1D", () => {
		const filtered = filterAccountHistoryPoints(points, "1D");
		assert.equal(filtered.length, 2);
		assert.equal(filtered[0]?.date, "2026-02-01");
		assert.equal(filtered[1]?.date, "2026-08-17");
	});

	it("returns all for ALL", () => {
		assert.equal(filterAccountHistoryPoints(points, "ALL").length, 4);
	});
});

describe("computeAccountHistoryDelta", () => {
	it("computes absolute and percent change", () => {
		const delta = computeAccountHistoryDelta([
			{ date: "2026-01-01", balance: 100 },
			{ date: "2026-01-02", balance: 110 },
		]);
		assert.equal(delta.absolute, 10);
		assert.equal(delta.percent, 10);
	});
});
