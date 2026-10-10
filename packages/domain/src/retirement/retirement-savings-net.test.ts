import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { retirementSavingsNet } from "./retirement-savings-net";

describe("retirementSavingsNet", () => {
	it("strips investment yield and transfers from Insights net", () => {
		const result = retirementSavingsNet({
			netIncome: 72_878,
			incomeByCategory: [
				{ category: "Salary", total: 250_000 },
				{ category: "Investments", total: 18_000 },
				{ category: "Transfer", total: 4_000 },
			],
		});
		assert.equal(result.excludedInvestmentIncome, 22_000);
		assert.equal(result.savingsNet, 50_878);
	});

	it("leaves wage income alone", () => {
		const result = retirementSavingsNet({
			netIncome: 40_000,
			incomeByCategory: [{ category: "Salary", total: 90_000 }],
		});
		assert.equal(result.excludedInvestmentIncome, 0);
		assert.equal(result.savingsNet, 40_000);
	});
});
