import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { MemoryFileStorage } from "./file-storage";
import { reprocessTaxDocument, uploadTaxDocument } from "./operations";
import { assembleParsedTaxDocument, detectFormHints } from "./parsed-document";
import type { TaxDocumentParser } from "./parser";

describe("assembleParsedTaxDocument", () => {
	it("keeps provenance, tables, and form hints", () => {
		const parsed = assembleParsedTaxDocument({
			blocks: [
				{
					page: 1,
					text: "Form W-2 Wage and Tax Statement",
					type: "title",
					bbox: { page: 1, left: 0, top: 0, right: 10, bottom: 10 },
				},
				{ page: 1, text: "Wages: 50000.00", type: "text" },
			],
			tables: [
				{ headers: ["Box", "Amount"], rows: [["1", "50000.00"]], page: 1 },
			],
			parserName: "docling",
			parserVersion: "1.31.0",
			pageCount: 1,
		});
		assert.deepEqual(parsed.formHints, ["W-2"]);
		assert.equal(parsed.keyValues[0]?.value, "50000.00");
		assert.equal(parsed.sourceLocations[0]?.bbox?.right, 10);
		assert.equal(parsed.parserName, "docling");
		assert.equal(parsed.pageCount, 1);
	});

	it("detects 1099-B hints", () => {
		assert.ok(
			detectFormHints("Form 1099-B Proceeds from Broker").includes("1099-B"),
		);
	});
});

describe("async tax parse mode", () => {
	it("stores the upload and skips inline parsing", async () => {
		let parsed = false;
		const parser: TaxDocumentParser = {
			provider: "docling",
			version: "test",
			parseDocument: async () => {
				parsed = true;
				throw new Error("inline parse should not run");
			},
		};
		const createdAt = new Date("2026-02-03T00:00:00.000Z");
		const ctx = {
			userId: "user-1",
			repositories: {
				taxes: {
					listDocuments: async () => [],
					createDocument: async (input: Record<string, unknown>) => ({
						...input,
						uploadedAt: createdAt,
						createdAt,
						updatedAt: createdAt,
					}),
				},
			},
		};
		const result = await uploadTaxDocument(
			ctx as never,
			{
				storage: new MemoryFileStorage(),
				parser,
				parseMode: "async",
				documentMaxBytes: 1024,
			},
			{
				taxYear: 2026,
				filename: "w2.pdf",
				mimeType: "application/pdf",
				data: Buffer.from("%PDF-1.4").toString("base64"),
			},
		);
		assert.equal(result.processingState, "processing");
		assert.equal(parsed, false);
	});

	it("requeues an async reprocess and clears any parse claim", async () => {
		const createdAt = new Date("2026-02-03T00:00:00.000Z");
		const updated: {
			processingState?: unknown;
			metadata?: { parseClaimedAt?: unknown };
		} = {};
		const ctx = {
			userId: "user-1",
			repositories: {
				taxes: {
					findDocument: async () => ({
						id: "doc-1",
						userId: "user-1",
						taxYear: 2026,
						metadata: { byteSize: 12, parseClaimedAt: 123 },
						uploadedAt: createdAt,
						createdAt,
						updatedAt: createdAt,
					}),
					updateDocument: async (input: { data: Record<string, unknown> }) => {
						updated.processingState = input.data.processingState;
						updated.metadata = input.data.metadata as {
							parseClaimedAt?: unknown;
						};
						return {
							id: "doc-1",
							userId: "user-1",
							taxYear: 2026,
							documentCategory: "other",
							formType: null,
							issuer: null,
							recipient: null,
							source: "upload",
							originalFilename: "w2.pdf",
							mimeType: "application/pdf",
							processingState: input.data.processingState,
							parserProvider: null,
							parserVersion: null,
							extractionConfidence: null,
							reviewStatus: "pending",
							userConfirmed: false,
							metadata: input.data.metadata,
							uploadedAt: createdAt,
							createdAt,
							updatedAt: createdAt,
						};
					},
				},
			},
		};
		const result = await reprocessTaxDocument(
			ctx as never,
			{
				storage: new MemoryFileStorage(),
				parser: {
					provider: "docling",
					version: "test",
					parseDocument: async () => {
						throw new Error("inline parse should not run");
					},
				},
				parseMode: "async",
			},
			{ id: "doc-1" },
		);
		assert.equal(result.processingState, "processing");
		assert.equal(updated.processingState, "processing");
		assert.equal(updated.metadata?.parseClaimedAt, null);
	});
});
