import assert from "node:assert/strict";
import { before, describe, it } from "node:test";
import { JSDOM } from "jsdom";

const dom = new JSDOM("<!doctype html><html><body></body></html>", {
	pretendToBeVisual: true,
	url: "http://localhost",
});

const globals = globalThis as Record<string, unknown>;
globals.window = dom.window;
globals.document = dom.window.document;
globals.HTMLElement = dom.window.HTMLElement;
globals.HTMLTextAreaElement = dom.window.HTMLTextAreaElement;
globals.Event = dom.window.Event;
globals.KeyboardEvent = dom.window.KeyboardEvent;
globals.MouseEvent = dom.window.MouseEvent;
globals.IS_REACT_ACT_ENVIRONMENT = true;

// Node 20 has no `navigator` global and Node 22 exposes a getter-only one, so
// neither a plain assignment nor a missing value works across both.
Object.defineProperty(globalThis, "navigator", {
	configurable: true,
	value: dom.window.navigator,
	writable: true,
});

type Root = { render: (node: React.ReactNode) => void };

let act: (callback: () => void | Promise<void>) => Promise<void>;
let createRoot: (container: Element) => Root;
let InlineRuleSuggestInput: typeof import("./inline-rule-suggest-input").InlineRuleSuggestInput;
let InlineRuleTextInput: typeof import("./inline-rule-text-input").InlineRuleTextInput;

before(async () => {
	const react = await import("react");
	const client = await import("react-dom/client");
	act = react.act as typeof act;
	createRoot = client.createRoot as unknown as typeof createRoot;
	({ InlineRuleSuggestInput } = await import("./inline-rule-suggest-input"));
	({ InlineRuleTextInput } = await import("./inline-rule-text-input"));
});

async function mount(node: React.ReactNode) {
	const container = dom.window.document.createElement("div");
	dom.window.document.body.append(container);
	const root = createRoot(container);
	await act(() => {
		root.render(node);
	});
	return container;
}

function textarea(container: Element) {
	const element = container.querySelector("textarea");
	assert.ok(element, "expected an inline text token");
	return element;
}

async function type(element: HTMLTextAreaElement, value: string) {
	const setValue = Object.getOwnPropertyDescriptor(
		dom.window.HTMLTextAreaElement.prototype,
		"value",
	)?.set;
	assert.ok(setValue);
	await act(() => {
		setValue.call(element, value);
		element.dispatchEvent(new dom.window.Event("input", { bubbles: true }));
	});
}

async function press(element: Element, key: string) {
	await act(() => {
		element.dispatchEvent(
			new dom.window.KeyboardEvent("keydown", { bubbles: true, key }),
		);
	});
}

describe("InlineRuleTextInput editing", () => {
	it("reports every edit so the rule stays in sync", async () => {
		const edits: string[] = [];
		const container = await mount(
			<InlineRuleTextInput
				ariaLabel="Condition value"
				onValueChange={(next) => edits.push(next)}
				value=""
			/>,
		);

		await type(textarea(container), "my529");
		assert.deepEqual(edits, ["my529"]);
	});

	it("keeps a pasted multiline value on one line", async () => {
		const edits: string[] = [];
		const container = await mount(
			<InlineRuleTextInput
				ariaLabel="New description"
				onValueChange={(next) => edits.push(next)}
				value=""
			/>,
		);

		await type(textarea(container), "monthly 529\ncontribution");
		assert.deepEqual(edits, ["monthly 529 contribution"]);
	});

	it("commits on Enter and on blur", async () => {
		let commits = 0;
		const container = await mount(
			<InlineRuleTextInput
				ariaLabel="Condition value"
				onCommit={() => {
					commits += 1;
				}}
				onValueChange={() => undefined}
				value="my529"
			/>,
		);

		const input = textarea(container);
		await press(input, "Enter");
		assert.equal(commits, 1);

		await act(() => {
			input.dispatchEvent(new dom.window.Event("focusout", { bubbles: true }));
		});
		assert.equal(commits, 2);
	});
});

