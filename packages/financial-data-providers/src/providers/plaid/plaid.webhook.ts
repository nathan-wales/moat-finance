import type { VerifiedWebhook } from "../../core/types";

const PLAID_TRANSACTION_SYNC_EVENT_CODES = new Set([
	"SYNC_UPDATES_AVAILABLE",
	"INITIAL_UPDATE",
	"HISTORICAL_UPDATE",
	"DEFAULT_UPDATE",
]);

export function classifyPlaidWebhook(
	input: Pick<
		VerifiedWebhook,
		"providerConnectionId" | "eventType" | "eventCode"
	>,
) {
	if (
		input.providerConnectionId &&
		input.eventType === "TRANSACTIONS" &&
		input.eventCode != null &&
		PLAID_TRANSACTION_SYNC_EVENT_CODES.has(input.eventCode)
	) {
		return "SYNC_CONNECTION" as const;
	}
	return "IGNORE" as const;
}
