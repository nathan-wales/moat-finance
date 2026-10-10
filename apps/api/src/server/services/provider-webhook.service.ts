import crypto from "node:crypto";
import type { FinancialDataProvider } from "@moat/financial-data-providers";
import { logger } from "~/lib/logger";
import { db } from "~/server/db";
import { redactProviderPayload } from "~/server/lib/redaction";
import { isPlaidItemAccessLive } from "../plaid/access-state";
import { ensureFinancialConnectionForPlaidItem } from "./financial-connections.service";
import { enqueueProviderSyncJob } from "./provider-sync-job.service";
import { resolveWebhookSyncType } from "./webhook-sync-type.service";

export async function storeProviderWebhookEvent(input: {
	provider: FinancialDataProvider;
	providerEventId?: string | null;
	providerConnectionId?: string | null;
	eventType: string;
	eventCode?: string | null;
	idempotencyKey?: string | null;
	headers?: Record<string, string>;
	rawPayload: unknown;
	normalizedPayload?: unknown;
	status?: "RECEIVED" | "VERIFIED" | "REJECTED" | "QUEUED";
}) {
	const providerEventId =
		input.providerEventId ??
		createFallbackProviderEventId({
			provider: input.provider,
			providerConnectionId: input.providerConnectionId,
			eventType: input.eventType,
			eventCode: input.eventCode,
			rawPayload: input.rawPayload,
		});
	const idempotencyKey = input.idempotencyKey ?? providerEventId;
	const redactedPayload = redactProviderPayload(input.rawPayload) ?? {};

	try {
		const event = await db.providerWebhookEvent.upsert({
			where: {
				provider_providerEventId: {
					provider: input.provider,
					providerEventId,
				},
			},
			create: {
				provider: input.provider,
				providerEventId,
				providerConnectionId: input.providerConnectionId,
				eventType: input.eventType,
				eventCode: input.eventCode,
				idempotencyKey,
				headers: input.headers,
				rawPayload: redactedPayload as never,
				normalizedPayload: input.normalizedPayload as never,
				status: input.status ?? "VERIFIED",
			},
			update: {
				status: "IGNORED_DUPLICATE",
			},
		});

		if (input.providerConnectionId) {
			const webhookAt = new Date();
			await db.financialConnection.updateMany({
				where: {
					provider: input.provider,
					providerConnectionId: input.providerConnectionId,
				},
				data: { lastWebhookAt: webhookAt },
			});
			if (input.provider === "PLAID") {
				await db.plaidItem.updateMany({
					where: { plaidItemId: input.providerConnectionId },
					data: { lastProviderWebhookAt: webhookAt },
				});
			}
		}

		return event;
	} catch (error) {
		logger.logError("Failed to store provider webhook event", error, {
			feature: "financial_connections",
			operation: "storeProviderWebhookEvent",
			provider: input.provider,
			eventType: input.eventType,
			eventCode: input.eventCode ?? undefined,
		});
		throw error;
	}
}

