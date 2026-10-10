/**
 * Plaid webhook handler.
 *
 * Processes Plaid TRANSACTIONS / SYNC_UPDATES_AVAILABLE events to trigger
 * incremental transaction sync for the affected item.
 *
 * Design notes:
 *   - Idempotent: duplicate deliveries are safe because sync is serialized
 *     by the per-item advisory lock in syncTransactions.ts.
 *   - Returns 200 for all recognized event types, even if sync fails, so
 *     Plaid does not keep retrying indefinitely on transient errors.
 *   - Returns 200 for unrecognized event types (unknown codes are logged).
 *   - Never logs or exposes sensitive payload data (access tokens, PII).
 *
 * v1 inline sync: Vercel/Next.js function timeout should be verified against
 * expected sync duration. For large accounts the initial sync may exceed
 * standard timeout budgets — consider enqueuing for long-running items.
 */
import crypto from "node:crypto";
import jwt from "jsonwebtoken";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import { getPlaidClient } from "~/server/lib/plaidClient";
import {
	RawBodyTooLargeError,
	readLimitedRawBody,
} from "~/server/lib/read-limited-raw-body";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import type { PlaidWebhookPayload } from "~/server/plaid/types";
import {
	processProviderWebhookEvent,
	safeWebhookHeaders,
	storeProviderWebhookEvent,
} from "~/server/services/provider-webhook.service";

// Disable Next.js body parsing — we need the raw body to verify the signature.
export const config = {
	api: { bodyParser: false },
};

// Cache Plaid webhook verification keys by kid to avoid repeated API calls.
const keyCache = new Map<string, crypto.KeyObject>();

/**
 * Verifies the Plaid-Verification JWT header and checks the request body hash.
 * Throws if verification fails.
 */
async function verifyPlaidSignature(
	rawBody: string,
	verificationHeader: string | undefined,
): Promise<void> {
	if (!verificationHeader) {
		throw new Error("Missing Plaid-Verification header");
	}

	// Decode the JWT header to get the key ID (kid) — no verification yet.
	const decoded = jwt.decode(verificationHeader, { complete: true });
	if (
		!decoded ||
		typeof decoded === "string" ||
		typeof decoded.header?.kid !== "string"
	) {
		throw new Error("Invalid Plaid-Verification JWT structure");
	}

	const kid: string = decoded.header.kid;

	// Fetch (or use cached) Plaid EC public key for this kid.
	let publicKey = keyCache.get(kid);
	if (!publicKey) {
		const plaidClient = getPlaidClient();
		const { data } = await plaidClient.webhookVerificationKeyGet({
			key_id: kid,
		});
		// data.key is a JWK object — convert to a Node KeyObject.
		publicKey = crypto.createPublicKey({
			key: data.key as unknown as crypto.JsonWebKey,
			format: "jwk",
		});
		keyCache.set(kid, publicKey);
	}

	// Export as PEM so jsonwebtoken can verify the ES256 signature.
	const pemKey = publicKey.export({ type: "spki", format: "pem" });

	let payload: jwt.JwtPayload;
	try {
		const verified = jwt.verify(verificationHeader, pemKey, {
			algorithms: ["ES256"],
		});
		if (typeof verified === "string") throw new Error("Unexpected JWT format");
		payload = verified;
	} catch (err) {
		throw new Error(
			`Plaid-Verification JWT signature invalid: ${err instanceof Error ? err.message : String(err)}`,
		);
	}

	// Verify the request body hash matches what Plaid signed.
	const expectedHash =
		typeof payload.request_body_sha256 === "string"
			? payload.request_body_sha256
			: null;
	if (!expectedHash) {
		throw new Error("Plaid-Verification JWT missing request_body_sha256 claim");
	}
	const actualHash = crypto.createHash("sha256").update(rawBody).digest("hex");
	if (actualHash !== expectedHash) {
		throw new Error("Plaid-Verification body hash mismatch");
	}

	// Reject webhooks older than 5 minutes to prevent replay attacks.
	const iat = payload.iat;
	if (typeof iat !== "number" || Date.now() / 1000 - iat > 300) {
		throw new Error("Plaid-Verification JWT is expired or missing iat");
	}
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	// Read and verify the raw body before parsing JSON.
	let rawBody: string;
	try {
		rawBody = await readLimitedRawBody(req);
	} catch (error) {
		if (error instanceof RawBodyTooLargeError) {
			logger.warn("Plaid webhook payload too large", {
				feature: "plaid",
				operation: "webhook",
				maxBytes: error.maxBytes,
			});
			return res.status(413).json({ error: "Payload too large" });
		}
		throw error;
	}

	const verificationHeader = Array.isArray(req.headers["plaid-verification"])
		? req.headers["plaid-verification"][0]
		: req.headers["plaid-verification"];

	try {
		await verifyPlaidSignature(rawBody, verificationHeader);
	} catch (err) {
		logger.warn("Plaid webhook signature verification failed", {
			feature: "plaid",
			operation: "webhook",
			reason: err instanceof Error ? err.message : String(err),
		});
		return res.status(401).json({ error: "Invalid webhook signature" });
	}

	let payload: PlaidWebhookPayload;
	try {
		payload = JSON.parse(rawBody) as PlaidWebhookPayload;
	} catch {
		return res.status(400).json({ error: "Invalid JSON" });
	}

	return withServiceDatabaseActor(
		async () => {
			const { webhook_type, webhook_code, item_id } = payload;
			const event = await storeProviderWebhookEvent({
				provider: "PLAID",
				providerConnectionId: item_id ?? null,
				eventType: webhook_type,
				eventCode: webhook_code,
				headers: safeWebhookHeaders(req.headers),
				rawPayload: payload,
				normalizedPayload: {
					webhookType: webhook_type,
					webhookCode: webhook_code,
					itemIdPresent: Boolean(item_id),
				},
				status: "VERIFIED",
			});

			if (!item_id) {
				logger.warn("Plaid webhook missing item_id", {
					feature: "plaid",
					operation: "webhook",
					webhookCode: webhook_code,
					webhookType: webhook_type,
				});
			}

			try {
				await processProviderWebhookEvent(event.id);
			} catch (err) {
				logger.logError("Webhook enqueue failed", err, {
					feature: "plaid",
					operation: "webhook",
					webhookType: webhook_type,
					webhookCode: webhook_code,
					plaidItemIdPrefix: item_id?.slice(0, 8),
				});
			}

			return res.status(204).end();
		},
		{ timeoutMs: 120_000 },
	);
}
