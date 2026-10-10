/**
 * Retries transaction sync after connect when Plaid returns an empty
 * "product not ready" response, then keeps polling for the rest of
 * `days_requested` history.
 *
 * Desktop has no Plaid webhooks. The first `/transactions/sync` typically
 * returns ~30 recent days; HISTORICAL_UPDATE on web triggers another sync
 * for the rest of the year. Here we poll with backoff until catch-up or
 * the retry budget is exhausted.
 *
 * Callers should await `waitForTransactionsProductReady` so the UI can
 * proceed once accounts exist, then detach `catchUpHistoricalTransactions`.
 *
 * Main-process only — never import from the renderer.
 */
import type { SqliteDbClient } from "@moat/db-sqlite";
import { emptyTransactionSyncAudit } from "@moat/domain";
import { remoteLogger } from "../lib/remote-logger";
import { getPlaidErrorDetails } from "./errors";
import {
	type SyncTransactionsResult,
	syncTransactionsForItem,
} from "./sync-transactions";

function logRetryAttemptFailure(phase: string, err: unknown): void {
	const { code, message } = getPlaidErrorDetails(err);
	remoteLogger.warn("Plaid initial sync retry attempt failed", {
		event: "plaid.initial_sync_retry_attempt_failed",
		feature: "plaid",
		operation: phase,
		metadata: {
			code: code ?? "unknown",
			errorMessage: message ?? "unknown",
		},
	});
}

export const PRODUCT_NOT_READY_RETRY_DELAYS_MS = [
	3_000, 8_000, 20_000, 45_000, 90_000,
] as const;

/** Backoff totaling ~10 minutes after the first non-empty page. */
export const HISTORICAL_CATCH_UP_RETRY_DELAYS_MS = [
	20_000, 40_000, 60_000, 90_000, 120_000, 150_000, 120_000,
] as const;

function delaysFromNamedEnv(name: string): number[] | undefined {
	const raw = process.env[name]?.trim();
	if (!raw) return undefined;
	const parsed = raw
		.split(",")
		.map((part) => Number(part.trim()))
		.filter((value) => Number.isFinite(value) && value >= 0);
	return parsed.length > 0 ? parsed : undefined;
}

function delaysFromEnv(): number[] | undefined {
	return delaysFromNamedEnv("PLAID_CATCH_UP_DELAYS_MS");
}

function historicalDelaysFromEnv(): number[] | undefined {
	return (
		delaysFromNamedEnv("PLAID_HISTORICAL_CATCH_UP_DELAYS_MS") ?? delaysFromEnv()
	);
}

const pendingByItemId = new Map<string, { cancelled: boolean }>();

export function isTransactionsProductNotReady(
	result: SyncTransactionsResult,
): boolean {
	return (
		result.addedCount === 0 &&
		result.modifiedCount === 0 &&
		result.removedCount === 0 &&
		!result.nextCursor
	);
}

export function nextHistoricalCatchUpState(input: {
	sawPostReadyAdds: boolean;
	addedCount: number;
	skippedHistoricalCount?: number;
}): { sawPostReadyAdds: boolean; done: boolean } {
	if (input.addedCount > 0) {
		return { sawPostReadyAdds: true, done: false };
	}
	if ((input.skippedHistoricalCount ?? 0) > 0) {
		return { sawPostReadyAdds: true, done: false };
	}
	return {
		sawPostReadyAdds: input.sawPostReadyAdds,
		done: input.sawPostReadyAdds,
	};
}

function sleep(ms: number): Promise<void> {
	return new Promise((resolve) => setTimeout(resolve, ms));
}

export function cancelInitialTransactionSyncRetries(
	plaidItemDbId: string,
): void {
	const pending = pendingByItemId.get(plaidItemDbId);
	if (pending) pending.cancelled = true;
	pendingByItemId.delete(plaidItemDbId);
}

export function createInitialSyncRetryState(plaidItemDbId: string): {
	cancelled: boolean;
} {
	cancelInitialTransactionSyncRetries(plaidItemDbId);
	const state = { cancelled: false };
	pendingByItemId.set(plaidItemDbId, state);
	return state;
}

export function finishInitialSyncRetry(
	plaidItemDbId: string,
	state: { cancelled: boolean },
): void {
	if (pendingByItemId.get(plaidItemDbId) === state) {
		pendingByItemId.delete(plaidItemDbId);
	}
}

const EMPTY_RESULT: SyncTransactionsResult = {
	addedCount: 0,
	modifiedCount: 0,
	removedCount: 0,
	nextCursor: null,
	skippedHistoricalCount: 0,
	skippedDisabledAccountCount: 0,
	reconnectOverlapSkipped: 0,
	audit: emptyTransactionSyncAudit(),
};

