/**
 * Background sync scheduler for Plaid.
 *
 * On startup: syncs all items that haven't been synced in the last 30 minutes.
 * Recurring: re-syncs every 30 minutes.
 *
 * Items with requiresReconnect: true are skipped until the user reconnects.
 *
 * Main-process only — never import from the renderer.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import {
	CACHED_PLAID_SYNC_STALE_MS,
	isCachedPlaidItemStale,
} from "@moat/domain";
import { recordDesktopSyncedAccountHistory } from "../account-balance-history";
import { remoteLogger } from "../lib/remote-logger";
import { LIVE_PLAID_ITEM_WHERE } from "./access-state";
import { getPlaidErrorDetails } from "./errors";
import { maybeSyncHoldingsForItem } from "./sync-holdings";
import { syncTransactionsForItem } from "./sync-transactions";

const SYNC_INTERVAL_MS = CACHED_PLAID_SYNC_STALE_MS;
const SCHEDULER_READY_WAIT_MS = 10_000;

type SchedulerContext = {
	db: SqliteDbClient;
	userId: string;
};

let schedulerContext: SchedulerContext | null = null;

type ScheduledSyncOperation = "startup_sync" | "interval_sync" | "sign_in_sync";

const SCHEDULED_SYNC_FAILURE_MESSAGE: Record<ScheduledSyncOperation, string> = {
	startup_sync: "Plaid startup sync failed",
	interval_sync: "Plaid interval sync failed",
	sign_in_sync: "Plaid post-sign-in sync failed",
};

function logScheduledSyncFailure(
	operation: ScheduledSyncOperation,
	err: unknown,
): void {
	const errorMessage = err instanceof Error ? err.message : "Unknown error";
	console.error(`[plaid-scheduler] ${operation} error:`, err);
	remoteLogger.error(SCHEDULED_SYNC_FAILURE_MESSAGE[operation], {
		event: `plaid.${operation}_failed`,
		feature: "plaid",
		operation,
		metadata: { errorMessage },
	});
}

function queueScheduledSync(operation: ScheduledSyncOperation): void {
	if (!schedulerContext) return;
	const { db, userId } = schedulerContext;
	void runScheduledSync(db, userId).catch((err) => {
		logScheduledSyncFailure(operation, err);
	});
}

function isPlaidItemStale(item: {
	lastSuccessfulSyncAt: Date | null;
	accounts: Array<{ lastBalanceSyncAt: Date | null }>;
}): boolean {
	return isCachedPlaidItemStale({
		lastSuccessfulSyncAt: item.lastSuccessfulSyncAt,
		accountLastBalanceSyncAts: item.accounts.map(
			(account) => account.lastBalanceSyncAt,
		),
	});
}

async function waitForSchedulerContext(): Promise<SchedulerContext | null> {
	const started = Date.now();
	while (!schedulerContext && Date.now() - started < SCHEDULER_READY_WAIT_MS) {
		await new Promise((resolve) => setTimeout(resolve, 100));
	}
	return schedulerContext;
}

/** Kick a cached `/transactions/sync` after cloud sign-in — startup often races the session. */
export async function requestScheduledPlaidSync(): Promise<void> {
	const context = schedulerContext ?? (await waitForSchedulerContext());
	if (!context) return;
	const { db, userId } = context;
	return runScheduledSync(db, userId).catch((err) => {
		logScheduledSyncFailure("sign_in_sync", err);
	});
}

async function runScheduledSync(
	db: SqliteDbClient,
	userId: string,
): Promise<void> {
	const liveItems = (await db.plaidItem.findMany({
		where: {
			userId,
			requiresReconnect: false,
			...LIVE_PLAID_ITEM_WHERE,
		},
		select: {
			id: true,
			institutionName: true,
			lastSuccessfulSyncAt: true,
			accounts: {
				where: { isActive: true },
				select: { lastBalanceSyncAt: true },
			},
		},
	})) as Array<{
		id: string;
		institutionName: string;
		lastSuccessfulSyncAt: Date | null;
		accounts: Array<{ lastBalanceSyncAt: Date | null }>;
	}>;

	const items = liveItems.filter((item) => isPlaidItemStale(item));

	if (items.length > 0) {
		console.log(`[plaid-scheduler] Syncing ${items.length} stale item(s)…`);
		for (const item of items) {
			try {
				const result = await syncTransactionsForItem({
					userId,
					plaidItemDbId: item.id,
					db,
					refreshBalances: true,
				});
				const holdingsSynced = await maybeSyncHoldingsForItem({
					userId,
					plaidItemDbId: item.id,
					db,
				});
				console.log(
					`[plaid-scheduler] ${item.institutionName}: ` +
						`+${result.addedCount} ~${result.modifiedCount} -${result.removedCount}` +
						(holdingsSynced ? " holdings" : ""),
				);
			} catch (err) {
				const { code, message } = getPlaidErrorDetails(err);
				console.error(
					`[plaid-scheduler] Sync failed for ${item.institutionName}:`,
					{ code, message },
				);
				remoteLogger.error("Plaid scheduled sync failed", {
					event: "plaid.scheduled_sync_failed",
					feature: "plaid",
					operation: "scheduled_sync",
					metadata: {
						code: code ?? "unknown",
						errorMessage: message ?? "unknown",
					},
				});
			}
		}
	}

	try {
		await recordDesktopSyncedAccountHistory({ db, userId });
	} catch (error) {
		console.error(
			"[account-balance-history] Failed after scheduled sync",
			error,
		);
	}
}

let stopScheduler: (() => void) | null = null;

export function startPlaidSyncScheduler(
	db: SqliteDbClient,
	userId: string,
): () => void {
	if (stopScheduler) {
		stopScheduler();
	}
	stopScheduler = startPlaidSyncSchedulerInternal(db, userId);
	return stopScheduler;
}

export function stopPlaidSyncScheduler(): void {
	stopScheduler?.();
	stopScheduler = null;
}

function startPlaidSyncSchedulerInternal(
	db: SqliteDbClient,
	userId: string,
): () => void {
	schedulerContext = { db, userId };
	queueScheduledSync("startup_sync");

	const interval = setInterval(() => {
		queueScheduledSync("interval_sync");
	}, SYNC_INTERVAL_MS);

	return () => {
		clearInterval(interval);
		schedulerContext = null;
	};
}
