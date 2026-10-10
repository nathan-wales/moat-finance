import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TaxDocument } from "@moat/contracts";
import {
	isSelectableTaxDocument,
	nextSelectedIdsForSelectAll,
	parseTaxesDocumentsView,
	pruneSelectedIds,
	selectableTaxDocumentIds,
	selectionCheckedState,
	toggleSelectedId,
} from "./documents-view";
import { createPendingTaxDocument } from "./pending-document";

function document(input: {
	id: string;
	processingState: TaxDocument["processingState"];
}): TaxDocument {
	const created = createPendingTaxDocument({
		id: input.id,
		taxYear: 2026,
		filename: "w2.pdf",
		mimeType: "application/pdf",
		byteSize: 12,
	});
	created.processingState = input.processingState;
	return created;
}

describe("taxes documents view", () => {
	it("defaults unknown stored values to cards", () => {
		assert.equal(parseTaxesDocumentsView(null), "cards");
		assert.equal(parseTaxesDocumentsView("cards"), "cards");
		assert.equal(parseTaxesDocumentsView("table"), "table");
		assert.equal(parseTaxesDocumentsView("list"), "cards");
	});

	it("only lets finished documents be selected", () => {
		const complete = document({ id: "doc-1", processingState: "complete" });
		const failed = document({ id: "doc-2", processingState: "failed" });
		const processing = document({
			id: "doc-3",
			processingState: "processing",
		});
		const pending = document({
			id: "pending-abc",
			processingState: "complete",
		});

		assert.equal(isSelectableTaxDocument(complete, false), true);
		assert.equal(isSelectableTaxDocument(failed, false), true);
		assert.equal(isSelectableTaxDocument(processing, false), false);
		assert.equal(isSelectableTaxDocument(pending, false), false);
		assert.equal(isSelectableTaxDocument(complete, true), false);
		assert.deepEqual(
			selectableTaxDocumentIds([complete, failed, processing, pending], false),
			["doc-1", "doc-2"],
		);
	});

	it("toggles, selects all, and prunes missing ids", () => {
		assert.deepEqual(toggleSelectedId(["doc-1"], "doc-2"), ["doc-1", "doc-2"]);
		assert.deepEqual(toggleSelectedId(["doc-1", "doc-2"], "doc-1"), ["doc-2"]);
		assert.deepEqual(
			nextSelectedIdsForSelectAll({
				selectedIds: ["doc-1"],
				selectableIds: ["doc-1", "doc-2"],
			}),
			["doc-1", "doc-2"],
		);
		assert.deepEqual(
			nextSelectedIdsForSelectAll({
				selectedIds: ["doc-1", "doc-2"],
				selectableIds: ["doc-1", "doc-2"],
			}),
			[],
		);
		assert.deepEqual(pruneSelectedIds(["doc-1", "doc-2"], ["doc-2"]), [
			"doc-2",
		]);
		assert.equal(selectionCheckedState(0, 3), false);
		assert.equal(selectionCheckedState(2, 3), "indeterminate");
		assert.equal(selectionCheckedState(3, 3), true);
	});
});
