/**
 * Plaid API client for the desktop main process.
 * Reads credentials from process.env — bundled as env vars in Electron.
 *
 * Main-process only — never import from the renderer.
 */
import {
	Configuration,
	PlaidApi,
	PlaidEnvironments,
	type PlaidError,
} from "plaid";

function getPlaidEnv(): string {
	const override = process.env.PLAID_BASE_PATH?.trim();
	if (override) return override;
	const env = process.env.PLAID_ENV ?? "sandbox";
	if (env === "production") return PlaidEnvironments.production as string;
	if (env === "development") return PlaidEnvironments.development as string;
	return PlaidEnvironments.sandbox as string;
}

function createPlaidClient(): PlaidApi {
	const clientId = process.env.PLAID_CLIENT_ID;
	const secret = process.env.PLAID_SECRET;

	if (!clientId || !secret) {
		throw new Error(
			"PLAID_CLIENT_ID and PLAID_SECRET must be set to use Plaid features. " +
				"Add them to your .env file or set them in the build environment.",
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
