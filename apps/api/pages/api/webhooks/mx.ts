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

function verifyMxBasicAuth(req: NextApiRequest): boolean {
	const username = process.env.MX_WEBHOOK_BASIC_AUTH_USERNAME;
	const password = process.env.MX_WEBHOOK_BASIC_AUTH_PASSWORD;
	if (!username || !password) {
		// Fail closed in production: reject all webhook events when credentials are not set.
		// In non-production, log a warning and allow (for local dev without secrets).
		if (process.env.NODE_ENV === "production") {
			logger.error(
				"MX_WEBHOOK_BASIC_AUTH_USERNAME/PASSWORD not set in production — rejecting webhook",
				{
					feature: "financial_connections",
					operation: "mxWebhook",
				},
			);
			return false;
		}
		logger.warn(
			"MX webhook auth credentials not set — skipping verification (non-production only)",
			{
				feature: "financial_connections",
				operation: "mxWebhook",
			},
		);
		return true;
	}
	const header = req.headers.authorization;
	if (!header?.startsWith("Basic ")) return false;
	const decoded = Buffer.from(header.slice("Basic ".length), "base64").toString(
		"utf8",
	);
	return decoded === `${username}:${password}`;
}

export default async function handler(
	req: NextApiRequest,
	res: NextApiResponse,
) {
	if (req.method !== "POST") {
		return res.status(405).json({ error: "Method not allowed" });
	}
	if (!verifyMxBasicAuth(req)) {
		logger.warn("MX webhook verification failed", {
			feature: "financial_connections",
			operation: "mxWebhook",
		});
		return res.status(401).json({ error: "Invalid webhook credentials" });
	}

	let rawBody: string;
	try {
		rawBody = await readLimitedRawBody(req);
	} catch (error) {
		if (error instanceof RawBodyTooLargeError) {
			logger.warn("MX webhook payload too large", {
				feature: "financial_connections",
				operation: "mxWebhook",
				maxBytes: error.maxBytes,
			});
			return res.status(413).json({ error: "Payload too large" });
		}
		throw error;
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
				readString(payload, "member_guid") ?? readString(payload, "memberGuid");
			const eventType = readString(payload, "type") ?? "mx.webhook";
			const eventCode =
				readString(payload, "code") ??
				readString(payload, "event") ??
				eventType;

			const event = await storeProviderWebhookEvent({
				provider: "MX",
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
				logger.logError("MX webhook processing failed", error, {
					feature: "financial_connections",
					operation: "mxWebhook",
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
	return typeof value === "string" ? value : null;
}
