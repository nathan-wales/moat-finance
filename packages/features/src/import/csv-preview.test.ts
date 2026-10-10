import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseCsvPreview } from "./csv-preview";

describe("parseCsvPreview", () => {
	it("returns headers and the first 25 data rows", () => {
		const header = "Date,Title,Amount";
		const dataRows = Array.from(
			{ length: 30 },
			(_, index) =>
				`2026-01-${String(index + 1).padStart(2, "0")},Store ${index + 1},${index + 1}.00`,
		);
		const preview = parseCsvPreview([header, ...dataRows].join("\n"));

		assert.deepEqual(preview.headers, ["Date", "Title", "Amount"]);
		assert.equal(preview.rows.length, 25);
		assert.equal(preview.totalDataRows, 30);
		assert.deepEqual(preview.rows[0]?.cells, ["2026-01-01", "Store 1", "1.00"]);
		assert.deepEqual(preview.rows[24]?.cells, [
			"2026-01-25",
			"Store 25",
			"25.00",
		]);
	});

	it("keeps quoted commas inside a cell", () => {
		const preview = parseCsvPreview(
			["Date,Title,Amount", '2026-01-02,"Coffee, Inc",12.50'].join("\n"),
		);

		assert.deepEqual(preview.rows[0]?.cells, [
			"2026-01-02",
			"Coffee, Inc",
			"12.50",
		]);
	});

	it("pads short rows to the header length", () => {
		const preview = parseCsvPreview("Date,Title,Amount\n2026-01-02,Coffee");

		assert.deepEqual(preview.rows[0]?.cells, ["2026-01-02", "Coffee", ""]);
	});
});
