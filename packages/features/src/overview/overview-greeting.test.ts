import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	firstNameFromDisplayName,
	overviewGreeting,
	timeOfDayGreeting,
} from "./overview-greeting";

describe("overview greeting", () => {
	it("uses morning, afternoon, and evening by local hour", () => {
		assert.equal(timeOfDayGreeting(new Date(2026, 0, 1, 8)), "Good morning");
		assert.equal(timeOfDayGreeting(new Date(2026, 0, 1, 12)), "Good afternoon");
		assert.equal(timeOfDayGreeting(new Date(2026, 0, 1, 18)), "Good evening");
	});

	it("keeps the first name from a display name", () => {
		assert.equal(firstNameFromDisplayName("  Tyler Smith "), "Tyler");
		assert.equal(firstNameFromDisplayName("  "), null);
		assert.equal(firstNameFromDisplayName(null), null);
	});

	it("omits the name when none is available", () => {
		const morning = new Date(2026, 0, 1, 9);
		assert.equal(
			overviewGreeting("Tyler Smith", morning),
			"Good morning, Tyler",
		);
		assert.equal(overviewGreeting(null, morning), "Good morning");
	});
});
