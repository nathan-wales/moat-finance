import assert from "node:assert/strict";
import { describe, it } from "node:test";
import type { TaxDocument } from "@moat/contracts";
import {
	createPendingTaxDocument,
	createPendingTaxDocumentId,
	isPendingTaxDocumentId,
	mergeTaxDocuments,
} from "./pending-document";

function document(input: {
	id: string;
	filename: string;
	processingState: TaxDocument["processingState"];
}): TaxDocument {
	const created = createPendingTaxDocument({
		id: input.id,
		taxYear: 2026,
		filename: input.filename,
		mimeType: "application/pdf",
		byteSize: 12,
	});
	created.processingState = input.processingState;
	return created;
}

describe("pending tax documents", () => {
	it("creates client ids that can be distinguished from server ids", () => {
		const id = createPendingTaxDocumentId();
		assert.equal(isPendingTaxDocumentId(id), true);
		assert.equal(isPendingTaxDocumentId("doc-1"), false);
	});

	it("prepends pending cards until the server list contains them", () => {
		const pending = document({
			id: "pending-1",
			filename: "w2.pdf",
			processingState: "processing",
		});
		const existing = document({
			id: "doc-old",
			filename: "1099.pdf",
			processingState: "complete",
		});
		const merged = mergeTaxDocuments([existing], [pending], 2026);
		assert.deepEqual(
			merged.map((item) => item.id),
			["pending-1", "doc-old"],
		);
	});

	it("hides a server processing card that matches an unresolved pending filename", () => {
		const pending = document({
			id: "pending-1",
			filename: "w2.pdf",
			processingState: "processing",
		});
		const server = document({
			id: "doc-real",
			filename: "w2.pdf",
			processingState: "processing",
		});
		const merged = mergeTaxDocuments([server], [pending], 2026);
		assert.deepEqual(
			merged.map((item) => item.id),
			["pending-1"],
		);
	});

	it("keeps a finished pending snapshot over a stale processing server row", () => {
		const pending = document({
			id: "doc-real",
			filename: "w2.pdf",
			processingState: "complete",
		});
		const server = document({
			id: "doc-real",
			filename: "w2.pdf",
			processingState: "processing",
		});
		const merged = mergeTaxDocuments([server], [pending], 2026);
		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.id, "doc-real");
		assert.equal(merged[0]?.processingState, "complete");
	});

	it("uses the server row once processing has finished", () => {
		const pending = document({
			id: "doc-real",
			filename: "w2.pdf",
			processingState: "processing",
		});
		const server = document({
			id: "doc-real",
			filename: "w2.pdf",
			processingState: "complete",
		});
		const merged = mergeTaxDocuments([server], [pending], 2026);
		assert.equal(merged.length, 1);
		assert.equal(merged[0]?.processingState, "complete");
	});
});
