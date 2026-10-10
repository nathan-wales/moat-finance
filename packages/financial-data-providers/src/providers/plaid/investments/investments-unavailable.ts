export const PLAID_INVESTMENTS_PRODUCT_UNAVAILABLE_CODES = [
	"INVALID_PRODUCT",
	"PRODUCT_NOT_ENABLED",
	"PRODUCTS_NOT_SUPPORTED",
	"ADDITIONAL_CONSENT_REQUIRED",
	"PRODUCT_NOT_READY",
	"NO_INVESTMENT_ACCOUNTS",
] as const;

const UNAVAILABLE_CODES = new Set<string>(
	PLAID_INVESTMENTS_PRODUCT_UNAVAILABLE_CODES,
);

function extractPlaidErrorCode(error: unknown): string | null {
	if (error && typeof error === "object" && "response" in error) {
		const data = (error as { response?: { data?: { error_code?: string } } })
			.response?.data;
		if (data?.error_code) return data.error_code;
	}
	return null;
}

/**
 * Returns true when holdings/investments APIs cannot run because the Item has
 * not consented to (or does not support) the Investments product.
 */
export function isPlaidInvestmentsProductUnavailable(error: unknown): boolean {
	const code = extractPlaidErrorCode(error);
	if (code) return UNAVAILABLE_CODES.has(code);
	if (error instanceof Error) {
		return [...UNAVAILABLE_CODES].some((unavailableCode) =>
			error.message.includes(unavailableCode),
		);
	}
	return false;
}
