import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandMenuProvider } from "./command-menu-context";
import { CommandMenuTrigger } from "./command-menu-trigger";

describe("CommandMenuTrigger", () => {
	it("renders an icon-only search control", () => {
		const html = renderToStaticMarkup(
			<CommandMenuProvider>
				<CommandMenuTrigger />
			</CommandMenuProvider>,
		);
		assert.match(html, /aria-label="Search pages"/);
		assert.match(html, /lucide-search/);
		assert.doesNotMatch(html, /<kbd/);
	});
});
