import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { IncomeAdjustment, IncomeGap } from "../types";
import { calculateCashFlowLeftover } from "./leftover";
import { calculateWages } from "./wages";

describe("calculateCashFlowLeftover", () => {
	it("is cashIn minus cashOut minus tax, signed", () => {
		assert.equal(
			calculateCashFlowLeftover({
				cashIn: 10_000,
				cashOut: 156_288,
				cashFlowTax: 0,
			}),
			-146_288,
		);
	});
});

describe("calculateWages", () => {
	const working = {
		age: 64,
		spouseAge: null as number | null,
		spouseAlive: false,
		salaryFactor: 1,
		inflationFactor: 1,
		annualEmploymentIncome: 100_000,
		annualSpouseEmploymentIncome: 0,
		employmentEndsAtAge: 65,
		spouseEmploymentEndsAtAge: null as number | null,
		incomeAdjustments: [] as IncomeAdjustment[],
		incomeGaps: [] as IncomeGap[],
	};

	it("stops a dollar raise when the job it modifies ends", () => {
		const adjustments: IncomeAdjustment[] = [
			{
				whom: "primary",
				fromAge: 60,
				toAge: null,
				annualDelta: 10_000,
				percentDelta: 0,
				setTo: null,
			},
		];
		const at64 = calculateWages({ ...working, incomeAdjustments: adjustments });
		const at66 = calculateWages({
			...working,
			age: 66,
			incomeAdjustments: adjustments,
		});
		assert.equal(at64.employmentIncome, 110_000);
		assert.equal(at66.employmentIncome, 0);
	});

	it("stops a stated salary when the job it modifies ends", () => {
		const adjustments: IncomeAdjustment[] = [
			{
				whom: "primary",
				fromAge: 60,
				toAge: null,
				annualDelta: 0,
				percentDelta: 0,
				setTo: 40_000,
			},
		];
		const at64 = calculateWages({ ...working, incomeAdjustments: adjustments });
		const at66 = calculateWages({
			...working,
			age: 66,
			incomeAdjustments: adjustments,
		});
		assert.equal(at64.employmentIncome, 40_000);
		assert.equal(at66.employmentIncome, 0);
	});
});
