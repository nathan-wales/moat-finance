import { toUtcDateKey } from "@moat/domain";
import { PLAID_TRANSACTIONS_DAYS_REQUESTED } from "@moat/financial-data-providers/plaid-investments";
import { TransactionsUpdateStatus } from "plaid";

export type HistoricalImportUpdateStatus =
	| "NOT_READY"
	| "INITIAL_UPDATE_COMPLETE"
	| "HISTORICAL_UPDATE_COMPLETE"
	| "UNKNOWN"
	| "MUTATION_DURING_PAGINATION";

export type HistoricalImportStatus = {
	historicalImportComplete: boolean;
	updateStatus: HistoricalImportUpdateStatus;
	pendingUpdates: boolean;
	transactionCount: number;
	oldestTransactionDate: string | null;
	coveredDays: number;
	daysRequested: number;
};

export type HistoricalImportProbeSummary = {
	updateStatus: HistoricalImportUpdateStatus;
	hasMore: boolean;
	probeAddedCount: number;
	probeModifiedCount: number;
	probeRemovedCount: number;
	pendingUpdates: boolean;
	shouldDrain: boolean;
	historicalImportComplete: boolean;
};

export type TransactionCoverageSummary = {
	transactionCount: number;
	oldestTransactionDate: string | null;
	coveredDays: number;
	daysRequested: number;
};

const MS_PER_DAY = 86_400_000;

export function normalizeHistoricalImportUpdateStatus(
	raw: string | null | undefined,
): HistoricalImportUpdateStatus {
	if (raw === TransactionsUpdateStatus.HistoricalUpdateComplete) {
		return "HISTORICAL_UPDATE_COMPLETE";
	}
	if (raw === TransactionsUpdateStatus.InitialUpdateComplete) {
		return "INITIAL_UPDATE_COMPLETE";
	}
	if (raw === TransactionsUpdateStatus.NotReady) {
		return "NOT_READY";
	}
	if (raw === "MUTATION_DURING_PAGINATION") {
		return "MUTATION_DURING_PAGINATION";
	}
	return "UNKNOWN";
}

export function coveredDaysFromOldest(
	oldest: Date | null | undefined,
	now: Date,
): number {
	if (!oldest) return 0;
	const oldestMs = Date.parse(`${toUtcDateKey(oldest)}T00:00:00.000Z`);
	const nowMs = Date.parse(`${toUtcDateKey(now)}T00:00:00.000Z`);
	if (Number.isNaN(oldestMs) || Number.isNaN(nowMs) || oldestMs > nowMs) {
		return 0;
	}
	return Math.floor((nowMs - oldestMs) / MS_PER_DAY) + 1;
}

export function summarizeTransactionCoverage(input: {
	transactionCount: number;
	oldestTransactionDate: Date | null | undefined;
	now?: Date;
	daysRequested?: number;
}): TransactionCoverageSummary {
	const daysRequested =
		input.daysRequested ?? PLAID_TRANSACTIONS_DAYS_REQUESTED;
	const oldestTransactionDate = input.oldestTransactionDate
		? toUtcDateKey(input.oldestTransactionDate)
		: null;
	return {
		transactionCount: input.transactionCount,
		oldestTransactionDate,
		coveredDays: Math.min(
			daysRequested,
			coveredDaysFromOldest(
				input.oldestTransactionDate,
				input.now ?? new Date(),
			),
		),
		daysRequested,
	};
}

export function summarizeHistoricalImportProbe(probe: {
	transactions_update_status?: string | null;
	has_more?: boolean;
	added?: unknown[];
	modified?: unknown[];
	removed?: unknown[];
}): HistoricalImportProbeSummary {
	const updateStatus = normalizeHistoricalImportUpdateStatus(
		probe.transactions_update_status,
	);
	const hasMore = Boolean(probe.has_more);
	const probeAddedCount = probe.added?.length ?? 0;
	const probeModifiedCount = probe.modified?.length ?? 0;
	const probeRemovedCount = probe.removed?.length ?? 0;
	const pendingUpdates =
		hasMore ||
		probeAddedCount > 0 ||
		probeModifiedCount > 0 ||
		probeRemovedCount > 0;
	const shouldDrain = pendingUpdates;
	const historicalImportComplete =
		updateStatus === "HISTORICAL_UPDATE_COMPLETE" && !pendingUpdates;

	return {
		updateStatus,
		hasMore,
		probeAddedCount,
		probeModifiedCount,
		probeRemovedCount,
		pendingUpdates,
		shouldDrain,
		historicalImportComplete,
	};
}

export function emptyHistoricalImportStatus(
	overrides: Partial<HistoricalImportStatus> = {},
): HistoricalImportStatus {
	return {
		historicalImportComplete: false,
		updateStatus: "UNKNOWN",
		pendingUpdates: false,
		transactionCount: 0,
		oldestTransactionDate: null,
		coveredDays: 0,
		daysRequested: PLAID_TRANSACTIONS_DAYS_REQUESTED,
		...overrides,
	};
}

export function assembleHistoricalImportStatus(input: {
	summary: HistoricalImportProbeSummary;
	coverage: TransactionCoverageSummary;
}): HistoricalImportStatus {
	return {
		historicalImportComplete: input.summary.historicalImportComplete,
		updateStatus: input.summary.updateStatus,
		pendingUpdates: input.summary.pendingUpdates,
		transactionCount: input.coverage.transactionCount,
		oldestTransactionDate: input.coverage.oldestTransactionDate,
		coveredDays: input.coverage.coveredDays,
		daysRequested: input.coverage.daysRequested,
	};
}