export async function processProviderWebhookEvent(
	eventId: string,
): Promise<void> {
	const event = await db.providerWebhookEvent.findUnique({
		where: { id: eventId },
	});
	if (!event || !["RECEIVED", "VERIFIED", "QUEUED"].includes(event.status)) {
		return;
	}

	try {
		if (!event.providerConnectionId) {
			await db.providerWebhookEvent.update({
				where: { id: event.id },
				data: {
					status: "PROCESSED",
					processedAt: new Date(),
					errorMessage: "No provider connection id supplied",
				},
			});
			return;
		}

		const syncType = resolveWebhookSyncType({
			provider: event.provider,
			providerConnectionId: event.providerConnectionId,
			eventType: event.eventType,
			eventCode: event.eventCode,
		});

		if (!syncType) {
			await db.providerWebhookEvent.update({
				where: { id: event.id },
				data: { status: "PROCESSED", processedAt: new Date() },
			});
			return;
		}

		let connection = await db.financialConnection.findUnique({
			where: {
				provider_providerConnectionId: {
					provider: event.provider,
					providerConnectionId: event.providerConnectionId,
				},
			},
			select: { id: true, userId: true, status: true },
		});

		if (!connection && event.provider === "PLAID") {
			const plaidItem = await db.plaidItem.findUnique({
				where: { plaidItemId: event.providerConnectionId },
				select: {
					id: true,
					userId: true,
					accessRevokedAt: true,
					accessTokenEncrypted: true,
				},
			});
			if (plaidItem && !isPlaidItemAccessLive(plaidItem)) {
				await db.providerWebhookEvent.update({
					where: { id: event.id },
					data: {
						status: "PROCESSED",
						processedAt: new Date(),
						errorMessage: "Skipped provider sync — Plaid access revoked",
					},
				});
				return;
			}
			if (plaidItem) {
				const ensured = await ensureFinancialConnectionForPlaidItem({
					plaidItemDbId: plaidItem.id,
				});
				connection = {
					id: ensured.connectionId,
					userId: plaidItem.userId,
					status: "ACTIVE",
				};
			}
		}

		if (!connection || connection.status === "DISCONNECTED") {
			await db.providerWebhookEvent.update({
				where: { id: event.id },
				data: {
					status: "PROCESSED",
					processedAt: new Date(),
					errorMessage: !connection
						? "No financial connection found for provider item"
						: "Skipped provider sync — connection disconnected",
				},
			});
			return;
		}

		await enqueueProviderSyncJob({
			userId: connection.userId,
			connectionId: connection.id,
			provider: event.provider,
			syncType,
			syncMode: "cached",
			trigger: "WEBHOOK",
			reason: "provider_webhook",
			webhookEventId: event.id,
		});

		await db.providerWebhookEvent.update({
			where: { id: event.id },
			data: { status: "QUEUED" },
		});

		logger.info("Queued provider webhook sync", {
			event: "provider.webhook_sync_queued",
			feature: "financial_connections",
			operation: "processProviderWebhookEvent",
			userId: connection.userId,
			provider: event.provider,
			eventType: event.eventType,
			eventCode: event.eventCode ?? undefined,
			syncType,
		});
	} catch (error) {
		await db.providerWebhookEvent.update({
			where: { id: event.id },
			data: {
				status: "FAILED",
				processedAt: new Date(),
				errorMessage:
					error instanceof Error ? error.message : "Webhook processing failed",
			},
		});
		throw error;
	}
}

export function safeWebhookHeaders(
	headers: Record<string, string | string[] | undefined>,
): Record<string, string> {
	const allowed = [
		"content-type",
		"user-agent",
		"plaid-verification",
		"x-mx-webhook-event",
		"x-finicity-signature",
	];
	const result: Record<string, string> = {};
	for (const key of allowed) {
		const value = headers[key];
		if (Array.isArray(value)) result[key] = value.join(",");
		else if (value) result[key] = value;
	}
	return result;
}

function createFallbackProviderEventId(input: {
	provider: FinancialDataProvider;
	providerConnectionId?: string | null;
	eventType: string;
	eventCode?: string | null;
	rawPayload: unknown;
}): string {
	const payload =
		typeof input.rawPayload === "object" && input.rawPayload !== null
			? (input.rawPayload as Record<string, unknown>)
			: {};
	const payloadHash = crypto
		.createHash("sha256")
		.update(stableStringify(input.rawPayload))
		.digest("hex");
	return crypto
		.createHash("sha256")
		.update(
			[
				input.provider,
				input.providerConnectionId ?? "",
				input.eventType,
				input.eventCode ?? "",
				String(payload.timestamp ?? payload.created_at ?? ""),
				String(payload.version ?? ""),
				payloadHash,
			].join("|"),
		)
		.digest("hex");
}

function stableStringify(value: unknown): string {
	if (value === null || typeof value !== "object") {
		return JSON.stringify(value) ?? String(value);
	}
	if (Array.isArray(value)) return `[${value.map(stableStringify).join(",")}]`;
	const record = value as Record<string, unknown>;
	return `{${Object.keys(record)
		.sort()
		.map((key) => `${JSON.stringify(key)}:${stableStringify(record[key])}`)
		.join(",")}}`;
}
