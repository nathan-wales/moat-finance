/**
 * Plaid error detection and normalization.
 * Ported from apps/api/src/server/plaid/errors.ts — pure logic, no deps.
 *
 * Main-process only — never import from the renderer.
 */
import type { PlaidError } from "plaid";

const MUTATION_DURING_PAGINATION_CODE =
	"TRANSACTIONS_SYNC_MUTATION_DURING_PAGINATION";

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

export function isPlaidMutationDuringPagination(error: unknown): boolean {
	const data = extractPlaidErrorData(error);
	return data?.error_code === MUTATION_DURING_PAGINATION_CODE;
}

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
