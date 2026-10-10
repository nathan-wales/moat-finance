import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildAccountNameOverrideMap,
	resolveAccountDisplayName,
} from "./resolve-account-display-name";

describe("resolveAccountDisplayName", () => {
	it("uses the live name when no override is stored", () => {
		assert.equal(resolveAccountDisplayName(undefined, "Checking"), "Checking");
	});

	it("uses a non-empty override instead of the live name", () => {
		assert.equal(
			resolveAccountDisplayName("Main checking", "Checking"),
			"Main checking",
		);
	});

	it("ignores blank overrides", () => {
		assert.equal(resolveAccountDisplayName("   ", "Checking"), "Checking");
	});
});

describe("buildAccountNameOverrideMap", () => {
	it("indexes overrides by both raw and plaid-prefixed ids", () => {
		const map = buildAccountNameOverrideMap([
			{ id: "acct_1", nameOverride: "Condo mortgage" },
			{ id: "plaid-acct_2", nameOverride: "Emergency fund" },
			{ id: "acct_3", nameOverride: "   " },
		]);

		assert.equal(map.get("acct_1"), "Condo mortgage");
		assert.equal(map.get("plaid-acct_1"), "Condo mortgage");
		assert.equal(map.get("acct_2"), "Emergency fund");
		assert.equal(map.get("plaid-acct_2"), "Emergency fund");
		assert.equal(map.has("acct_3"), false);
	});

	it("returns an empty map for non-arrays", () => {
		assert.equal(buildAccountNameOverrideMap(null).size, 0);
		assert.equal(buildAccountNameOverrideMap(undefined).size, 0);
	});
});
