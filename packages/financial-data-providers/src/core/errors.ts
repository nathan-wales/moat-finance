import type { ConnectionStatus, FinancialDataProvider } from "./types";

export type NormalizedProviderErrorCode =
	| "AUTH_EXPIRED"
	| "MFA_REQUIRED"
	| "INSTITUTION_DOWN"
	| "RATE_LIMITED"
	| "TEMPORARY_PROVIDER_ERROR"
	| "ACCOUNT_LOCKED"
	| "CONSENT_REVOKED"
	| "PRODUCT_NOT_SUPPORTED"
	| "UNKNOWN";

export type NormalizedProviderError = {
	provider: FinancialDataProvider;
	code: NormalizedProviderErrorCode;
	message: string;
	retryable: boolean;
	requiresReauth: boolean;
	userActionRequired: boolean;
	providerRawError?: unknown;
};

export function statusForProviderError(
	error: NormalizedProviderError,
): ConnectionStatus {
	switch (error.code) {
		case "AUTH_EXPIRED":
		case "MFA_REQUIRED":
		case "CONSENT_REVOKED":
			return "REAUTH_REQUIRED";
		case "INSTITUTION_DOWN":
		case "TEMPORARY_PROVIDER_ERROR":
		case "RATE_LIMITED":
			return "DEGRADED";
		case "ACCOUNT_LOCKED":
		case "PRODUCT_NOT_SUPPORTED":
		case "UNKNOWN":
			return "ERROR";
	}
}

export function normalizeProviderError(input: {
	provider: FinancialDataProvider;
	error: unknown;
}): NormalizedProviderError {
	const message =
		input.error instanceof Error ? input.error.message : "Provider sync failed";
	const normalizedMessage = message.toLowerCase();

	if (
		normalizedMessage.includes("expired") ||
		normalizedMessage.includes("invalid token") ||
		normalizedMessage.includes("login required")
	) {
		return {
			provider: input.provider,
			code: "AUTH_EXPIRED",
			message,
			retryable: false,
			requiresReauth: true,
			userActionRequired: true,
			providerRawError: input.error,
		};
	}

	if (normalizedMessage.includes("mfa")) {
		return {
			provider: input.provider,
			code: "MFA_REQUIRED",
			message,
			retryable: false,
			requiresReauth: true,
			userActionRequired: true,
			providerRawError: input.error,
		};
	}

	if (normalizedMessage.includes("rate limit")) {
		return {
			provider: input.provider,
			code: "RATE_LIMITED",
			message,
			retryable: true,
			requiresReauth: false,
			userActionRequired: false,
			providerRawError: input.error,
		};
	}

	if (normalizedMessage.includes("unsupported")) {
		return {
			provider: input.provider,
			code: "PRODUCT_NOT_SUPPORTED",
			message,
			retryable: false,
			requiresReauth: false,
			userActionRequired: true,
			providerRawError: input.error,
		};
	}

	return {
		provider: input.provider,
		code: "UNKNOWN",
		message,
		retryable: true,
		requiresReauth: false,
		userActionRequired: false,
		providerRawError: input.error,
	};
}
