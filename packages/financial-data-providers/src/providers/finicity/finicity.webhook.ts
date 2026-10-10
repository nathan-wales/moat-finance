import type { VerifiedWebhook } from "../../core/types";

const SYNC_EVENT_CODES = new Set([
	"aggregation_complete",
	"history_available",
	"data_ready",
	"balance_changed",
]);

export function classifyFinicityWebhook(input: VerifiedWebhook) {
	const eventKey = input.eventCode ?? input.eventType;
	if (input.providerConnectionId && SYNC_EVENT_CODES.has(eventKey)) {
		return "SYNC_CONNECTION" as const;
	}
	return "IGNORE" as const;
}
