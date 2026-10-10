import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	emptyTransactionSummary,
	summarizeTransactions,
} from "./summarize-transactions";

describe("summarizeTransactions", () => {
	it("returns empty totals for no rows", () => {
		assert.deepEqual(summarizeTransactions([]), emptyTransactionSummary());
	});

	it("aggregates income, expenses, extremes, and dates", () => {
		const summary = summarizeTransactions([
			{
				id: "exp-large",
				amount: 120,
				type: "EXPENSE",
				date: "2025-04-04T00:00:00.000Z",
			},
			{
				id: "inc-first",
				amount: 80,
				type: "INCOME",
				date: "2025-01-15T00:00:00.000Z",
			},
			{
				id: "exp-last",
				amount: 40,
				type: "EXPENSE",
				date: "2025-12-11T00:00:00.000Z",
			},
		]);

		assert.equal(summary.totalIncome, 80);
		assert.equal(summary.incomeCount, 1);
		assert.equal(summary.totalExpenses, 160);
		assert.equal(summary.expenseCount, 2);
		assert.equal(summary.netGain, -80);
		assert.equal(summary.transactionCount, 3);
		assert.equal(summary.largestTransaction, 120);
		assert.equal(summary.largestTransactionId, "exp-large");
		assert.equal(summary.largestExpense, 120);
		assert.equal(summary.largestExpenseId, "exp-large");
		assert.equal(summary.averageTransaction, 80);
		assert.equal(summary.firstTransactionDate, "2025-01-15T00:00:00.000Z");
		assert.equal(summary.firstTransactionId, "inc-first");
		assert.equal(summary.lastTransactionDate, "2025-12-11T00:00:00.000Z");
		assert.equal(summary.lastTransactionId, "exp-last");
	});
});
