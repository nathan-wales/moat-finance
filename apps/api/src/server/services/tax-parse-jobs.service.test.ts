import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { parseClaimedTaxDocument } from "./tax-parse-jobs.service";

describe("parseClaimedTaxDocument", () => {
	it("keeps block bounding boxes used for provenance", () => {
		const parsed = parseClaimedTaxDocument({
			text: "Wages: 50000.00",
			pages: [{ page: 1, text: "Wages: 50000.00" }],
			tables: [
				{
					headers: ["Box", "Amount"],
					rows: [["1", "50000.00"]],
					page: 1,
					bbox: { page: 1, left: 1, top: 2, right: 3, bottom: 4 },
				},
			],
			keyValues: [{ key: "Wages", value: "50000.00", page: 1 }],
			formClassification: null,
			extractedFields: { Wages: "50000.00" },
			confidence: 0.9,
			sourceLocations: [
				{
					page: 1,
					label: "text",
					text: "Wages: 50000.00",
					bbox: { page: 1, left: 1, top: 2, right: 3, bottom: 4 },
				},
			],
			blocks: [
				{
					page: 1,
					text: "Wages: 50000.00",
					type: "text",
					bbox: { page: 1, left: 1, top: 2, right: 3, bottom: 4 },
				},
			],
			parserName: "docling",
			parserVersion: "1.31.0",
			pageCount: 1,
		});
		assert.equal(parsed.blocks?.[0]?.bbox?.right, 3);
		assert.equal(parsed.tables[0]?.bbox?.bottom, 4);
		assert.equal(parsed.sourceLocations[0]?.bbox?.left, 1);
	});
});
