/**
 * Desktop renderer analytics wrapper.
 * Event payloads stay { userId } xor { demoUser: true } with no PII.
 * Identify may set account email as a PostHog person property; distinct ID stays userId.
 */

import { posthog } from "~/lib/posthog";

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

let currentIdentity: AnalyticsIdentity = { demoUser: true };

function sanitizeProperties(
	properties: Record<string, unknown>,
): SafeProperties {
	const sanitized: SafeProperties = {};
	for (const [key, value] of Object.entries(properties)) {
		if (PROHIBITED_KEYS.has(key.toLowerCase())) {
			if (import.meta.env.DEV) {
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

export function setAnalyticsIdentity(identity: AnalyticsIdentity): void {
	currentIdentity = identity;
}

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

		posthog.capture(event, {
			...safe,
			...identityProps,
			platform: "desktop",
		});
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

export function identify(userId: string, email?: string | null): void {
	try {
		if (email) {
			posthog.setPersonPropertiesForFlags({ email });
			posthog.identify(userId, { email });
			return;
		}
		posthog.identify(userId);
	} catch {
		// analytics must never throw
	}
}

export function trackPageView(path: string): void {
	try {
		setAnalyticsIdentity(currentIdentity);
		const identityProps = currentIdentity.userId
			? { userId: currentIdentity.userId }
			: { demoUser: true };
		posthog.capture("$pageview", {
			path,
			...identityProps,
			platform: "desktop",
		});
	} catch {
		// analytics must never throw
	}
}
