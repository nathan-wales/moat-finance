import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { isPageReloadShortcut } from "../shared/page-reload";

function shortcut(
	overrides: Partial<{
		type: string;
		key: string;
		meta: boolean;
		control: boolean;
		alt: boolean;
		shift: boolean;
	}> = {},
) {
	return {
		type: "keyDown",
		key: "r",
		meta: true,
		control: false,
		alt: false,
		shift: false,
		...overrides,
	};
}

describe("isPageReloadShortcut", () => {
	it("matches Cmd+R and Ctrl+R", () => {
		assert.equal(isPageReloadShortcut(shortcut()), true);
		assert.equal(
			isPageReloadShortcut(shortcut({ meta: false, control: true })),
			true,
		);
	});

	it("ignores shift, alt, and other keys", () => {
		assert.equal(isPageReloadShortcut(shortcut({ shift: true })), false);
		assert.equal(isPageReloadShortcut(shortcut({ alt: true })), false);
		assert.equal(isPageReloadShortcut(shortcut({ key: "f" })), false);
		assert.equal(isPageReloadShortcut(shortcut({ type: "keyUp" })), false);
	});
});
