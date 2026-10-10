import assert from "node:assert/strict";
import { afterEach, before, describe, it } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
	pretendToBeVisual: true,
	url: "http://localhost",
});

const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
globals.HTMLElement = dom.window.HTMLElement;
globals.HTMLButtonElement = dom.window.HTMLButtonElement;
globals.Node = dom.window.Node;
globals.Event = dom.window.Event;
globals.KeyboardEvent = dom.window.KeyboardEvent;
globals.MouseEvent = dom.window.MouseEvent;
globals.IS_REACT_ACT_ENVIRONMENT = true;

Object.defineProperty(globalThis, "navigator", {
	configurable: true,
	value: dom.window.navigator,
	writable: true,
});

type Root = { render: (node: React.ReactNode) => void; unmount: () => void };

let act: (callback: () => void | Promise<void>) => Promise<void>;
let createRoot: (container: Element) => Root;
let Button: typeof import("./button").Button;
let PrimaryActionFooter: typeof import("./primary-action-react").PrimaryActionFooter;
let PrimaryActionScope: typeof import("./primary-action-react").PrimaryActionScope;
let resetPrimaryActionRegistry: typeof import("./primary-action").resetPrimaryActionRegistry;

before(async () => {
	const react = await import("react");
	const client = await import("react-dom/client");
	act = react.act as typeof act;
	createRoot = client.createRoot as unknown as typeof createRoot;
	({ Button } = await import("./button"));
	({ PrimaryActionFooter, PrimaryActionScope } = await import(
		"./primary-action-react"
	));
	({ resetPrimaryActionRegistry } = await import("./primary-action"));
});

async function mount(node: React.ReactNode) {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.append(container);
	const root = createRoot(container);
	await act(() => {
		root.render(node);
	});
	return { container, root };
}

afterEach(() => {
	resetPrimaryActionRegistry();
	dom.window.document.body.replaceChildren();
});

function pressModEnter(metaKey = true, ctrlKey = false) {
	dom.window.dispatchEvent(
		new dom.window.KeyboardEvent("keydown", {
			bubbles: true,
			cancelable: true,
			ctrlKey,
			key: "Enter",
			metaKey,
		}),
	);
}

describe("primary action button hint", () => {
	it("shows the shortcut on the footer primary and clicks it", async () => {
		let saved = 0;
		const { container } = await mount(
			<PrimaryActionScope>
				<PrimaryActionFooter>
					<Button onClick={() => undefined} variant="outline">
						Cancel
					</Button>
					<Button
						onClick={() => {
							saved += 1;
						}}
					>
						Save
					</Button>
				</PrimaryActionFooter>
			</PrimaryActionScope>,
		);

		const buttons = [...container.querySelectorAll("button")];
		assert.equal(buttons.length, 2);
		const cancel = buttons[0];
		const save = buttons[1];
		assert.ok(cancel);
		assert.ok(save);
		assert.equal(cancel.getAttribute("data-primary-shortcut"), null);
		assert.equal(save.getAttribute("data-primary-shortcut"), "true");
		assert.match(save.innerHTML, /<kbd/);
		assert.doesNotMatch(cancel.innerHTML, /<kbd/);

		await act(() => {
			pressModEnter(true);
		});
		assert.equal(saved, 1);

		await act(() => {
			pressModEnter(false, true);
		});
		assert.equal(saved, 2);
	});

	it("does not show a shortcut on a disabled primary", async () => {
		let saved = 0;
		const { container } = await mount(
			<PrimaryActionScope>
				<PrimaryActionFooter>
					<Button
						disabled
						onClick={() => {
							saved += 1;
						}}
					>
						Save
					</Button>
				</PrimaryActionFooter>
			</PrimaryActionScope>,
		);

		const save = container.querySelector("button");
		assert.ok(save);
		assert.equal(save.getAttribute("data-primary-shortcut"), null);

		await act(() => {
			pressModEnter(true);
		});
		assert.equal(saved, 0);
	});
});
