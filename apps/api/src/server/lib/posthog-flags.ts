import { logger } from "~/lib/logger";

/**
 * Flag decisions are cached per process so repeated checks cost one PostHog
 * round trip instead of one per call. Short enough that flipping a flag in
 * PostHog takes effect without a deploy.
 */
const FLAG_CACHE_TTL_MS = 60_000;
const FLAG_CACHE_MAX_ENTRIES = 5_000;

export type FeatureFlagClient = {
	isFeatureEnabled: (
		flag: string,
		distinctId: string,
		options?: {
			personProperties?: Record<string, string>;
			sendFeatureFlagEvents?: boolean;
		},
	) => Promise<boolean | undefined>;
};

let client: FeatureFlagClient | null = null;
let initAttempted = false;
const flagCache = new Map<string, { enabled: boolean; expiresAt: number }>();

function getPostHogApiKey(): string | undefined {
	return process.env.POSTHOG_API_KEY ?? process.env.NEXT_PUBLIC_POSTHOG_KEY;
}

function getPostHogHost(): string {
	return (
		process.env.POSTHOG_HOST ??
		process.env.NEXT_PUBLIC_POSTHOG_HOST ??
		"https://us.posthog.com"
	);
}

async function getClient(): Promise<FeatureFlagClient | null> {
	if (initAttempted) return client;
	initAttempted = true;

	const apiKey = getPostHogApiKey();
	if (!apiKey) {
		return null;
	}

	// Load the SDK only when constructing a real client. Contract tests inject
	// a FeatureFlagClient and never hit this path, so they stay hermetic even
	// if posthog-node is not linked in node_modules.
	try {
		const { PostHog } = await import("posthog-node");
		client = new PostHog(apiKey, {
			host: getPostHogHost(),
			flushAt: 1,
			flushInterval: 0,
			featureFlagsRequestTimeoutMs: 2000,
			fetchRetryCount: 0,
		});
		return client;
	} catch (error) {
		logger.warn("PostHog client initialization failed", {
			feature: "feature-flags",
			operation: "getClient",
			errorMessage: error instanceof Error ? error.message : "unknown",
		});
		return null;
	}
}

function readCachedFlag(cacheKey: string): boolean | undefined {
	const cached = flagCache.get(cacheKey);
	if (!cached) return undefined;
	if (cached.expiresAt <= Date.now()) {
		flagCache.delete(cacheKey);
		return undefined;
	}
	return cached.enabled;
}

function writeCachedFlag(cacheKey: string, enabled: boolean): void {
	if (flagCache.size >= FLAG_CACHE_MAX_ENTRIES) flagCache.clear();
	flagCache.set(cacheKey, {
		enabled,
		expiresAt: Date.now() + FLAG_CACHE_TTL_MS,
	});
}

export async function evaluateFeatureFlag(
	flag: string,
	distinctId: string,
	options?: {
		/**
		 * Resolved only on a cache miss so callers can look the email up from
		 * the database without paying for it on every check.
		 */
		resolveEmail?: () => Promise<string | undefined>;
		client?: FeatureFlagClient | null;
	},
): Promise<boolean> {
	const cacheKey = `${flag}:${distinctId}`;
	const cached = readCachedFlag(cacheKey);
	if (cached !== undefined) return cached;

	const featureFlagClient =
		options && "client" in options ? options.client : await getClient();
	if (!featureFlagClient) return false;

	try {
		const email = await options?.resolveEmail?.();
		const enabled = await featureFlagClient.isFeatureEnabled(flag, distinctId, {
			personProperties: email ? { email } : undefined,
			sendFeatureFlagEvents: false,
		});
		writeCachedFlag(cacheKey, enabled === true);
		return enabled === true;
	} catch (error) {
		// Cache the closed result too: during a PostHog outage a sync job would
		// otherwise pay the request timeout once per connection.
		writeCachedFlag(cacheKey, false);
		logger.warn("PostHog feature flag evaluation failed", {
			feature: "feature-flags",
			operation: "evaluateFeatureFlag",
			flag,
			errorMessage: error instanceof Error ? error.message : "unknown",
		});
		return false;
	}
}

export function resetPostHogFlagsClientForTests(): void {
	client = null;
	initAttempted = false;
	flagCache.clear();
}
