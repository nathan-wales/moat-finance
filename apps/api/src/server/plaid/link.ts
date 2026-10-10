/**
 * Plaid Link token helpers.
 * Encapsulates link token creation so the router stays thin.
 *
 * Server-side only — never import from client code.
 */
import type {
	CountryCode,
	LinkTokenCreateRequest,
	LinkTokenCreateResponse,
	PlaidApi,
	Products,
} from "plaid";
import { logger } from "~/lib/logger";
import { getPlaidClient } from "../lib/plaidClient";
import { getPlaidErrorDetails } from "./errors";
import {
	plaidTransactionsHistoryRequest,
	resolveAdditionalConsentedProducts,
	resolvePlaidLinkProducts,
} from "./link-products";

// ─── Webhook URL ───────────────────────────────────────────────────────────────

/**
 * Webhook URL attached to new Plaid Items.
 *
 * Prefers an explicit PLAID_WEBHOOK. Otherwise derives
 * `<public API origin>/api/webhooks/plaid` from API_BASE_URL or PUBLIC_API_URL,
 * but only for https origins: Plaid cannot deliver to localhost or plain http,
 * and the URL is stored on the Item at link time.
 */
export function resolvePlaidWebhookUrl(): string | undefined {
	const explicit = process.env.PLAID_WEBHOOK?.trim();
	if (explicit) return explicit;

	const apiOrigin = (
		process.env.API_BASE_URL ?? process.env.PUBLIC_API_URL
	)?.trim();
	if (!apiOrigin?.startsWith("https://")) return undefined;
	return `${apiOrigin.replace(/\/+$/, "")}/api/webhooks/plaid`;
}

// ─── Link token creation ───────────────────────────────────────────────────────

interface CreateLinkTokenParams {
	userId: string;
	email?: string;
	isUpdateMode?: boolean;
	/** Required when isUpdateMode=true. Must be decrypted access token. */
	accessToken?: string;
}

type LinkTokenBaseRequest = Omit<
	LinkTokenCreateRequest,
	"products" | "optional_products" | "additional_consented_products"
>;

/**
 * Creates a Plaid Link token for the given user.
 *
 * For initial connection (isUpdateMode=false):
 *   - Requires Transactions only (days_requested=365)
 *   - Requests Investments via optional_products so Link stays unfiltered
 *   - Attaches webhook URL for incremental sync notifications
 *
 * For reconnect/update mode (isUpdateMode=true):
 *   - Creates a Link token for an existing Item repair flow
 *   - Passes the existing access_token as required by Plaid Link update mode
 *   - Does not re-specify products (access_token implies them)
 *   - Requests additional_consented_products for Investments so older Items
 *     can gain the product without being recreated
 */
export async function createPlaidLinkTokenForUser(
	params: CreateLinkTokenParams,
): Promise<LinkTokenCreateResponse> {
	const { userId, isUpdateMode = false, accessToken } = params;
	const client = getPlaidClient();

	const countryCodes = (process.env.PLAID_COUNTRY_CODES ?? "US")
		.split(",")
		.map((c) => c.trim() as CountryCode);

	const webhookUrl = resolvePlaidWebhookUrl();

	const baseRequest: LinkTokenBaseRequest = {
		user: { client_user_id: userId },
		client_name: "Moat Finance",
		country_codes: countryCodes,
		language: "en",
		...(webhookUrl ? { webhook: webhookUrl } : {}),
		...(process.env.PLAID_REDIRECT_URI
			? { redirect_uri: process.env.PLAID_REDIRECT_URI }
			: {}),
	};

	if (isUpdateMode && accessToken) {
		return createUpdateModeLinkToken({
			client,
			baseRequest,
			accessToken,
			userId,
			additionalConsentedProducts: [
				...resolveAdditionalConsentedProducts(),
			] as Products[],
		});
	}

	const { products, optionalProducts } = resolvePlaidLinkProducts();
	try {
		const response = await client.linkTokenCreate({
			...baseRequest,
			products: [...products] as Products[],
			optional_products: [...optionalProducts] as Products[],
			transactions: plaidTransactionsHistoryRequest(),
		});
		return response.data;
	} catch (err) {
		throw linkTokenError(err);
	}
}

/**
 * Update mode drives the "your bank needs attention" repair flow, so a
 * rejected consent add-on must never block it: retry without the extra
 * products so the user can still fix the connection.
 */
async function createUpdateModeLinkToken(input: {
	client: PlaidApi;
	baseRequest: LinkTokenBaseRequest;
	accessToken: string;
	userId: string;
	additionalConsentedProducts: Products[];
}): Promise<LinkTokenCreateResponse> {
	const updateRequest: LinkTokenCreateRequest = {
		...input.baseRequest,
		access_token: input.accessToken,
	};

	if (input.additionalConsentedProducts.length > 0) {
		try {
			const response = await input.client.linkTokenCreate({
				...updateRequest,
				additional_consented_products: input.additionalConsentedProducts,
			});
			return response.data;
		} catch (err) {
			logger.warn(
				"Plaid rejected update-mode link token with additional consented products",
				{
					feature: "plaid",
					operation: "createReconnectLinkToken",
					userId: input.userId,
					errorCode: getPlaidErrorDetails(err).code ?? undefined,
				},
			);
		}
	}

	try {
		const response = await input.client.linkTokenCreate(updateRequest);
		return response.data;
	} catch (err) {
		throw linkTokenError(err);
	}
}

function linkTokenError(err: unknown): Error {
	return new Error(
		`Failed to create Plaid link token: ${err instanceof Error ? err.message : "Plaid API error"}`,
	);
}
