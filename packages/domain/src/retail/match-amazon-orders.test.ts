import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { matchAmazonOrdersToTransactions } from "./match-amazon-orders";

describe("matchAmazonOrdersToTransactions", () => {
	it("links when a single Amazon expense matches order total in the date window", () => {
		const orderDate = new Date("2026-08-01T12:00:00.000Z");
		const summary = matchAmazonOrdersToTransactions({
			orders: [
				{
					id: "order-1",
					orderDate,
					total: 42.5,
					unlinkedItemIds: ["item-1", "item-2"],
				},
			],
			transactions: [
				{
					id: "tx-1",
					amount: -42.5,
					date: new Date("2026-08-02T12:00:00.000Z"),
					description: "AMAZON MKTPLACE PMTS",
					merchantName: null,
				},
			],
		});

		assert.equal(summary.linkedItems, 2);
		assert.equal(summary.decisions[0]?.status, "linked");
		if (summary.decisions[0]?.status === "linked") {
			assert.equal(summary.decisions[0].transactionId, "tx-1");
		}
	});

	it("marks unmatched when no candidate exists", () => {
		const summary = matchAmazonOrdersToTransactions({
			orders: [
				{
					id: "order-1",
					orderDate: new Date("2026-08-01T12:00:00.000Z"),
					total: 10,
					unlinkedItemIds: ["item-1"],
				},
			],
			transactions: [
				{
					id: "tx-1",
					amount: -99,
					date: new Date("2026-08-02T12:00:00.000Z"),
					description: "AMAZON MKTPLACE PMTS",
					merchantName: null,
				},
			],
		});

		assert.equal(summary.linkedItems, 0);
		assert.equal(summary.decisions[0]?.status, "unmatched");
	});

	it("marks ambiguous when multiple exact matches exist", () => {
		const orderDate = new Date("2026-08-01T12:00:00.000Z");
		const summary = matchAmazonOrdersToTransactions({
			orders: [
				{
					id: "order-1",
					orderDate,
					total: 20,
					unlinkedItemIds: ["item-1"],
				},
			],
			transactions: [
				{
					id: "tx-1",
					amount: -20,
					date: new Date("2026-08-02T12:00:00.000Z"),
					description: "Amazon.com",
					merchantName: null,
				},
				{
					id: "tx-2",
					amount: -20,
					date: new Date("2026-08-03T12:00:00.000Z"),
					description: "AMAZON MKTPL*",
					merchantName: null,
				},
			],
		});

		assert.equal(summary.decisions[0]?.status, "ambiguous");
		assert.equal(summary.skipped, 1);
	});
});
