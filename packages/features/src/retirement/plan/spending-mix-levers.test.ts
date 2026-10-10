import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { WhatIfScenario } from "../../what-if/calculator";
import {
	compileSpendingMixLevers,
	nextSpendingMixLevers,
	rehydrateSpendingMixAdjustments,
	spendingMixHasUnsavedEdits,
	spendingMixMatchKey,
} from "./spending-mix-levers";

const kids = {
	id: "cat-kids",
	name: "Kids",
	type: "expense" as const,
	monthlyAmount: 2_667,
	category: "Kids",
	isBaseline: true,
};

const groceries = {
	id: "cat-groceries",
	name: "Groceries",
	type: "expense" as const,
	monthlyAmount: 400,
	category: "Groceries",
	isBaseline: true,
};

function scenario(adjustments: WhatIfScenario["adjustments"]): WhatIfScenario {
	return {
		baselineIncome: 3_711,
		baselineExpenses: 5_292,
		baselineSavings: 0,
		baselineDebt: 0,
		baselineItems: [kids, groceries],
		adjustments,
	};
}

describe("spending mix levers", () => {
	it("compiles a removed category into a negative expense lever", () => {
		const levers = compileSpendingMixLevers(
			scenario(new Map([[kids.id, { itemId: kids.id, isRemoved: true }]])),
		);
		assert.equal(levers.length, 1);
		assert.equal(levers[0]?.params.label, "Kids");
		assert.equal(levers[0]?.params.lineItemType, "expense");
		assert.equal(levers[0]?.params.monthlyDelta, -2_667);
		assert.equal(levers[0]?.params.matchKey, "expense:Kids");
		assert.equal(levers[0]?.params.isRemoved, true);
	});

	it("round-trips a Kids removal onto a fresh baseline", () => {
		const compiled = compileSpendingMixLevers(
			scenario(new Map([[kids.id, { itemId: kids.id, isRemoved: true }]])),
		);
		const restored = rehydrateSpendingMixAdjustments(
			[kids, groceries],
			compiled,
		);
		assert.equal(restored.get(kids.id)?.isRemoved, true);
		assert.equal(restored.has(groceries.id), false);
	});

	it("round-trips a new expense and an edited amount", () => {
		const compiled = compileSpendingMixLevers(
			scenario(
				new Map([
					[
						"temp-1",
						{
							itemId: "temp-1",
							isNew: true,
							newItem: {
								name: "Nanny",
								type: "expense",
								monthlyAmount: 1_200,
								isBaseline: false,
							},
						},
					],
					[
						groceries.id,
						{
							itemId: groceries.id,
							newMonthlyAmount: 250,
							isNew: false,
						},
					],
				]),
			),
		);
		assert.equal(compiled.length, 2);
		const restored = rehydrateSpendingMixAdjustments(
			[kids, groceries],
			compiled,
		);
		assert.equal(restored.get(groceries.id)?.newMonthlyAmount, 250);
		const added = [...restored.values()].find((entry) => entry.isNew);
		assert.equal(added?.newItem?.name, "Nanny");
		assert.equal(added?.newItem?.monthlyAmount, 1_200);
	});

	it("treats a rehydrated mix as having no unsaved edits", () => {
		const compiled = compileSpendingMixLevers(
			scenario(new Map([[kids.id, { itemId: kids.id, isRemoved: true }]])),
		);
		const adjustments = rehydrateSpendingMixAdjustments(
			[kids, groceries],
			compiled,
		);
		assert.equal(
			spendingMixHasUnsavedEdits(
				scenario(adjustments),
				compiled.map((lever) => ({ lever, enabled: true })),
			),
			false,
		);
	});

	it("uses type and category for the match key", () => {
		assert.equal(spendingMixMatchKey(kids), "expense:Kids");
		assert.equal(
			spendingMixMatchKey({ type: "expense", name: "Nanny", isNew: true }),
			"expense:new:Nanny",
		);
	});

	it("keeps disabled and unmatched mix levers when compiling an empty calculator", () => {
		const kidsLever = compileSpendingMixLevers(
			scenario(new Map([[kids.id, { itemId: kids.id, isRemoved: true }]])),
		)[0];
		assert.ok(kidsLever);
		const next = nextSpendingMixLevers({
			draft: [
				{ lever: kidsLever, enabled: false },
				{
					lever: {
						type: "spending_category_change",
						params: {
							label: "Daycare",
							lineItemType: "expense",
							monthlyDelta: -800,
							matchKey: "expense:Daycare",
							isRemoved: true,
							isNew: false,
						},
					},
					enabled: true,
				},
			],
			compiled: [],
			baselineItems: [kids, groceries],
		});
		assert.equal(next.length, 2);
		assert.equal(next[0]?.enabled, false);
		assert.equal(next[0]?.lever.params.matchKey, "expense:Kids");
		assert.equal(next[1]?.lever.params.matchKey, "expense:Daycare");
		assert.equal(
			spendingMixHasUnsavedEdits(scenario(new Map()), [
				{ lever: kidsLever, enabled: false },
			]),
			false,
		);
	});
});
