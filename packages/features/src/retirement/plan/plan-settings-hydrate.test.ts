import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { shouldHydrateOnce } from "./plan-settings-hydrate";

describe("shouldHydrateOnce", () => {
	it("applies the first hydrate after async sources are ready", () => {
		assert.equal(
			shouldHydrateOnce({
				alreadyHydrated: false,
				open: true,
				ready: true,
				skipHydrate: false,
			}),
			true,
		);
	});

	it("waits until profile and real estate have fetched", () => {
		assert.equal(
			shouldHydrateOnce({
				alreadyHydrated: false,
				open: true,
				ready: false,
				skipHydrate: false,
			}),
			false,
		);
	});

	it("preserves drafts after the first hydrate and when opening spending mix", () => {
		assert.equal(
			shouldHydrateOnce({
				alreadyHydrated: true,
				open: true,
				ready: true,
				skipHydrate: false,
			}),
			false,
		);
		assert.equal(
			shouldHydrateOnce({
				alreadyHydrated: false,
				open: true,
				ready: true,
				skipHydrate: true,
			}),
			false,
		);
	});
});
