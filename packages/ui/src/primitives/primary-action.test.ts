import assert from "node:assert/strict";
import { afterEach, describe, it } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
	pretendToBeVisual: true,
	url: "http://localhost",
});

const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
globals.Event = dom.window.Event;
globals.KeyboardEvent = dom.window.KeyboardEvent;
globals.HTMLElement = dom.window.HTMLElement;
globals.HTMLFormElement = dom.window.HTMLFormElement;
globals.Node = dom.window.Node;

Object.defineProperty(globalThis, "navigator", {
	configurable: true,
	value: dom.window.navigator,
	writable: true,
});

const {
	getActivePrimaryAction,
	handlePrimaryActionKeyDown,
	popOverlayScope,
	pushOverlayScope,
	registerPrimaryAction,
	resetPrimaryActionRegistry,
	unregisterPrimaryAction,
} = await import("./primary-action");

function dispatchModEnter(
	options: {
		metaKey?: boolean;
		ctrlKey?: boolean;
		repeat?: boolean;
		isComposing?: boolean;
		shiftKey?: boolean;
		altKey?: boolean;
	} = {},
) {
	const event = new dom.window.KeyboardEvent("keydown", {
		altKey: options.altKey ?? false,
		bubbles: true,
		cancelable: true,
		ctrlKey: options.ctrlKey ?? false,
		key: "Enter",
		metaKey: options.metaKey ?? false,
		repeat: options.repeat ?? false,
		shiftKey: options.shiftKey ?? false,
	});
	if (options.isComposing) {
		Object.defineProperty(event, "isComposing", { value: true });
	}
	const handled = handlePrimaryActionKeyDown(event);
	return { event, handled };
}

afterEach(() => {
	resetPrimaryActionRegistry();
	dom.window.document.body.replaceChildren();
});

describe("primary action registry", () => {
	it("fires the top overlay action on Cmd+Enter", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});

		const { event, handled } = dispatchModEnter({ metaKey: true });
		assert.equal(handled, true);
		assert.equal(event.defaultPrevented, true);
		assert.deepEqual(clicks, ["save"]);
	});

	it("fires the top overlay action on Ctrl+Enter", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});

		const { handled } = dispatchModEnter({ ctrlKey: true });
		assert.equal(handled, true);
		assert.deepEqual(clicks, ["save"]);
	});

	it("skips a disabled registration", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: false,
			form: null,
			overlayScopeId: overlay,
		});

		const { event, handled } = dispatchModEnter({ metaKey: true });
		assert.equal(handled, false);
		assert.equal(event.defaultPrevented, false);
		assert.deepEqual(clicks, []);
	});

	it("uses the innermost overlay when scopes are nested", () => {
		const clicks: string[] = [];
		const outer = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("outer"),
			enabled: true,
			form: null,
			overlayScopeId: outer,
		});
		const inner = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("inner"),
			enabled: true,
			form: null,
			overlayScopeId: inner,
		});

		dispatchModEnter({ metaKey: true });
		assert.deepEqual(clicks, ["inner"]);

		popOverlayScope(inner);
		dispatchModEnter({ metaKey: true });
		assert.deepEqual(clicks, ["inner", "outer"]);
	});

	it("ignores key repeat and IME composition", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});

		assert.equal(
			dispatchModEnter({ metaKey: true, repeat: true }).handled,
			false,
		);
		assert.equal(
			dispatchModEnter({ metaKey: true, isComposing: true }).handled,
			false,
		);
		assert.deepEqual(clicks, []);
	});

	it("ignores Shift or Alt with Mod+Enter", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});

		assert.equal(
			dispatchModEnter({ metaKey: true, shiftKey: true }).handled,
			false,
		);
		assert.equal(
			dispatchModEnter({ metaKey: true, altKey: true }).handled,
			false,
		);
		assert.deepEqual(clicks, []);
	});

	it("activates a form registration only when that form contains focus", () => {
		const clicks: string[] = [];
		const form = dom.window.document.createElement("form");
		const input = dom.window.document.createElement("input");
		form.append(input);
		dom.window.document.body.append(form);
		registerPrimaryAction({
			click: () => clicks.push("submit"),
			enabled: true,
			form,
			overlayScopeId: null,
		});

		assert.equal(getActivePrimaryAction(), null);
		input.focus();
		dispatchModEnter({ metaKey: true });
		assert.deepEqual(clicks, ["submit"]);
	});

	it("lets an overlay beat a focused form", () => {
		const clicks: string[] = [];
		const form = dom.window.document.createElement("form");
		const input = dom.window.document.createElement("input");
		form.append(input);
		dom.window.document.body.append(form);
		input.focus();
		registerPrimaryAction({
			click: () => clicks.push("form"),
			enabled: true,
			form,
			overlayScopeId: null,
		});
		const overlay = pushOverlayScope();
		registerPrimaryAction({
			click: () => clicks.push("dialog"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});

		dispatchModEnter({ ctrlKey: true });
		assert.deepEqual(clicks, ["dialog"]);
	});

	it("unregisters an action", () => {
		const clicks: string[] = [];
		const overlay = pushOverlayScope();
		const id = registerPrimaryAction({
			click: () => clicks.push("save"),
			enabled: true,
			form: null,
			overlayScopeId: overlay,
		});
		unregisterPrimaryAction(id);
		assert.equal(dispatchModEnter({ metaKey: true }).handled, false);
		assert.deepEqual(clicks, []);
	});
});
