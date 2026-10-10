export const CACHED_PLAID_SYNC_STALE_MS = 30 * 60 * 1000;

function isTimestampStale(
	value: Date | null | undefined,
	staleThresholdMs: number,
): boolean {
	if (!value) return true;
	return value.getTime() < staleThresholdMs;
}

export function isCachedPlaidItemStale(input: {
	lastSuccessfulSyncAt: Date | null | undefined;
	accountLastBalanceSyncAts: Array<Date | null | undefined>;
	nowMs?: number;
	staleMs?: number;
}): boolean {
	const nowMs = input.nowMs ?? Date.now();
	const staleThresholdMs =
		nowMs - (input.staleMs ?? CACHED_PLAID_SYNC_STALE_MS);
	if (isTimestampStale(input.lastSuccessfulSyncAt, staleThresholdMs)) {
		return true;
	}
	if (input.accountLastBalanceSyncAts.length === 0) return true;
	return input.accountLastBalanceSyncAts.some((value) =>
		isTimestampStale(value, staleThresholdMs),
	);
}
