import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { TaxLlmDecryptionError } from "./encrypt";
import { taxLlmErrorCodeFrom } from "./error-code";
import { IdentifierValidationError } from "./restore";
import { SchemaValidationError } from "./validate";

describe("taxLlmErrorCodeFrom", () => {
	it("uses typed error codes instead of message text", () => {
		assert.equal(
			taxLlmErrorCodeFrom(
				new IdentifierValidationError("employeeSsn token is unknown"),
			),
			"IDENTIFIER_VALIDATION_FAILED",
		);
		assert.equal(
			taxLlmErrorCodeFrom(
				new SchemaValidationError("Invalid numeric value for wages"),
			),
			"SCHEMA_VALIDATION_FAILED",
		);
		assert.equal(
			taxLlmErrorCodeFrom(new TaxLlmDecryptionError()),
			"DECRYPTION_FAILED",
		);
		assert.equal(
			taxLlmErrorCodeFrom(new Error("MODEL_TIMEOUT")),
			"MODEL_TIMEOUT",
		);
		assert.equal(
			taxLlmErrorCodeFrom(new SyntaxError("Unexpected token")),
			"MODEL_INVALID_JSON",
		);
	});
});
