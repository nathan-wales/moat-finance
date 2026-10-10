import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { renderToStaticMarkup } from "react-dom/server";
import { MonthPicker } from "./month-picker";

describe("MonthPicker", () => {
	it("renders month names instead of days", () => {
		const html = renderToStaticMarkup(
			<MonthPicker
				endMonth={new Date(2026, 3, 1)}
				selected={new Date(2026, 3, 1)}
				startMonth={new Date(2025, 4, 1)}
			/>,
		);

		assert.match(html, />Apr</);
		assert.doesNotMatch(html, /April 1/);
		assert.match(html, /aria-pressed="true"/);
	});

	it("disables months after the end month", () => {
		const html = renderToStaticMarkup(
			<MonthPicker
				endMonth={new Date(2026, 3, 1)}
				selected={new Date(2026, 3, 1)}
				startMonth={new Date(2025, 4, 1)}
			/>,
		);

		assert.match(html, /aria-label="May 2026"[^>]*disabled/);
		assert.match(html, /aria-label="Next year"[^>]*disabled/);
	});
});
