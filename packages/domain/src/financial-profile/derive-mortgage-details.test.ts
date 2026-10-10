import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	applyDerivedMortgageDetailsIfEmpty,
	calcMonthlyPayment,
	deriveMortgageAdvancedDetails,
	monthsElapsedBetween,
	roundMortgageDollars,
} from "./derive-mortgage-details";

const RATE = 0.065;
const TERM_YEARS = 30;
const ORIGINAL_PRINCIPAL = 300_000;
const PURCHASE_PRICE = 380_000;

describe("monthsElapsedBetween", () => {
	it("counts whole calendar months and steps back when the day of month has not arrived", () => {
		assert.equal(
			monthsElapsedBetween(new Date(2023, 8, 15), new Date(2026, 8, 3)),
			35,
		);
		assert.equal(
			monthsElapsedBetween(new Date(2023, 8, 3), new Date(2026, 8, 3)),
			36,
		);
	});
});

describe("deriveMortgageAdvancedDetails", () => {
	it("fills remaining months, payment, and down payment for a brand-new loan", () => {
		const now = new Date(2026, 8, 3);
		const derived = deriveMortgageAdvancedDetails({
			annualInterestRate: RATE,
			currentLoanBalance: ORIGINAL_PRINCIPAL,
			loanTermYears: TERM_YEARS,
			now,
			purchaseDate: now,
			purchasePrice: PURCHASE_PRICE,
		});

		assert.equal(derived.remainingTermMonths, 360);
		const expectedPayment = calcMonthlyPayment(ORIGINAL_PRINCIPAL, RATE, 360);
		assert.ok(derived.monthlyMortgagePayment != null);
		assert.ok(
			Math.abs((derived.monthlyMortgagePayment ?? 0) - expectedPayment) < 0.01,
		);
		assert.ok(derived.downPayment != null);
		assert.ok(
			Math.abs(
				(derived.downPayment ?? 0) - (PURCHASE_PRICE - ORIGINAL_PRINCIPAL),
			) < 1,
		);
	});

	it("starts the remaining term from the first payment one month after purchase", () => {
		const derived = deriveMortgageAdvancedDetails({
			annualInterestRate: RATE,
			currentLoanBalance: 501_000,
			loanTermYears: TERM_YEARS,
			now: new Date(2026, 8, 4),
			purchaseDate: "2024-05-20",
			purchasePrice: 570_000,
		});
		assert.equal(derived.remainingTermMonths, 334);
		assert.ok(derived.monthlyMortgagePayment != null);
		assert.ok((derived.monthlyMortgagePayment ?? 0) > 3000);
		assert.ok(derived.downPayment != null);
		assert.ok((derived.downPayment ?? 0) > 50_000);
		assert.ok((derived.downPayment ?? 0) < 80_000);
	});

	it("reconstructs original principal after three years of scheduled paydown", () => {
		const now = new Date(2026, 8, 3);
		const purchaseDate = new Date(2023, 8, 3);
		const originalPayment = calcMonthlyPayment(ORIGINAL_PRINCIPAL, RATE, 360);
		const remainingMonths = 325;
		const remainingBalance = presentValueFromPayment(
			originalPayment,
			RATE,
			remainingMonths,
		);

		const derived = deriveMortgageAdvancedDetails({
			annualInterestRate: RATE,
			currentLoanBalance: remainingBalance,
			loanTermYears: TERM_YEARS,
			now,
			purchaseDate,
			purchasePrice: PURCHASE_PRICE,
		});

		assert.equal(derived.remainingTermMonths, remainingMonths);
		assert.ok(derived.monthlyMortgagePayment != null);
		assert.ok(
			Math.abs((derived.monthlyMortgagePayment ?? 0) - originalPayment) < 0.02,
		);
		assert.ok(derived.downPayment != null);
		assert.ok(
			Math.abs(
				(derived.downPayment ?? 0) - (PURCHASE_PRICE - ORIGINAL_PRINCIPAL),
			) < 2,
		);
		assert.ok(remainingBalance < ORIGINAL_PRINCIPAL);
	});

	it("does not invent remaining months without a purchase date", () => {
		const derived = deriveMortgageAdvancedDetails({
			annualInterestRate: RATE,
			currentLoanBalance: ORIGINAL_PRINCIPAL,
			loanTermYears: TERM_YEARS,
			purchasePrice: PURCHASE_PRICE,
		});
		assert.equal(derived.remainingTermMonths, null);
		assert.equal(derived.monthlyMortgagePayment, null);
		assert.equal(derived.downPayment, null);
	});

	it("skips down payment when remaining months is zero", () => {
		const now = new Date(2026, 8, 3);
		const derived = deriveMortgageAdvancedDetails({
			annualInterestRate: RATE,
			currentLoanBalance: 0,
			loanTermYears: TERM_YEARS,
			now,
			purchaseDate: new Date(1990, 0, 1),
			purchasePrice: PURCHASE_PRICE,
		});
		assert.equal(derived.remainingTermMonths, 0);
		assert.equal(derived.monthlyMortgagePayment, 0);
		assert.equal(derived.downPayment, null);
	});
});

describe("applyDerivedMortgageDetailsIfEmpty", () => {
	it("fills only missing advanced fields", () => {
		const derived = {
			downPayment: 80_000,
			monthlyMortgagePayment: 1_896,
			remainingTermMonths: 324,
		};
		const applied = applyDerivedMortgageDetailsIfEmpty(
			{
				downPayment: 75_000,
				monthlyMortgagePayment: null,
				remainingTermMonths: 300,
			},
			derived,
		);
		assert.equal(applied.downPayment, 75_000);
		assert.equal(applied.monthlyMortgagePayment, 1_896);
		assert.equal(applied.remainingTermMonths, 300);
	});

	it("does not overwrite a stored zero remaining term", () => {
		const applied = applyDerivedMortgageDetailsIfEmpty(
			{ remainingTermMonths: 0 },
			{
				downPayment: 80_000,
				monthlyMortgagePayment: 1_896,
				remainingTermMonths: 324,
			},
		);
		assert.equal(applied.remainingTermMonths, 0);
	});
});

describe("roundMortgageDollars", () => {
	it("rounds to the nearest dollar", () => {
		assert.equal(roundMortgageDollars(1896.4), 1896);
		assert.equal(roundMortgageDollars(1896.5), 1897);
	});
});

function presentValueFromPayment(
	payment: number,
	annualRate: number,
	termMonths: number,
): number {
	const monthlyRate = annualRate / 12;
	return (payment * (1 - (1 + monthlyRate) ** -termMonths)) / monthlyRate;
}
