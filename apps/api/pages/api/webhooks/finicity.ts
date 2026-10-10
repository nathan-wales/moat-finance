import crypto from "node:crypto";
import type { NextApiRequest, NextApiResponse } from "next";
import { logger } from "~/lib/logger";
import {
	RawBodyTooLargeError,
	readLimitedRawBody,
} from "~/server/lib/read-limited-raw-body";
import { withServiceDatabaseActor } from "~/server/lib/with-service-actor";
import {
	processProviderWebhookEvent,
	safeWebhookHeaders,
	storeProviderWebhookEvent,
} from "~/server/services/provider-webhook.service";

export const config = {
	api: { bodyParser: false },
};

function verifyFinicitySignature(
	req: NextApiRequest,
	rawBody: string,
): boolean {
	const secret = process.env.FINICITY_WEBHOOK_SECRET;
	if (!secret) {
		// Fail closed in production: reject all webhook events when secret is not set.
		// In non-production, log a warning and allow (for local dev without secrets).
		if (process.env.NODE_ENV === "production") {
			logger.error(
				"FINICITY_WEBHOOK_SECRET is not set in production — rejecting webhook",
				{
					feature: "financial_connections",
					operation: "finicityWebhook",
				},
			);
			return false;
		}
		logger.warn(
			"FINICITY_WEBHOOK_SECRET not set — skipping verification (non-production only)",
			{
				feature: "financial_connections",
				operation: "finicityWebhook",
			},
		);
		return true;
	}
	const signature = req.headers["x-finicity-signature"];
	const expected = crypto
		.createHmac("sha256", secret)
		.update(rawBody)
		.digest("hex");
	const actual = Array.isArray(signature) ? signature[0] : signature;
	if (!actual) return false;
	if (actual.length !== expected.length) return false;
	return crypto.timingSafeEqual(Buffer.from(expected), Buffer.from(actual));
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}

	let rawBody: string;
	try {
		rawBody = await readLimitedRawBody(req);
	} catch (error) {
		if (error instanceof RawBodyTooLargeError) {
			logger.warn("Finicity webhook payload too large", {
				feature: "financial_connections",
				operation: "finicityWebhook",
				maxBytes: error.maxBytes,
			});
			return res.status(413).json({ error: "Payload too large" });
		}
		throw error;
	}
	if (!verifyFinicitySignature(req, rawBody)) {
		logger.warn("Finicity webhook verification failed", {
			feature: "financial_connections",
			operation: "finicityWebhook",
		});
		return res.status(401).json({ error: "Invalid webhook signature" });
	}

	let payload: Record<string, unknown>;
	try {
		payload = JSON.parse(rawBody) as Record<string, unknown>;
	} catch {
		return res.status(400).json({ error: "Invalid JSON" });
	}

	return withServiceDatabaseActor(
		async () => {
			const providerConnectionId =
				readString(payload, "connectionId") ??
				readString(payload, "aggregationId") ??
				readString(payload, "accountId");
			const eventType = readString(payload, "type") ?? "finicity.webhook";
			const eventCode =
				readString(payload, "code") ??
				readString(payload, "event") ??
				eventType;

			const event = await storeProviderWebhookEvent({
				provider: "FINICITY",
				providerConnectionId,
				eventType,
				eventCode,
				headers: safeWebhookHeaders(req.headers),
				rawPayload: payload,
				normalizedPayload: { providerConnectionId, eventType, eventCode },
				status: "VERIFIED",
			});

			try {
				await processProviderWebhookEvent(event.id);
			} catch (error) {
				logger.logError("Finicity webhook processing failed", error, {
					feature: "financial_connections",
					operation: "finicityWebhook",
					eventId: event.id,
				});
			}

			return res.status(204).end();
		},
		{ timeoutMs: 120_000 },
	);
}

function readString(
	record: Record<string, unknown>,
	key: string,
): string | null {
	const value = record[key];
	if (typeof value === "string") return value;
	if (typeof value === "number") return String(value);
	return null;
}
