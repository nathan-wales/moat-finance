import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES } from "@moat/contracts";
import { resolveDocumentsTabStorage } from "./resolve-documents-tab-storage";

describe("resolveDocumentsTabStorage", () => {
	it("uses document bytes with the overview limit", () => {
		const storage = resolveDocumentsTabStorage({
			usedBytes: 203_761,
			overviewStorage: { usedBytes: 0, limitBytes: 100 * 1024 * 1024 },
			overviewSuccess: true,
			overviewFailed: false,
		});
		assert.deepEqual(storage, {
			usedBytes: 203_761,
			limitBytes: 100 * 1024 * 1024,
		});
	});

	it("hides the cap when overview says storage is unlimited", () => {
		const storage = resolveDocumentsTabStorage({
			usedBytes: 203_761,
			overviewStorage: { usedBytes: 203_761, limitBytes: null },
			overviewSuccess: true,
			overviewFailed: false,
		});
		assert.deepEqual(storage, {
			usedBytes: 203_761,
			limitBytes: null,
		});
	});

	it("falls back to the cloud cap when overview fails", () => {
		const storage = resolveDocumentsTabStorage({
			usedBytes: 203_761,
			overviewStorage: undefined,
			overviewSuccess: false,
			overviewFailed: true,
		});
		assert.deepEqual(storage, {
			usedBytes: 203_761,
			limitBytes: TAX_CLOUD_DOCUMENT_STORAGE_LIMIT_BYTES,
		});
	});

	it("waits while overview is still loading", () => {
		const storage = resolveDocumentsTabStorage({
			usedBytes: 203_761,
			overviewStorage: undefined,
			overviewSuccess: false,
			overviewFailed: false,
		});
		assert.equal(storage, undefined);
	});
});