type CatchUpSync = (input: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	refreshBalances?: boolean;
}) => Promise<SyncTransactionsResult>;

export type DesktopTransactionSyncCatchUpDeps = {
	sync?: CatchUpSync;
	sleep?: (ms: number) => Promise<void>;
	productNotReadyDelays?: readonly number[];
	historicalCatchUpDelays?: readonly number[];
};

type RetryPhaseParams = {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	lastResult?: SyncTransactionsResult;
	state: { cancelled: boolean };
	deps?: DesktopTransactionSyncCatchUpDeps;
};

function resolveSync(
	deps: DesktopTransactionSyncCatchUpDeps | undefined,
): CatchUpSync {
	return deps?.sync ?? syncTransactionsForItem;
}

/**
 * Poll until `/transactions/sync` returns a cursor or rows. Does not run
 * historical catch-up.
 */
export async function waitForTransactionsProductReady(
	params: RetryPhaseParams,
): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, db, state } = params;
	const sync = resolveSync(params.deps);
	const sleepFn = params.deps?.sleep ?? sleep;
	const productNotReadyDelays =
		params.deps?.productNotReadyDelays ??
		delaysFromEnv() ??
		PRODUCT_NOT_READY_RETRY_DELAYS_MS;

	let lastResult = params.lastResult ?? EMPTY_RESULT;
	if (!isTransactionsProductNotReady(lastResult)) {
		return lastResult;
	}

	for (const delay of productNotReadyDelays) {
		await sleepFn(delay);
		if (state.cancelled) return lastResult;

		try {
			lastResult = await sync({
				userId,
				plaidItemDbId,
				db,
				refreshBalances: false,
			});
			if (!isTransactionsProductNotReady(lastResult)) break;
		} catch (err) {
			logRetryAttemptFailure("wait_for_transactions_product_ready", err);
		}
	}

	return lastResult;
}

/**
 * After the product is ready, keep polling until historical pages drain or
 * the retry budget is exhausted. Seed `sawPostReadyAdds` from the first
 * ready page so a connect that already pulled everything does not burn the
 * full ~10 minute budget waiting for a later empty page.
 */
export async function catchUpHistoricalTransactions(
	params: RetryPhaseParams,
): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, db, state } = params;
	const sync = resolveSync(params.deps);
	const sleepFn = params.deps?.sleep ?? sleep;
	const historicalCatchUpDelays =
		params.deps?.historicalCatchUpDelays ??
		historicalDelaysFromEnv() ??
		HISTORICAL_CATCH_UP_RETRY_DELAYS_MS;

	let lastResult = params.lastResult ?? EMPTY_RESULT;
	if (state.cancelled || isTransactionsProductNotReady(lastResult)) {
		return lastResult;
	}

	let sawPostReadyAdds =
		lastResult.addedCount > 0 ||
		lastResult.modifiedCount > 0 ||
		lastResult.removedCount > 0 ||
		(lastResult.skippedHistoricalCount ?? 0) > 0;

	for (const delay of historicalCatchUpDelays) {
		await sleepFn(delay);
		if (state.cancelled) return lastResult;

		try {
			lastResult = await sync({
				userId,
				plaidItemDbId,
				db,
				refreshBalances: false,
			});
			const next = nextHistoricalCatchUpState({
				sawPostReadyAdds,
				addedCount: lastResult.addedCount,
				skippedHistoricalCount: lastResult.skippedHistoricalCount,
			});
			sawPostReadyAdds = next.sawPostReadyAdds;
			if (next.done) return lastResult;
		} catch (err) {
			logRetryAttemptFailure("catch_up_historical_transactions", err);
		}
	}

	return lastResult;
}

/**
 * Awaitable backoff retries for a freshly linked item: wait until the
 * transactions product is ready, then keep polling until historical
 * catch-up drains or the budget is exhausted.
 */
export async function retryInitialTransactionSyncUntilReady(params: {
	userId: string;
	plaidItemDbId: string;
	db: SqliteDbClient;
	lastResult?: SyncTransactionsResult;
	deps?: DesktopTransactionSyncCatchUpDeps;
}): Promise<SyncTransactionsResult> {
	const { userId, plaidItemDbId, db } = params;
	const state = createInitialSyncRetryState(plaidItemDbId);

	try {
		const lastResult = await waitForTransactionsProductReady({
			userId,
			plaidItemDbId,
			db,
			lastResult: params.lastResult,
			state,
			deps: params.deps,
		});
		if (state.cancelled || isTransactionsProductNotReady(lastResult)) {
			return lastResult;
		}

		return await catchUpHistoricalTransactions({
			userId,
			plaidItemDbId,
			db,
			lastResult,
			state,
			deps: params.deps,
		});
	} finally {
		finishInitialSyncRetry(plaidItemDbId, state);
	}
}
