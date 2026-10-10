import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isInternalAppRoute } from "./window-route";

describe("isInternalAppRoute", () => {
	it("accepts in-app paths", () => {
		assert.equal(isInternalAppRoute("/overview"), true);
		assert.equal(
			isInternalAppRoute("/retirement?tab=plan&section=income"),
			true,
		);
		assert.equal(isInternalAppRoute("/settings#settings-appearance"), true);
	});

	it("rejects external targets", () => {
		assert.equal(isInternalAppRoute(""), false);
		assert.equal(isInternalAppRoute("overview"), false);
		assert.equal(isInternalAppRoute("//evil.example"), false);
		assert.equal(isInternalAppRoute("https://example.com"), false);
		assert.equal(isInternalAppRoute("/\\windows"), false);
	});
});
