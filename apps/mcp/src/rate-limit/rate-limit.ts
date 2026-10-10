import { Redis } from "@upstash/redis";
import { getEnv } from "~/config/env";

export type RateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: Date;
};

let redisClient: Redis | null = null;

const inMemoryCounts = new Map<string, { count: number; expiresAt: number }>();

function getRedis(): Redis | null {
	if (redisClient) return redisClient;
	const env = getEnv();
	if (!env.UPSTASH_REDIS_REST_URL || !env.UPSTASH_REDIS_REST_TOKEN) {
		return null;
	}
	redisClient = new Redis({
		url: env.UPSTASH_REDIS_REST_URL,
		token: env.UPSTASH_REDIS_REST_TOKEN,
	});
	return redisClient;
}

function getWindowKey(input: {
	identifier: string;
	clientName?: string;
	toolName: string;
	windowStart: number;
}) {
	return [
		"mcp-rate",
		input.identifier,
		input.clientName ?? "unknown-client",
		input.toolName,
		String(input.windowStart),
	].join(":");
}

function checkInMemoryRateLimit(input: {
	key: string;
	limit: number;
	resetAt: Date;
}): RateLimitResult {
	const now = Date.now();
	for (const [key, bucket] of inMemoryCounts) {
		if (bucket.expiresAt <= now) inMemoryCounts.delete(key);
	}

	const bucket = inMemoryCounts.get(input.key);
	const count = bucket ? bucket.count + 1 : 1;
	inMemoryCounts.set(input.key, {
		count,
		expiresAt: input.resetAt.getTime(),
	});

	return {
		allowed: count <= input.limit,
		limit: input.limit,
		remaining: Math.max(0, input.limit - count),
		resetAt: input.resetAt,
	};
}

async function checkRateLimitByIdentifier(input: {
	identifier: string;
	clientName?: string;
	toolName: string;
	limit?: number;
}): Promise<RateLimitResult> {
	const limit = input.limit ?? 60;
	const now = Date.now();
	const windowStart = Math.floor(now / 60_000) * 60_000;
	const resetAt = new Date(windowStart + 60_000);
	const key = getWindowKey({ ...input, windowStart });
	const redis = getRedis();

	if (!redis) {
		return checkInMemoryRateLimit({ key, limit, resetAt });
	}

	const count = await redis.incr(key);
	if (count === 1) {
		await redis.expire(key, 90);
	}

	return {
		allowed: count <= limit,
		limit,
		remaining: Math.max(0, limit - count),
		resetAt,
	};
}

export async function checkRateLimit(input: {
	userId: string;
	clientName?: string;
	toolName: string;
	limit?: number;
}): Promise<RateLimitResult> {
	return checkRateLimitByIdentifier({
		identifier: `user:${input.userId}`,
		clientName: input.clientName,
		toolName: input.toolName,
		limit: input.limit,
	});
}

export async function checkAnonymousRateLimit(input: {
	identifier: string;
	operation: string;
	limit?: number;
}): Promise<RateLimitResult> {
	return checkRateLimitByIdentifier({
		identifier: `anonymous:${input.identifier}`,
		clientName: "oauth",
		toolName: input.operation,
		limit: input.limit,
	});
}
