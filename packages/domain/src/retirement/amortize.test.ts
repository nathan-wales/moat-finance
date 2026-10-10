import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	amortizeMonth,
	amortizeYear,
	remainingTermMonthsFromPayment,
} from "./amortize";

describe("amortizeMonth", () => {
	it("zeros the balance on the last remaining month", () => {
		const result = amortizeMonth({
			balance: 8_400,
			annualInterestRate: 0.06,
			monthlyPayment: 400,
			remainingTermMonths: 1,
		});
		assert.equal(result.balance, 0);
		assert.equal(result.remainingTermMonths, 0);
	});

	it("pays equal principal when the term is known but payment is missing", () => {
		const result = amortizeMonth({
			balance: 12_000,
			annualInterestRate: 0.05,
			monthlyPayment: 0,
			remainingTermMonths: 12,
		});
		assert.equal(result.balance, 11_000);
		assert.equal(result.remainingTermMonths, 11);
	});

	it("leaves revolving debt unchanged when there is no payment or term", () => {
		const result = amortizeMonth({
			balance: 9_000,
			annualInterestRate: 0.22,
			monthlyPayment: 0,
			remainingTermMonths: 0,
		});
		assert.equal(result.balance, 9_000);
		assert.equal(result.remainingTermMonths, 0);
	});

	it("applies principal after interest when a payment is set", () => {
		const result = amortizeMonth({
			balance: 10_000,
			annualInterestRate: 0.12,
			monthlyPayment: 200,
			remainingTermMonths: 60,
		});
		assert.ok(result.balance < 10_000);
		assert.equal(result.remainingTermMonths, 59);
		assert.equal(Math.round((10_000 - result.balance) * 100) / 100, 100);
	});
});

describe("amortizeYear", () => {
	it("counts twelve payments while the loan outlives the year", () => {
		const result = amortizeYear({
			balance: 24_000,
			annualInterestRate: 0,
			monthlyPayment: 500,
			remainingTermMonths: 48,
		});
		assert.equal(result.monthsPaid, 12);
		assert.equal(result.balance, 18_000);
		assert.equal(result.remainingTermMonths, 36);
	});

	it("counts only the payments left in the payoff year", () => {
		const result = amortizeYear({
			balance: 3_500,
			annualInterestRate: 0,
			monthlyPayment: 500,
			remainingTermMonths: 7,
		});
		assert.equal(result.monthsPaid, 7);
		assert.equal(result.balance, 0);
		assert.equal(result.remainingTermMonths, 0);
	});

	it("charges nothing against a loan that is already retired", () => {
		const result = amortizeYear({
			balance: 0,
			annualInterestRate: 0.06,
			monthlyPayment: 500,
			remainingTermMonths: 12,
		});
		assert.equal(result.monthsPaid, 0);
		assert.equal(result.balance, 0);
	});
});

describe("remainingTermMonthsFromPayment", () => {
	it("returns zero when the payment cannot cover interest", () => {
		assert.equal(remainingTermMonthsFromPayment(20_000, 50, 0.2), 0);
	});

	it("solves a standard amortizing term", () => {
		const months = remainingTermMonthsFromPayment(20_000, 400, 0.06);
		assert.ok(months > 50);
		assert.ok(months < 60);
	});
});
