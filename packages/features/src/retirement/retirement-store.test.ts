import assert from "node:assert/strict";
import { beforeEach, describe, it } from "node:test";
import { useRetirementStore } from "./retirement-store";

function resetStore() {
	useRetirementStore.setState({
		draftLevers: [],
		savedScenarioId: null,
		isDirty: false,
		catalogDraft: null,
		catalogDraftNonce: 0,
	});
}

describe("useRetirementStore catalog draft", () => {
	beforeEach(() => {
		resetStore();
	});

	it("setCatalogDraft does not add a lever or mark dirty", () => {
		const before = useRetirementStore.getState().draftLevers.length;
		useRetirementStore.getState().setCatalogDraft({
			type: "retire_at_age",
			params: { age: 62 },
		});
		const state = useRetirementStore.getState();
		assert.equal(state.draftLevers.length, before);
		assert.equal(state.isDirty, false);
		assert.equal(state.catalogDraft?.type, "retire_at_age");
		assert.equal(state.catalogDraftNonce, 1);
	});

	it("setCatalogDraft(null) clears without bumping the nonce", () => {
		useRetirementStore.getState().setCatalogDraft({
			type: "retire_later",
			params: { years: 2 },
		});
		useRetirementStore.getState().setCatalogDraft(null);
		const state = useRetirementStore.getState();
		assert.equal(state.catalogDraft, null);
		assert.equal(state.catalogDraftNonce, 1);
	});

	it("addLever clears catalogDraft without adding a second silent lever", () => {
		useRetirementStore.getState().setCatalogDraft({
			type: "max_roth_ira",
			params: { includeCatchUp: true },
		});
		useRetirementStore.getState().addLever({
			type: "max_roth_ira",
			params: { includeCatchUp: true },
		});
		const state = useRetirementStore.getState();
		assert.equal(state.catalogDraft, null);
		assert.equal(state.draftLevers.length, 1);
		assert.equal(state.draftLevers[0]?.lever.type, "max_roth_ira");
		assert.equal(state.isDirty, true);
	});

	it("hydrateDraft and clearDraft also clear catalogDraft", () => {
		useRetirementStore.getState().setCatalogDraft({
			type: "retire_later",
			params: { years: 2 },
		});
		useRetirementStore.getState().hydrateDraft([]);
		assert.equal(useRetirementStore.getState().catalogDraft, null);

		useRetirementStore.getState().setCatalogDraft({
			type: "retire_later",
			params: { years: 2 },
		});
		useRetirementStore.getState().clearDraft();
		assert.equal(useRetirementStore.getState().catalogDraft, null);
	});
});

describe("replaceSpendingMixLevers", () => {
	beforeEach(() => {
		resetStore();
	});

	it("replaces mix levers without duplicating or dropping other levers", () => {
		useRetirementStore.getState().addLever({
			type: "spouse_stops_working",
			params: { atAge: 32 },
		});
		useRetirementStore.getState().replaceSpendingMixLevers([
			{
				lever: {
					type: "spending_category_change",
					params: {
						label: "Kids",
						lineItemType: "expense",
						monthlyDelta: -2_667,
						matchKey: "expense:Kids",
						isRemoved: true,
						isNew: false,
					},
				},
			},
		]);
		useRetirementStore.getState().replaceSpendingMixLevers([
			{
				lever: {
					type: "spending_category_change",
					params: {
						label: "Kids",
						lineItemType: "expense",
						monthlyDelta: -2_667,
						matchKey: "expense:Kids",
						isRemoved: true,
						isNew: false,
					},
				},
			},
			{
				lever: {
					type: "spending_category_change",
					params: {
						label: "Groceries",
						lineItemType: "expense",
						monthlyDelta: -100,
						matchKey: "expense:Groceries",
						isRemoved: false,
						isNew: false,
						newMonthlyAmount: 300,
					},
				},
			},
		]);
		const state = useRetirementStore.getState();
		assert.equal(state.draftLevers.length, 3);
		assert.equal(state.draftLevers[0]?.lever.type, "spouse_stops_working");
		assert.equal(
			state.draftLevers.filter(
				(entry) => entry.lever.type === "spending_category_change",
			).length,
			2,
		);
		assert.equal(state.isDirty, true);
	});

	it("clears mix levers on an empty replace", () => {
		useRetirementStore.getState().replaceSpendingMixLevers([
			{
				lever: {
					type: "spending_category_change",
					params: {
						label: "Kids",
						lineItemType: "expense",
						monthlyDelta: -2_667,
						matchKey: "expense:Kids",
						isRemoved: true,
						isNew: false,
					},
				},
			},
		]);
		useRetirementStore.getState().replaceSpendingMixLevers([]);
		assert.equal(useRetirementStore.getState().draftLevers.length, 0);
	});
});
