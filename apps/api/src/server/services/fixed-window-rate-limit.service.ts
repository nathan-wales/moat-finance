export type FixedWindowRateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: Date;
};

const inMemoryCounts = new Map<string, { count: number; expiresAt: number }>();

function pruneExpiredBuckets(now: number): void {
	for (const [key, bucket] of inMemoryCounts) {
		if (bucket.expiresAt <= now) {
			inMemoryCounts.delete(key);
		}
	}
}

/**
 * Best-effort per-instance limiter. Serverless instances do not share the bucket map, so this
 * bounds runaway clients rather than enforcing a global quota.
 */
export function checkFixedWindowRateLimit(input: {
	key: string;
	limit: number;
	windowMs?: number;
}): FixedWindowRateLimitResult {
	const windowMs = input.windowMs ?? 60_000;
	const now = Date.now();
	pruneExpiredBuckets(now);

	const windowStart = Math.floor(now / windowMs) * windowMs;
	const resetAt = new Date(windowStart + windowMs);
	const bucketKey = `${input.key}:${windowStart}`;
	const bucket = inMemoryCounts.get(bucketKey);
	const count = bucket ? bucket.count + 1 : 1;

	inMemoryCounts.set(bucketKey, {
		count,
		expiresAt: resetAt.getTime(),
	});

	return {
		allowed: count <= input.limit,
		limit: input.limit,
		remaining: Math.max(0, input.limit - count),
		resetAt,
	};
}
