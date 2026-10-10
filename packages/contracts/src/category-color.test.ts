import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	FALLBACK_CATEGORY_COLOR,
	hexColorSchema,
	isHexColor,
	normalizeHexColor,
	resolveCategoryColor,
} from "./category-color";

describe("hexColorSchema", () => {
	it("accepts 6-digit hex with a leading hash", () => {
		assert.equal(hexColorSchema.parse("#16a34a"), "#16a34a");
		assert.equal(hexColorSchema.parse("#16A34A"), "#16A34A");
	});

	it("rejects shorthand, missing hash, and non-hex", () => {
		assert.equal(hexColorSchema.safeParse("#16A").success, false);
		assert.equal(hexColorSchema.safeParse("16A34A").success, false);
		assert.equal(hexColorSchema.safeParse("#GG0000").success, false);
	});
});

describe("resolveCategoryColor", () => {
	it("uppercases valid hex and falls back otherwise", () => {
		assert.equal(normalizeHexColor("#16a34a"), "#16A34A");
		assert.equal(isHexColor("#16a34a"), true);
		assert.equal(resolveCategoryColor("#22c55e"), "#22C55E");
		assert.equal(resolveCategoryColor(null), FALLBACK_CATEGORY_COLOR);
		assert.equal(resolveCategoryColor("blue"), FALLBACK_CATEGORY_COLOR);
	});
});
