import { PostHog } from "posthog-node";
import { getEnv } from "~/config/env";
import { logger } from "~/lib/logger";

const PROHIBITED_KEYS = new Set([
	"email",
	"name",
	"firstname",
	"lastname",
	"displayname",
	"merchantname",
	"merchant",
	"description",
	"memo",
	"note",
	"accountnumber",
	"routingnumber",
	"accountmask",
	"mask",
	"token",
	"accesstoken",
	"refreshtoken",
	"secret",
	"password",
	"pin",
	"ssn",
	"phonenumber",
	"phone",
	"address",
	"street",
	"zip",
	"postalcode",
	"dob",
	"dateofbirth",
]);

type SafeValue = string | number | boolean | null | undefined;
type SafeProperties = Record<string, SafeValue>;

type AnalyticsIdentity =
	| { userId: string; demoUser?: never }
	| { demoUser: true; userId?: never };

let client: PostHog | null = null;
let initAttempted = false;

function sanitizeProperties(
	properties: Record<string, unknown>,
): SafeProperties {
	const sanitized: SafeProperties = {};
	for (const [key, value] of Object.entries(properties)) {
		if (PROHIBITED_KEYS.has(key.toLowerCase())) {
			if (process.env.NODE_ENV !== "production") {
				logger.warn("Blocked prohibited analytics property", {
					feature: "analytics",
					operation: "sanitize",
					propertyKey: key,
				});
			}
			continue;
		}
		if (
			typeof value === "string" ||
			typeof value === "number" ||
			typeof value === "boolean" ||
			value === null ||
			value === undefined
		) {
			sanitized[key] = value;
		}
	}
	return sanitized;
}

function getClient(): PostHog | null {
	if (initAttempted) return client;
	initAttempted = true;

	const env = getEnv();
	const apiKey = env.POSTHOG_API_KEY;
	if (!apiKey) {
		if (env.NODE_ENV === "development") {
			logger.warn("PostHog API key not set, MCP analytics disabled", {
				feature: "analytics",
				operation: "init",
			});
		}
		return null;
	}

	client = new PostHog(apiKey, {
		host: env.POSTHOG_HOST ?? "https://app.posthog.com",
		flushAt: 1,
		flushInterval: 0,
	});
	return client;
}

export function capture(
	event: string,
	identity: AnalyticsIdentity,
	properties: Record<string, unknown> = {},
): void {
	try {
		const posthog = getClient();
		if (!posthog) return;

		const safe = sanitizeProperties(properties);
		const distinctId = identity.userId ?? "demo-user";
		const identityProps = identity.userId
			? { userId: identity.userId }
			: { demoUser: true };

		posthog.capture({
			distinctId,
			event,
			properties: { ...safe, ...identityProps },
		});
	} catch (error) {
		logger.warn("Failed to capture analytics event", {
			feature: "analytics",
			operation: "capture",
			event,
			errorMessage: error instanceof Error ? error.message : "unknown",
		});
	}
}

export async function shutdownAnalytics(): Promise<void> {
	if (!client) return;
	try {
		await client.shutdown();
	} catch {
		// analytics must never throw
	}
	client = null;
	initAttempted = false;
}
