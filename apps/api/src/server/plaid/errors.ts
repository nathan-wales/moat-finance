/**
 * Plaid error detection and normalization helpers.
 * Server-side only — never import from client code.
 */
import { isPlaidInvestmentsProductUnavailable as isInvestmentsUnavailable } from "@moat/financial-data-providers/plaid-investments";
import type { PlaidError } from "plaid";

// ─── Error code constants ────────────────────────────────────────────────────

/**
 * Error code returned by Plaid when data changes during cursor pagination.
 * The correct response is to reset to the starting cursor and restart the loop.
 */
const MUTATION_DURING_PAGINATION_CODE =
	"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";

/** Item/auth error codes that require user reconnect via Plaid Link update mode. */
const RECONNECT_REQUIRED_CODES = new Set([
	"ITEM_LOGIN_REQUIRED",
	"INVALID_CREDENTIALS",
	"INVALID_MFA",
	"USER_SETUP_REQUIRED",
	"MFA_NOT_SUPPORTED",
	"NO_ACCOUNTS",
	"ITEM_LOCKED",
	"USER_PERMISSION_REVOKED",
	"INSTITUTION_NOT_RESPONDING",
	"INSTITUTION_DOWN",
	"INSTITUTION_NO_LONGER_SUPPORTED",
]);

// ─── Raw error extraction ─────────────────────────────────────────────────────

function extractPlaidErrorData(error: unknown): PlaidError | null {
	if (
		error &&
		typeof error === "object" &&
		"response" in error &&
		(error as { response?: { data?: PlaidError } }).response?.data
	) {
		return (error as { response: { data: PlaidError } }).response.data;
	}
	return null;
}

// ─── Public helpers ───────────────────────────────────────────────────────────

/**
 * Returns true when Plaid reports data mutation during cursor pagination.
 * The sync loop must reset to the original cursor and restart from scratch.
 */
export function isPlaidMutationDuringPagination(error: unknown): boolean {
	const data = extractPlaidErrorData(error);
	return data?.error_code === MUTATION_DURING_PAGINATION_CODE;
}

/**
 * Returns true when the error indicates the Plaid Item requires user reconnect.
 * The PlaidItem.requiresReconnect flag should be set and the user surfaced a
 * reconnect prompt.
 */
export function isPlaidReconnectRequired(error: unknown): boolean {
	const data = extractPlaidErrorData(error);
	if (!data?.error_code) {
		if (error instanceof Error) {
			return [...RECONNECT_REQUIRED_CODES].some((c) =>
				error.message.includes(c),
			);
		}
		return false;
	}
	return RECONNECT_REQUIRED_CODES.has(data.error_code);
}

export const isPlaidInvestmentsProductUnavailable = isInvestmentsUnavailable;

/**
 * Extracts a normalized { code, message } from any Plaid API error.
 * Safe to call on non-Plaid errors — returns nulls in that case.
 */
export function getPlaidErrorDetails(error: unknown): {
	code: string | null;
	message: string | null;
} {
	const data = extractPlaidErrorData(error);
	if (data) {
		return {
			code: data.error_code ?? null,
			message: data.error_message ?? data.error_code ?? null,
		};
	}
	if (error instanceof Error) {
		return { code: null, message: error.message };
	}
	return { code: null, message: null };
}
