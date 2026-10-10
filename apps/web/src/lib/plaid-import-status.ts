import { toApiUrl } from "~/lib/api-url";
import { clientLogger } from "~/lib/client-logger";

const IMPORT_STATUS_POLL_INTERVAL_MS = 3_000;

/** Mirrors PLAID_TRANSACTIONS_DAYS_REQUESTED; only used if the API omits it. */
const DEFAULT_DAYS_REQUESTED = 365;

export type PlaidImportStatus = {
	historicalImportComplete: boolean;
	updateStatus: string;
	pendingUpdates: boolean;
	transactionCount: number;
	oldestTransactionDate: string | null;
	coveredDays: number;
	daysRequested: number;
};

function asNonNegativeInt(value: unknown): number {
	return typeof value === "number" && Number.isFinite(value) && value >= 0
		? Math.trunc(value)
		: 0;
}

function parsePlaidImportStatus(payload: unknown): PlaidImportStatus | null {
	if (typeof payload !== "object" || payload === null) return null;
	const data = (payload as { data?: unknown }).data;
	if (typeof data !== "object" || data === null) return null;
	const record = data as Record<string, unknown>;
	if (typeof record.historicalImportComplete !== "boolean") return null;
	return {
		historicalImportComplete: record.historicalImportComplete,
		updateStatus:
			typeof record.updateStatus === "string" ? record.updateStatus : "UNKNOWN",
		pendingUpdates: record.pendingUpdates === true,
		transactionCount: asNonNegativeInt(record.transactionCount),
		oldestTransactionDate:
			typeof record.oldestTransactionDate === "string"
				? record.oldestTransactionDate
				: null,
		coveredDays: asNonNegativeInt(record.coveredDays),
		daysRequested:
			asNonNegativeInt(record.daysRequested) || DEFAULT_DAYS_REQUESTED,
	};
}

async function fetchPlaidImportStatus(
	plaidItemDbId: string,
): Promise<PlaidImportStatus> {
	const res = await fetch(
		toApiUrl(
			`/api/v1/plaid/getImportStatus?itemId=${encodeURIComponent(plaidItemDbId)}`,
		),
		{ credentials: "include" },
	);
	if (!res.ok) {
		throw new Error(`Import status request failed (${res.status})`);
	}
	const status = parsePlaidImportStatus(await res.json());
	if (!status) {
		throw new Error(
			"Import status response was missing historicalImportComplete",
		);
	}
	return status;
}

function logHistoricalImportWait(input: {
	plaidItemDbId: string;
	pollCount: number;
	elapsedMs: number;
	outcome: "complete" | "timeout";
	coveredDays?: number;
	transactionCount?: number;
}): void {
	const context = {
		event: "plaid.historical_import_wait",
		feature: "plaid",
		operation: "waitForPlaidHistoricalImport",
		metadata: input,
	};
	if (input.outcome === "timeout") {
		clientLogger.warn("Plaid historical import wait timed out", context);
		return;
	}
	clientLogger.info("Plaid historical import wait completed", context);
}

/**
 * Polls the API until Plaid has delivered the full transaction history for a
 * newly connected item. Connect dialogs stay on "syncing" until this resolves
 * so users see the whole year of data, not just the initial ~30 days.
 */
export async function waitForPlaidHistoricalImport({
	plaidItemDbId,
	timeoutMs,
	onProgress,
}: {
	plaidItemDbId: string;
	timeoutMs: number;
	onProgress?: (status: PlaidImportStatus) => void;
}): Promise<"complete" | "timeout"> {
	const startedAt = Date.now();
	const deadline = startedAt + timeoutMs;
	let pollCount = 0;
	let latest: PlaidImportStatus | undefined;
	while (Date.now() < deadline) {
		pollCount += 1;
		try {
			latest = await fetchPlaidImportStatus(plaidItemDbId);
			onProgress?.(latest);
			if (latest.historicalImportComplete) {
				logHistoricalImportWait({
					plaidItemDbId,
					pollCount,
					elapsedMs: Date.now() - startedAt,
					outcome: "complete",
					coveredDays: latest.coveredDays,
					transactionCount: latest.transactionCount,
				});
				return "complete";
			}
		} catch {
			// Transient poll failures are expected; keep polling until deadline.
		}
		await new Promise((resolve) =>
			setTimeout(resolve, IMPORT_STATUS_POLL_INTERVAL_MS),
		);
	}
	logHistoricalImportWait({
		plaidItemDbId,
		pollCount,
		elapsedMs: Date.now() - startedAt,
		outcome: "timeout",
		coveredDays: latest?.coveredDays,
		transactionCount: latest?.transactionCount,
	});
	return "timeout";
}
