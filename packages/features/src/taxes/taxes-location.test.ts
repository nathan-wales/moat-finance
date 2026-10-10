import assert from "node:assert/strict";
import { describe, it } from "node:test";
import {
	buildTaxesPath,
	parseTaxDocumentId,
	parseTaxTab,
	parseTaxYear,
} from "./taxes-location";

describe("taxes location", () => {
	it("defaults a missing tab to overview so back restores it", () => {
		assert.equal(parseTaxTab(null), "overview");
		assert.equal(parseTaxTab("documents"), "documents");
		assert.equal(parseTaxTab("unknown"), "overview");
		assert.equal(parseTaxTab("ask"), "overview");
	});

	it("builds a history entry for tab and year", () => {
		assert.equal(
			buildTaxesPath({ tab: "documents", year: 2026 }),
			"/taxes?tab=documents&year=2026",
		);
	});

	it("builds a history entry for an open document", () => {
		assert.equal(
			buildTaxesPath({
				tab: "documents",
				year: 2026,
				documentId: "doc-1",
			}),
			"/taxes?tab=documents&year=2026&documentId=doc-1",
		);
	});

	it("parses tax years", () => {
		assert.equal(parseTaxYear("2026"), 2026);
		assert.equal(parseTaxYear("nope"), null);
	});

	it("parses document ids so back can restore the list", () => {
		assert.equal(parseTaxDocumentId("doc-1"), "doc-1");
		assert.equal(parseTaxDocumentId("  "), null);
		assert.equal(parseTaxDocumentId(null), null);
	});
});
