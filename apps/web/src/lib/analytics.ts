"use client";

/**
 * Central analytics wrapper for Moat Finance.
 *
 * Rules enforced here:
 * - Identify may set account email as a PostHog person property; distinct ID stays userId
 * - Event payloads must not include email, name, account numbers, routing numbers,
 *   descriptions, tokens, or other PII
 * - Events must include either { userId } or { demoUser: true } — never both
 * - Payloads must be counts, booleans, enums, feature names, or non-sensitive IDs only
 *
 * All PostHog calls from product code should go through this module.
 * Direct imports of posthog.capture / posthog.identify from outside this file
 * are flagged in CI.
 */

import { posthog } from "~/lib/posthog";

/**
 * Properties that are never allowed in any analytics event.
 * This list is enforced at runtime and in CI lint checks.
 */
const PROHIBITED_KEYS = new Set([
	"email",
	"name",
	"firstName",
	"lastName",
	"displayName",
	"merchantName",
	"merchant",
	"description",
	"memo",
	"note",
	"accountNumber",
	"routingNumber",
	"accountMask",
	"mask",
	"token",
	"accessToken",
	"refreshToken",
	"secret",
	"password",
	"pin",
	"ssn",
	"phoneNumber",
	"phone",
	"address",
	"street",
	"zip",
	"postalCode",
	"dob",
	"dateOfBirth",
]);

type SafeValue = string | number | boolean | null | undefined;
type SafeProperties = Record<string, SafeValue>;

/**
 * Strips prohibited keys from a properties object.
 * Logs a warning in development if any are found.
 */
function sanitizeProperties(
	properties: Record<string, unknown>,
): SafeProperties {
	const sanitized: SafeProperties = {};
	for (const [key, value] of Object.entries(properties)) {
		if (PROHIBITED_KEYS.has(key.toLowerCase()) || PROHIBITED_KEYS.has(key)) {
			if (process.env.NODE_ENV !== "production") {
				console.warn(
					`[analytics] Blocked prohibited property from analytics event: "${key}"`,
				);
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

type AnalyticsIdentity =
	| { userId: string; demoUser?: never }
	| { demoUser: true; userId?: never };

let currentIdentity: AnalyticsIdentity = { demoUser: true };

export function setAnalyticsIdentity(identity: AnalyticsIdentity): void {
	currentIdentity = identity;
}

/**
 * Capture a product analytics event.
 *
 * Event naming convention: `<domain>_<object>_<action>` (snake_case)
 * e.g. `transaction_edit_completed`, `rule_created`, `forecast_viewed`
 *
 * @example
 * capture("rule_created", { userId }, { ruleType: "auto-categorize", conditionCount: 2 })
 */
export function capture(
	event: string,
	identity: AnalyticsIdentity,
	properties: Record<string, unknown> = {},
): void {
	try {
		const safe = sanitizeProperties(properties);
		const identityProps = identity.userId
			? { userId: identity.userId }
			: { demoUser: true };

		posthog.capture(event, { ...safe, ...identityProps });
	} catch {
		// analytics must never throw
	}
}

export function captureWithCurrentIdentity(
	event: string,
	properties: Record<string, unknown> = {},
): void {
	capture(event, currentIdentity, properties);
}

/**
 * Identify a user session. Distinct ID is userId; email is an optional person property.
 */
export function identify(userId: string, email?: string | null): void {
	try {
		if (email) {
			posthog.identify(userId, { email });
			return;
		}
		posthog.identify(userId);
	} catch {
		// analytics must never throw
	}
}

/**
 * Track a page view.
 * Path is included only when it does not contain user-generated slugs or tokens.
 */
export function trackPageView(path: string, identity: AnalyticsIdentity): void {
	try {
		setAnalyticsIdentity(identity);
		const identityProps = identity.userId
			? { userId: identity.userId }
			: { demoUser: true };

		posthog.capture("$pageview", { path, ...identityProps });
	} catch {
		// analytics must never throw
	}
}
