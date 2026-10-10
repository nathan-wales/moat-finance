import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { createWhatIfStore, defaultWhatIfStore } from "./what-if-store";

describe("what-if store isolation", () => {
	it("gives spending mix a store instance that is not the page default", () => {
		const mixStore = createWhatIfStore("RetirementSpendingMix");
		assert.notEqual(mixStore, defaultWhatIfStore);
		mixStore.getState().initializeScenario({
			baselineItems: [
				{
					id: "kids",
					name: "Kids",
					type: "expense",
					monthlyAmount: 2_667,
					isBaseline: true,
				},
			],
			baselineIncome: 0,
			baselineExpenses: 2_667,
			baselineSavings: 0,
			baselineDebt: 0,
		});
		mixStore.getState().removeItem("kids");
		assert.equal(defaultWhatIfStore.getState().scenario, null);
		assert.equal(
			mixStore.getState().scenario?.adjustments.get("kids")?.isRemoved,
			true,
		);
	});
});
