import { checkFixedWindowRateLimit } from "./fixed-window-rate-limit.service";

export type IpRateLimitResult = {
	allowed: boolean;
	limit: number;
	remaining: number;
	resetAt: Date;
};

export function checkIpRateLimit(input: {
	ipAddress: string;
	operation: string;
	limit: number;
	windowMs?: number;
}): IpRateLimitResult {
	return checkFixedWindowRateLimit({
		key: `ip:${input.ipAddress}:${input.operation}`,
		limit: input.limit,
		windowMs: input.windowMs,
	});
}
