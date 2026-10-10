/**
 * Centralized Plaid API client configuration.
 * Server-side only — never import from client code.
 */
import {
	Configuration,
	PlaidApi,
	PlaidEnvironments,
	type PlaidError,
} from "plaid";

function getPlaidEnv(): string {
	const override = process.env["PLAID_BASE_PATH"]?.trim();
	if (override) return override;
	const env = process.env["PLAID_ENV"] ?? "sandbox";
	if (env === "production") return PlaidEnvironments.production as string;
	if (env === "development") return PlaidEnvironments.development as string;
	return PlaidEnvironments.sandbox as string;
}

function createPlaidClient(): PlaidApi {
	const clientId = process.env["PLAID_CLIENT_ID"];
	const secret = process.env["PLAID_SECRET"];

	if (!clientId || !secret) {
		throw new Error(
			"PLAID_CLIENT_ID and PLAID_SECRET must be set to use Plaid features.",
		);
	}

	const config = new Configuration({
		basePath: getPlaidEnv(),
		baseOptions: {
			headers: {
				"PLAID-CLIENT-ID": clientId,
				"PLAID-SECRET": secret,
				"Plaid-Version": "2020-09-14",
			},
		},
	});

	return new PlaidApi(config);
}

// Lazy singleton — only instantiated when first accessed
let _client: PlaidApi | null = null;

export function getPlaidClient(): PlaidApi {
	if (!_client) {
		_client = createPlaidClient();
	}
	return _client;
}

export function resetPlaidClientForTests(): void {
	_client = null;
}

/**
 * Returns a normalized error message from a Plaid API error.
 */
export function plaidErrorMessage(err: unknown): string {
	if (
		err &&
		typeof err === "object" &&
		"response" in err &&
		(err as { response?: { data?: PlaidError } }).response?.data
	) {
		const data = (err as { response: { data: PlaidError } }).response.data;
		return data.error_message ?? data.error_code ?? "Plaid API error";
	}
	if (err instanceof Error) return err.message;
	return "Unknown Plaid error";
}

/**
 * Extracts the Plaid error code from an API error, if available.
 */
export function plaidErrorCode(err: unknown): string | null {
	if (
		err &&
		typeof err === "object" &&
		"response" in err &&
		(err as { response?: { data?: PlaidError } }).response?.data
	) {
		return (
			(err as { response: { data: PlaidError } }).response.data.error_code ??
			null
		);
	}
	return null;
}
