import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	excludeSplitParentTransactions,
	isSplitParentTransaction,
} from "./split-parent";

describe("split-parent", () => {
	it("identifies the original split shell, not the child legs", () => {
		assert.equal(
			isSplitParentTransaction({
				splitGroupId: "parent-1",
				splitParentId: null,
			}),
			true,
		);
		assert.equal(
			isSplitParentTransaction({
				splitGroupId: "parent-1",
				splitParentId: "parent-1",
			}),
			false,
		);
		assert.equal(
			isSplitParentTransaction({
				splitGroupId: null,
				splitParentId: null,
			}),
			false,
		);
	});

	it("drops the parent from a table list while keeping the legs", () => {
		const visible = excludeSplitParentTransactions([
			{
				id: "parent-1",
				description: "*Wildflower Village 2",
				splitGroupId: "parent-1",
				splitParentId: null,
			},
			{
				id: "child-a",
				description: "Wildflower HOA",
				splitGroupId: "parent-1",
				splitParentId: "parent-1",
			},
			{
				id: "child-b",
				description: "Wildflower HOA",
				splitGroupId: "parent-1",
				splitParentId: "parent-1",
			},
		]);
		assert.deepEqual(
			visible.map((tx) => tx.id),
			["child-a", "child-b"],
		);
	});
});
