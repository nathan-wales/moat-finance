import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { AlignLeft, Store } from "lucide-react";
import { renderToStaticMarkup } from "react-dom/server";
import { InlineRuleDropdown } from "./inline-rule-dropdown";
import { InlineRuleRemoveButton } from "./inline-rule-remove-button";
import { InlineRuleSentence } from "./inline-rule-sentence";
import { InlineRuleStaticText } from "./inline-rule-static-text";
import { InlineRuleSuggestInput } from "./inline-rule-suggest-input";
import { InlineRuleTextInput } from "./inline-rule-text-input";

const FIELDS = [
	{ icon: AlignLeft, label: "Description", value: "DESCRIPTION" },
	{ icon: Store, label: "Merchant", value: "MERCHANT" },
];

const FIXED_WIDTH_PATTERN = /class="[^"]*(?<!min-)\bw-\d|flex-1|grid-cols-/;
const DOTTED_UNDERLINE = "border-b border-dotted";

function renderDropdown(
	props: Partial<Parameters<typeof InlineRuleDropdown>[0]> = {},
) {
	return renderToStaticMarkup(
		<InlineRuleDropdown
			ariaLabel="Condition field"
			onValueChange={() => undefined}
			options={FIELDS}
			value="DESCRIPTION"
			{...props}
		/>,
	);
}

describe("InlineRuleDropdown", () => {
	it("renders the selected label as inline text with a dotted underline", () => {
		const html = renderDropdown();
		assert.match(html, /Description/);
		assert.match(html, new RegExp(DOTTED_UNDERLINE));
	});

	it("renders a compact up/down chevron", () => {
		const html = renderDropdown();
		assert.match(html, /lucide-chevrons-up-down/);
	});

	it("renders the selected option icon inside the dotted underline", () => {
		const html = renderDropdown();
		assert.match(html, /lucide-text-align-start/);
		const underlineStart = html.indexOf(DOTTED_UNDERLINE);
		const iconIndex = html.indexOf("lucide-text-align-start");
		const chevronIndex = html.indexOf("lucide-chevrons-up-down");
		assert.ok(underlineStart !== -1);
		assert.ok(iconIndex > underlineStart);
		assert.ok(chevronIndex > iconIndex);
	});

	it("uses a semantic button with a combobox role and an accessible label", () => {
		const html = renderDropdown();
		assert.match(html, /<button[^>]+role="combobox"/);
		assert.match(html, /aria-label="Condition field"/);
	});

	it("sizes to its content instead of a fixed column", () => {
		const html = renderDropdown();
		assert.doesNotMatch(html, FIXED_WIDTH_PATTERN);
	});

	it("keeps a multiword label on one line", () => {
		const html = renderDropdown({
			options: [{ label: "does not contain", value: "NOT_CONTAINS" }],
			value: "NOT_CONTAINS",
		});
		assert.match(html, /whitespace-nowrap/);
		assert.match(html, /does not contain/);
	});

	it("shows the placeholder, still underlined, when nothing is selected", () => {
		const html = renderDropdown({ placeholder: "Choose field", value: "" });
		assert.match(html, /Choose field/);
		assert.match(html, new RegExp(DOTTED_UNDERLINE));
		assert.match(html, /text-muted-foreground/);
	});

	it("keeps the selected label when a footer action is present", () => {
		const html = renderDropdown({
			footerAction: {
				label: "view all scenarios",
				onSelect: () => undefined,
			},
		});
		const triggerEnd = html.indexOf("</button>");
		const trigger = triggerEnd === -1 ? html : html.slice(0, triggerEnd);
		assert.match(trigger, /Description/);
		assert.doesNotMatch(trigger, /view all scenarios/);
	});

	it("marks an invalid token for assistive tech, not with color alone", () => {
		const html = renderDropdown({ invalid: true });
		assert.match(html, /aria-invalid="true"/);
	});
});

