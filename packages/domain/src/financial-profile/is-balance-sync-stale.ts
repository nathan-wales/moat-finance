/** Twice the daily sync cadence — one missed cycle is normal, two means something is wrong. */
export const BALANCE_SYNC_STALE_THRESHOLD_MS = 48 * 60 * 60 * 1000;

export function isBalanceSyncStale(
	lastBalanceSyncAt: Date | null | undefined,
	thresholdMs: number = BALANCE_SYNC_STALE_THRESHOLD_MS,
): boolean {
	if (!lastBalanceSyncAt) return false;
	return Date.now() - lastBalanceSyncAt.getTime() >= thresholdMs;
}
