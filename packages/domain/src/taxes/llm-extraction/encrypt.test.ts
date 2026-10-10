import assert from "node:assert/strict";
import { randomBytes } from "node:crypto";
import { describe, it } from "node:test";
import {
	createEnvTaxLlmKeyResolver,
	decryptTaxExtractionPayload,
	encryptTaxExtractionPayload,
	TaxLlmDecryptionError,
} from "./encrypt";
import { serializedQueueMessageBytes } from "./queue-message";

function resolver(key = randomBytes(32).toString("base64"), version = "v1") {
	return createEnvTaxLlmKeyResolver({
		TAX_LLM_ENCRYPTION_KEY_VERSION: version,
		[`TAX_LLM_ENCRYPTION_KEY_${version}`]: key,
	});
}

describe("tax extraction encryption", () => {
	it("round-trips plaintext", () => {
		const keys = resolver();
		const message = encryptTaxExtractionPayload({
			jobId: "job-1",
			documentType: "W2",
			schemaVersion: "2026-09-18",
			plaintext: {
				documentId: "doc-1",
				taxYear: 2025,
				filename: "w2.pdf",
				parsedText: "synthetic wages 1.00",
			},
			keys,
		});
		const decrypted = decryptTaxExtractionPayload({ message, keys });
		assert.equal(decrypted.parsedText, "synthetic wages 1.00");
		assert.equal(decrypted.documentId, "doc-1");
	});

	it("uses a different IV each time", () => {
		const keys = resolver();
		const input = {
			jobId: "job-1",
			documentType: "W2" as const,
			schemaVersion: "2026-09-18",
			plaintext: {
				documentId: "doc-1",
				taxYear: 2025,
				filename: "w2.pdf",
				parsedText: "synthetic",
			},
			keys,
		};
		const first = encryptTaxExtractionPayload(input);
		const second = encryptTaxExtractionPayload(input);
		assert.notEqual(first.encryption.iv, second.encryption.iv);
		assert.notEqual(first.encryption.ciphertext, second.encryption.ciphertext);
	});

	it("rejects tampered ciphertext, wrong AAD, and wrong key", () => {
		const keys = resolver();
		const message = encryptTaxExtractionPayload({
			jobId: "job-1",
			documentType: "W2",
			schemaVersion: "2026-09-18",
			plaintext: {
				documentId: "doc-1",
				taxYear: 2025,
				filename: "w2.pdf",
				parsedText: "secret-document-text",
			},
			keys,
		});
		assert.equal(
			JSON.stringify(message).includes("secret-document-text"),
			false,
		);
		assert.ok(serializedQueueMessageBytes(message) < 5_000_000);

		const tampered = structuredClone(message);
		tampered.encryption.ciphertext = Buffer.from("aaaa").toString("base64");
		assert.throws(() =>
			decryptTaxExtractionPayload({ message: tampered, keys }),
		);

		const wrongAad = structuredClone(message);
		wrongAad.jobId = "other-job";
		assert.throws(() =>
			decryptTaxExtractionPayload({ message: wrongAad, keys }),
		);

		const otherKeys = resolver();
		assert.throws(
			() => decryptTaxExtractionPayload({ message, keys: otherKeys }),
			TaxLlmDecryptionError,
		);

		const badIv = structuredClone(message);
		badIv.encryption.iv = Buffer.from("short").toString("base64");
		assert.throws(
			() => decryptTaxExtractionPayload({ message: badIv, keys }),
			TaxLlmDecryptionError,
		);
	});
});
