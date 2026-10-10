/**
 * Shared redaction utilities for Moat Finance.
 *
 * Use these before storing, logging, or transmitting data that may contain
 * sensitive fields. The goal is minimization: only keep what is needed.
 *
 * Rules:
 * - Never log or store bank credentials, account numbers, routing numbers,
 *   raw tokens, TOTP secrets, or backup codes.
 * - Redact known-sensitive keys from objects before storing raw payloads.
 * - When normalized fields are sufficient, do not store raw provider payloads at all.
 */

/** Keys that should never appear in stored payloads, logs, or analytics */
const SENSITIVE_KEYS = new Set([
	// Credentials
	"password",
	"pin",
	"passcode",
	"secret",
	"privateKey",
	"private_key",
	// Tokens
	"access_token",
	"accessToken",
	"refresh_token",
	"refreshToken",
	"id_token",
	"idToken",
	"token",
	"apiKey",
	"api_key",
	// Auth / 2FA
	"totp",
	"otp",
	"twoFactorSecret",
	"two_factor_secret",
	"backupCode",
	"backup_code",
	"backupCodes",
	"backup_codes",
	// Financial identifiers
	"accountNumber",
	"account_number",
	"routingNumber",
	"routing_number",
	"ssn",
	"socialSecurityNumber",
	"social_security_number",
	"taxId",
	"tax_id",
	"ein",
	// PII
	"email",
	"phone",
	"phoneNumber",
	"phone_number",
	"dateOfBirth",
	"date_of_birth",
	"dob",
]);

const REDACTED = "[REDACTED]";

/**
 * Recursively redact known-sensitive keys from a plain object.
 * Returns a new object — does not mutate the original.
 *
 * Only traverses plain objects and arrays; leaves primitives and class instances untouched.
 */
export function redactSensitiveFields(value: unknown, depth = 0): unknown {
	// Guard against circular references / very deep objects
	if (depth > 10) return "[depth-limit]";

	if (Array.isArray(value)) {
		return value.map((item) => redactSensitiveFields(item, depth + 1));
	}

	if (value !== null && typeof value === "object" && !(value instanceof Date)) {
		const result: Record<string, unknown> = {};
		for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
			if (SENSITIVE_KEYS.has(key)) {
				result[key] = REDACTED;
			} else {
				result[key] = redactSensitiveFields(val, depth + 1);
			}
		}
		return result;
	}

	return value;
}

/**
 * Redact a raw provider/webhook payload for safe storage or logging.
 *
 * Removes known-sensitive keys and returns the cleaned object.
 * If the payload is not a plain object, returns null (do not store it).
 */
export function redactProviderPayload(
	payload: unknown,
): Record<string, unknown> | null {
	if (
		payload === null ||
		typeof payload !== "object" ||
		Array.isArray(payload)
	) {
		return null;
	}
	return redactSensitiveFields(payload) as Record<string, unknown>;
}

/**
 * Produce a safe log-ready version of an error.
 * Never include ciphertext, plaintext tokens, or raw financial values in error logs.
 */
export function safeErrorContext(error: unknown): Record<string, unknown> {
	if (error instanceof Error) {
		return {
			errorName: error.name,
			errorMessage: error.message,
			// Intentionally omit: stack traces may contain sensitive paths or values in some envs
		};
	}
	return { errorType: typeof error };
}