describe("InlineRuleSuggestInput keyboard navigation", () => {
	const options = [
		{ label: "Investments", value: "Investments" },
		{ label: "Insurance", value: "Insurance" },
	];

	async function openSuggestInput() {
		const selected: string[] = [];
		const container = await mount(
			<InlineRuleSuggestInput
				ariaLabel="Category to set"
				onValueChange={(next) => selected.push(next)}
				options={options}
				value=""
			/>,
		);
		const input = textarea(container);
		await act(() => {
			input.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
		});
		return { container, input, selected };
	}

	it("highlights the first option on open so Enter commits it", async () => {
		const { container, input, selected } = await openSuggestInput();

		assert.ok(container.querySelector('[role="listbox"]'));
		const firstOption = container.querySelector('[role="option"]');
		assert.equal(firstOption?.getAttribute("aria-selected"), "true");

		await press(input, "Enter");
		assert.deepEqual(selected, ["Investments"]);
	});

	it("moves from the first option with ArrowDown, then Enter selects it", async () => {
		const { input, selected } = await openSuggestInput();

		await press(input, "ArrowDown");
		await press(input, "Enter");
		assert.deepEqual(selected, ["Insurance"]);
	});

	it("opens to the first option when ArrowDown is pressed while closed", async () => {
		const { container, input, selected } = await openSuggestInput();

		await press(input, "Escape");
		assert.equal(container.querySelector('[role="listbox"]'), null);

		await press(input, "ArrowDown");
		const firstOption = container.querySelector('[role="option"]');
		assert.equal(firstOption?.getAttribute("aria-selected"), "true");

		await press(input, "Enter");
		assert.deepEqual(selected, ["Investments"]);
	});

	it("closes the suggestion list on Escape without changing the value", async () => {
		const { container, input, selected } = await openSuggestInput();

		await press(input, "Escape");

		assert.equal(container.querySelector('[role="listbox"]'), null);
		assert.deepEqual(selected, []);
	});

	it("keeps the list closed when there are no options and no empty state", async () => {
		const container = await mount(
			<InlineRuleSuggestInput
				ariaLabel="Hashtag to add"
				onValueChange={() => undefined}
				options={[]}
				value="tax"
			/>,
		);
		const input = textarea(container);
		await act(() => {
			input.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
		});

		assert.equal(container.querySelector('[role="listbox"]'), null);
	});

	it("shows an empty message and create action when nothing matches", async () => {
		let createCount = 0;
		const container = await mount(
			<InlineRuleSuggestInput
				ariaLabel="Category to set"
				emptyMessage="No categories found"
				footerAction={{
					label: "+ Create category",
					onSelect: () => {
						createCount += 1;
					},
				}}
				onValueChange={() => undefined}
				options={[]}
				value="Rental Ico"
			/>,
		);
		const input = textarea(container);
		await act(() => {
			input.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
		});

		assert.match(container.textContent ?? "", /No categories found/);
		assert.match(container.textContent ?? "", /\+ Create category/);

		const createOption = [
			...container.querySelectorAll('[role="option"]'),
		].find((node) => node.textContent === "+ Create category");
		assert.ok(createOption);
		assert.equal(createOption.getAttribute("aria-selected"), "true");

		await press(input, "Enter");
		assert.equal(createCount, 1);
	});

	it("moves from the last option onto the create action", async () => {
		let createCount = 0;
		const selected: string[] = [];
		const container = await mount(
			<InlineRuleSuggestInput
				ariaLabel="Category to set"
				footerAction={{
					label: "+ Create category",
					onSelect: () => {
						createCount += 1;
					},
				}}
				onValueChange={(next) => selected.push(next)}
				options={options}
				value=""
			/>,
		);
		const input = textarea(container);
		await act(() => {
			input.dispatchEvent(new dom.window.Event("focusin", { bubbles: true }));
		});

		await press(input, "ArrowDown");
		await press(input, "ArrowDown");
		await press(input, "Enter");

		assert.equal(createCount, 1);
		assert.deepEqual(selected, []);
	});
});
