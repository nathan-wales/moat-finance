import { TAX_LLM_ERROR_CODES, type TaxLlmErrorCode } from "./constants";

export function isTaxLlmErrorCode(value: unknown): value is TaxLlmErrorCode {
	return (
		typeof value === "string" &&
		(TAX_LLM_ERROR_CODES as readonly string[]).includes(value)
	);
}

export function taxLlmErrorCodeFrom(error: unknown): TaxLlmErrorCode {
	if (
		error &&
		typeof error === "object" &&
		"code" in error &&
		isTaxLlmErrorCode(error.code)
	) {
		return error.code;
	}
	const message = error instanceof Error ? error.message : "";
	if (isTaxLlmErrorCode(message)) return message;
	if (error instanceof SyntaxError) return "MODEL_INVALID_JSON";
	const name = error instanceof Error ? error.name : "";
	if (name === "IdentifierValidationError") {
		return "IDENTIFIER_VALIDATION_FAILED";
	}
	if (name === "SchemaValidationError") return "SCHEMA_VALIDATION_FAILED";
	if (name === "TaxLlmMessageTooLargeError") return "MESSAGE_TOO_LARGE";
	if (name === "TaxLlmDecryptionError") return "DECRYPTION_FAILED";
	return "MODEL_INVALID_JSON";
}
