import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildCategoryHighlightPath,
	CATEGORY_HIGHLIGHT_PARAM,
	categoryRowElementId,
} from "./category-highlight";

describe("category highlight helpers", () => {
	it("builds a categories path with the highlight query param", () => {
		assert.equal(
			buildCategoryHighlightPath("cat_123"),
			`/categories?${CATEGORY_HIGHLIGHT_PARAM}=cat_123`,
		);
	});

	it("encodes highlight ids for the query string", () => {
		assert.equal(
			buildCategoryHighlightPath("id with space"),
			`/categories?${CATEGORY_HIGHLIGHT_PARAM}=id+with+space`,
		);
	});

	it("uses a stable element id for the destination row", () => {
		assert.equal(categoryRowElementId("cat_123"), "category-row-cat_123");
	});
});
