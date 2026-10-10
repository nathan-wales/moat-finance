import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { Investment } from "@moat/data-access";
import {
	addOneAnniversaryMonth,
	anniversaryDateInMonth,
	applyOneMonthStep,
	computeNextAccrualDueAt,
	isAccrualDue,
	planCatchUpMonths,
} from "./accrual";
import { planAccrualSteps } from "./accrueDueManualInvestments";

function investment(
	overrides: Partial<Investment> & Pick<Investment, "createdAt">,
): Investment {
	const { createdAt, ...rest } = overrides;
	return {
		id: "inv-1",
		userId: "user-1",
		type: "OTHER",
		name: "my529",
		startingBalance: 5100,
		monthlyContribution: 50,
		annualReturnRate: 0.07,
		autoUpdateBalance: true,
		lastBalanceAccruedAt: null,
		nextBalanceAccrualDueAt: null,
		createdAt,
		updatedAt: createdAt,
		...rest,
	};
}

describe("anniversaryDateInMonth", () => {
	it("clamps Jan 31 into February", () => {
		const created = new Date(Date.UTC(2026, 0, 31));
		const feb = anniversaryDateInMonth(created, 2026, 1);
		assert.equal(feb.toISOString().slice(0, 10), "2026-02-28");
	});

	it("preserves day when month has that day", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const sep = anniversaryDateInMonth(created, 2026, 8);
		assert.equal(sep.toISOString().slice(0, 10), "2026-09-07");
	});
});

describe("applyOneMonthStep", () => {
	it("applies monthly return then contribution", () => {
		const step = applyOneMonthStep({
			balance: 5100,
			monthlyContribution: 50,
			annualReturnRate: 0.07,
		});
		const expectedReturn = 5100 * (0.07 / 12);
		assert.ok(Math.abs(step.returnApplied - expectedReturn) < 1e-9);
		assert.equal(step.contributionApplied, 50);
		assert.ok(
			Math.abs(step.newBalance - (5100 + expectedReturn + 50)) < 1e-9,
		);
	});
});

describe("isAccrualDue / planCatchUpMonths", () => {
	it("is not due before next anniversary", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const inv = investment({
			createdAt: created,
			nextBalanceAccrualDueAt: computeNextAccrualDueAt(created, null),
		});
		assert.equal(isAccrualDue(inv, new Date(Date.UTC(2026, 7, 20))), false);
	});

	it("is due on anniversary and plans one month", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const due = addOneAnniversaryMonth(created, created);
		const inv = investment({
			createdAt: created,
			nextBalanceAccrualDueAt: due,
		});
		const now = new Date(Date.UTC(2026, 8, 7));
		assert.equal(isAccrualDue(inv, now), true);
		const months = planCatchUpMonths(inv, now);
		assert.equal(months.length, 1);
		assert.equal(months[0]?.periodEnd.toISOString().slice(0, 10), "2026-09-07");
	});

	it("skips when autoUpdateBalance is false", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const inv = investment({
			createdAt: created,
			autoUpdateBalance: false,
			nextBalanceAccrualDueAt: addOneAnniversaryMonth(created, created),
		});
		assert.equal(isAccrualDue(inv, new Date(Date.UTC(2026, 8, 7))), false);
	});

	it("skips when contribution is zero even if return rate is set", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const inv = investment({
			createdAt: created,
			monthlyContribution: 0,
			annualReturnRate: 0.07,
			nextBalanceAccrualDueAt: addOneAnniversaryMonth(created, created),
		});
		assert.equal(isAccrualDue(inv, new Date(Date.UTC(2026, 8, 7))), false);
	});

	it("skips when contribution and return are zero", () => {
		const created = new Date(Date.UTC(2026, 7, 7));
		const inv = investment({
			createdAt: created,
			monthlyContribution: 0,
			annualReturnRate: 0,
			nextBalanceAccrualDueAt: addOneAnniversaryMonth(created, created),
		});
		assert.equal(isAccrualDue(inv, new Date(Date.UTC(2026, 8, 7))), false);
	});

	it("plans multi-month catch-up", () => {
		const created = new Date(Date.UTC(2026, 5, 7));
		const inv = investment({
			createdAt: created,
			nextBalanceAccrualDueAt: addOneAnniversaryMonth(created, created),
		});
		const now = new Date(Date.UTC(2026, 8, 7));
		const months = planCatchUpMonths(inv, now);
		assert.equal(months.length, 3);
	});
});

describe("planAccrualSteps", () => {
	it("compounds balance across catch-up months", () => {
		const created = new Date(Date.UTC(2026, 6, 7));
		const inv = investment({
			createdAt: created,
			startingBalance: 5100,
			nextBalanceAccrualDueAt: addOneAnniversaryMonth(created, created),
		});
		const steps = planAccrualSteps(inv, new Date(Date.UTC(2026, 8, 7)));
		assert.equal(steps.length, 2);
		assert.ok(steps[1]!.newBalance > steps[0]!.newBalance);
		assert.equal(steps[0]!.previousBalance, 5100);
		assert.equal(steps[1]!.previousBalance, steps[0]!.newBalance);
	});
});
