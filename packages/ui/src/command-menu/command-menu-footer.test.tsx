import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { CommandMenuFooter } from "./command-menu-footer";

describe("CommandMenuFooter", () => {
	it("renders navigation hints", () => {
		const html = renderToStaticMarkup(<CommandMenuFooter />);

		assert.match(html, /Navigate/);
		assert.match(html, /Open page/);
		assert.match(html, /Open in new tab/);
		assert.match(html, /↑/);
		assert.match(html, /↓/);
		assert.match(html, /↵/);
	});
});