describe("InlineRuleTextInput", () => {
	function renderTextInput(
		props: Partial<Parameters<typeof InlineRuleTextInput>[0]> = {},
	) {
		return renderToStaticMarkup(
			<InlineRuleTextInput
				ariaLabel="Condition value"
				onValueChange={() => undefined}
				value="my529"
				{...props}
			/>,
		);
	}

	it("renders a dotted underline without a chevron", () => {
		const html = renderTextInput();
		assert.match(html, new RegExp(DOTTED_UNDERLINE));
		assert.doesNotMatch(html, /lucide-chevrons-up-down/);
	});

	it("exposes text field semantics with an accessible label", () => {
		const html = renderTextInput();
		assert.match(html, /<textarea[^>]+aria-label="Condition value"/);
	});

	it("mirrors the value in a sizer so the token sizes to its content", () => {
		const html = renderTextInput({ value: "a very long transaction phrase" });
		const sizer = html.slice(
			html.indexOf('aria-hidden="true"'),
			html.indexOf("<textarea"),
		);
		assert.match(sizer, /a very long transaction phrase/);
		assert.doesNotMatch(html, FIXED_WIDTH_PATTERN);
	});

	it("keeps an empty value discoverable through a placeholder", () => {
		const html = renderTextInput({ placeholder: "enter text", value: "" });
		assert.match(html, /placeholder="enter text"/);
		assert.match(html, /min-w-16/);
	});

	it("lets a long value wrap instead of clipping", () => {
		const html = renderTextInput({ value: "monthly 529 contribution" });
		assert.match(html, /whitespace-pre-wrap/);
		assert.match(html, /break-words/);
	});
});

describe("InlineRuleSuggestInput", () => {
	it("is a combobox and can show a chevron when it offers known values", () => {
		const html = renderToStaticMarkup(
			<InlineRuleSuggestInput
				ariaLabel="Category"
				onValueChange={() => undefined}
				options={[{ label: "Investments", value: "Investments" }]}
				showChevron
				value="Investments"
			/>,
		);
		assert.match(html, /role="combobox"/);
		assert.match(html, /lucide-chevrons-up-down/);
	});

	it("omits the chevron when the value is freeform", () => {
		const html = renderToStaticMarkup(
			<InlineRuleSuggestInput
				ariaLabel="Hashtag to add"
				onValueChange={() => undefined}
				options={[]}
				value="tax-deductible"
			/>,
		);
		assert.doesNotMatch(html, /lucide-chevrons-up-down/);
	});
});

describe("InlineRuleStaticText", () => {
	it("renders connector words without an underline", () => {
		const html = renderToStaticMarkup(
			<InlineRuleStaticText>to</InlineRuleStaticText>,
		);
		assert.match(html, />to</);
		assert.doesNotMatch(html, new RegExp(DOTTED_UNDERLINE));
	});
});

describe("InlineRuleSentence", () => {
	it("wraps tokens in a labelled group that flows left to right", () => {
		const html = renderToStaticMarkup(
			<InlineRuleSentence label="Condition">
				<InlineRuleDropdown
					ariaLabel="Condition field"
					onValueChange={() => undefined}
					options={FIELDS}
					value="DESCRIPTION"
				/>
				<InlineRuleStaticText>and</InlineRuleStaticText>
			</InlineRuleSentence>,
		);
		assert.match(html, /role="group"/);
		assert.match(html, /aria-label="Condition"/);
		assert.match(html, /flex-wrap/);
		assert.match(html, /items-center/);
		assert.doesNotMatch(html, /grid-cols-/);
	});

	it("keeps the remove control out of the wrapping flow", () => {
		const html = renderToStaticMarkup(
			<InlineRuleSentence
				label="Action"
				trailing={
					<InlineRuleRemoveButton
						label="Remove action"
						onClick={() => undefined}
					/>
				}
			>
				<InlineRuleStaticText>to</InlineRuleStaticText>
			</InlineRuleSentence>,
		);
		const groupEnd = html.indexOf('aria-label="Remove action"');
		const wrapContainerEnd = html.indexOf("flex-wrap");
		assert.ok(wrapContainerEnd !== -1);
		assert.ok(groupEnd > wrapContainerEnd);
		assert.match(html, /shrink-0/);
	});
});
