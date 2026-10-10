export type DeviceRateLimitResult = {
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

export function checkDeviceRateLimit(input: {
	recoveryDeviceId: string;
	operation: string;
	limit: number;
	windowMs?: number;
}): DeviceRateLimitResult {
	const windowMs = input.windowMs ?? 3_600_000;
	const now = Date.now();
	pruneExpiredBuckets(now);

	const windowStart = Math.floor(now / windowMs) * windowMs;
	const resetAt = new Date(windowStart + windowMs);
	const key = `device:${input.recoveryDeviceId}:${input.operation}:${windowStart}`;
	const bucket = inMemoryCounts.get(key);
	const count = bucket ? bucket.count + 1 : 1;

	inMemoryCounts.set(key, {
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
