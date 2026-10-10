import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { addOneAnniversaryMonth } from "../scheduling/anniversary";
import {
	type AmortizationLiabilityInputs,
	isLiabilityAmortizationDue,
	planLiabilityAmortizationSteps,
	resolveRemainingTermMonths,
} from "./amortize-due";

function liability(
	overrides: Partial<AmortizationLiabilityInputs> = {},
): AmortizationLiabilityInputs {
	return {
		id: "liability-1",
		balance: 300_000,
		interestRate: 6.5,
		monthlyPayment: 2100,
		loanStartDate: "2023-05-15",
		loanTermYears: 30,
		autoUpdateBalance: true,
		lastBalanceAmortizedAt: undefined,
		nextBalanceAmortizationDueAt: "2026-08-15T00:00:00.000Z",
		...overrides,
	};
}

describe("resolveRemainingTermMonths", () => {
	it("prefers start date + term over payoffDate", () => {
		const now = new Date(Date.UTC(2026, 7, 15));
		const months = resolveRemainingTermMonths(
			liability({
				loanStartDate: "2023-05-15",
				loanTermYears: 30,
				payoffDate: "2030-01-01",
			}),
			now,
		);
		// 30y from May 2023 → May 2053; from Aug 2026 ≈ 321 months
		assert.equal(months, 321);
	});

	it("falls back to payoffDate when term missing", () => {
		const now = new Date(Date.UTC(2026, 7, 1));
		const months = resolveRemainingTermMonths(
			{
				balance: 10_000,
				interestRate: 5,
				monthlyPayment: 200,
				payoffDate: "2027-08-01",
			},
			now,
		);
		assert.equal(months, 12);
	});
});

describe("isLiabilityAmortizationDue / planLiabilityAmortizationSteps", () => {
	it("skips when auto-update is off", () => {
		const now = new Date(Date.UTC(2026, 7, 20));
		const item = liability({ autoUpdateBalance: false });
		assert.equal(isLiabilityAmortizationDue(item, now), false);
		assert.equal(planLiabilityAmortizationSteps(item, now).length, 0);
	});

	it("skips when monthly payment is zero", () => {
		const now = new Date(Date.UTC(2026, 7, 20));
		const item = liability({ monthlyPayment: 0 });
		assert.equal(isLiabilityAmortizationDue(item, now), false);
	});

	it("plans one month on anniversary and reduces balance", () => {
		const anchor = new Date(Date.UTC(2023, 4, 15));
		const due = addOneAnniversaryMonth(new Date(Date.UTC(2026, 6, 15)), anchor);
		const item = liability({
			nextBalanceAmortizationDueAt: due.toISOString(),
			lastBalanceAmortizedAt: "2026-07-15T00:00:00.000Z",
		});
		const now = due;
		const steps = planLiabilityAmortizationSteps(item, now);
		assert.equal(steps.length, 1);
		const step = steps.at(0);
		assert.ok(step);
		assert.ok(step.newBalance < item.balance);
		assert.equal(
			step.lastBalanceAmortizedAt.slice(0, 10),
			due.toISOString().slice(0, 10),
		);
	});

	it("clamps Jan 31 anniversary into February", () => {
		const item = liability({
			loanStartDate: "2026-01-31",
			lastBalanceAmortizedAt: "2026-01-31T00:00:00.000Z",
			nextBalanceAmortizationDueAt: "2026-02-28T00:00:00.000Z",
		});
		const steps = planLiabilityAmortizationSteps(
			item,
			new Date(Date.UTC(2026, 1, 28)),
		);
		assert.equal(steps.length, 1);
		const step = steps.at(0);
		assert.ok(step);
		assert.equal(step.periodEnd.toISOString().slice(0, 10), "2026-02-28");
	});
});
