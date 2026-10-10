import type { FinancialDataProvider } from "@moat/financial-data-providers";
import {
	classifyFinicityWebhook,
	classifyMxWebhook,
	classifyPlaidWebhook,
} from "@moat/financial-data-providers";
import type { SyncType } from "./sync-types";

const MX_TX_EVENT_CODES = new Set([
	"aggregation_complete",
	"history_available",
	"data_ready",
]);

export function resolveWebhookSyncType(event: {
	provider: FinancialDataProvider;
	providerConnectionId: string | null;
	eventType: string;
	eventCode: string | null;
}): SyncType | null {
	if (!event.providerConnectionId) return null;

	if (event.provider === "PLAID") {
		if (
			event.eventType === "HOLDINGS" &&
			event.eventCode === "DEFAULT_UPDATE"
		) {
			return "holdings";
		}
		if (classifyPlaidWebhook(event) === "SYNC_CONNECTION") {
			return "transactions";
		}
		return null;
	}

	const eventKey = event.eventCode ?? event.eventType;
	if (eventKey === "balance_changed") {
		return "cached_balances";
	}

	if (event.provider === "MX" && MX_TX_EVENT_CODES.has(eventKey)) {
		return "transactions";
	}
	if (event.provider === "FINICITY" && MX_TX_EVENT_CODES.has(eventKey)) {
		return "transactions";
	}

	if (
		(event.provider === "MX" &&
			classifyMxWebhook(event) === "SYNC_CONNECTION") ||
		(event.provider === "FINICITY" &&
			classifyFinicityWebhook(event) === "SYNC_CONNECTION")
	) {
		return "transactions";
	}

	return null;
}
