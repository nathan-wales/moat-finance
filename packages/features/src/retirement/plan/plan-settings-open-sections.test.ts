import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parsePlanSettingsOpenSections } from "./plan-settings-open-sections";

describe("parsePlanSettingsOpenSections", () => {
	it("defaults to all collapsed when nothing is stored", () => {
		assert.deepEqual(parsePlanSettingsOpenSections(null), []);
	});

	it("restores known section ids", () => {
		assert.deepEqual(
			parsePlanSettingsOpenSections(JSON.stringify(["investments", "debts"])),
			["investments", "debts"],
		);
	});

	it("drops unknown or malformed ids", () => {
		assert.deepEqual(
			parsePlanSettingsOpenSections(
				JSON.stringify(["timeline", "nope", 12, null, "taxes"]),
			),
			["timeline", "taxes"],
		);
	});

	it("returns all collapsed for invalid JSON or non-arrays", () => {
		assert.deepEqual(parsePlanSettingsOpenSections("{"), []);
		assert.deepEqual(parsePlanSettingsOpenSections('"timeline"'), []);
		assert.deepEqual(parsePlanSettingsOpenSections("{}"), []);
	});
});
