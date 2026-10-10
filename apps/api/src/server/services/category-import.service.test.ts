import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildCategoryNameToIdMap } from "./category-import.service";

describe("buildCategoryNameToIdMap", () => {
	it("prefers user-owned categories over global defaults with the same name", () => {
		const categoryNameToId = buildCategoryNameToIdMap([
			{ id: "global-subs", name: "Subscriptions", userId: null },
			{ id: "user-subs", name: "Subscriptions", userId: "user-1" },
			{ id: "global-uncat", name: "Uncategorized", userId: null },
		]);

		assert.equal(categoryNameToId.get("subscriptions"), "user-subs");
		assert.equal(categoryNameToId.get("uncategorized"), "global-uncat");
	});

	it("keeps global categories when the user has no override", () => {
		const categoryNameToId = buildCategoryNameToIdMap([
			{ id: "global-pets", name: "Pets", userId: null },
			{ id: "global-education", name: "Education", userId: null },
		]);

		assert.equal(categoryNameToId.get("pets"), "global-pets");
		assert.equal(categoryNameToId.get("education"), "global-education");
	});
});
