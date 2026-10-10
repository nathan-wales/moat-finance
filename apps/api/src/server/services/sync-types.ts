export type SyncMode = "cached" | "realtime";

export type SyncType =
	| "transactions"
	| "cached_balances"
	| "realtime_balances"
	| "holdings"
	| "cached_manual"
	| "connection_health";

export type SyncReason =
	| "scheduled_balance_sync"
	| "scheduled_holdings_sync"
	| "scheduled_transaction_fallback"
	| "app_open_cached_sync"
	| "manual_sync_button"
	| "manual_sync_all"
	| "manual_realtime_balance_refresh"
	| "provider_webhook"
	| "account_connection_created"
	| "payment_risk_check"
	| "reconnect";

export type ProviderCostCategory =
	| "cached_or_included"
	| "billable_per_request"
	| "unknown_contract_dependent";

export type ConnectionSyncResult = {
	success: true;
	addedCount: number;
	modifiedCount: number;
	removedCount: number;
	accountCount: number;
	balancesRefreshed: boolean;
	holdingsSynced: boolean;
};

export type ProviderEndpointCall = {
	endpoint: string;
	costCategory: ProviderCostCategory;
	durationMs: number;
	status: "success" | "error";
};

export function highestCostCategory(
	calls: ProviderEndpointCall[],
): ProviderCostCategory {
	if (calls.some((call) => call.costCategory === "billable_per_request")) {
		return "billable_per_request";
	}
	if (
		calls.some((call) => call.costCategory === "unknown_contract_dependent")
	) {
		return "unknown_contract_dependent";
	}
	return "cached_or_included";
}
