import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { buildTaxYearOptions } from "./tax-year-options";

describe("buildTaxYearOptions", () => {
	it("puts two years ahead of the default year first", () => {
		const options = buildTaxYearOptions(2026);

		assert.deepEqual(options.slice(0, 4), [2028, 2027, 2026, 2025]);
		assert.equal(options.at(-1), 2007);
		assert.equal(options.includes(2026), true);
	});

	it("keeps stored and active years even when they fall outside the chrome range", () => {
		const options = buildTaxYearOptions(2026, [1999, 2030]);

		assert.equal(options[0], 2030);
		assert.equal(options.at(-1), 1999);
	});
});
