import { PostHog } from "posthog-node";
import { getCloudAuthIdentity } from "./cloud-auth";

let client: PostHog | null = null;
let initAttempted = false;

function getClient(): PostHog | null {
	if (initAttempted) return client;
	initAttempted = true;

	const apiKey = (
		process.env.POSTHOG_API_KEY ?? process.env.VITE_POSTHOG_KEY
	)?.trim();
	if (!apiKey) return null;

	const host = (
		process.env.POSTHOG_HOST ?? process.env.VITE_POSTHOG_HOST
	)?.trim();
	client = new PostHog(apiKey, {
		host: host || "https://us.posthog.com",
		flushAt: 1,
		flushInterval: 0,
	});
	return client;
}

export async function isMainProcessFeatureEnabled(
	flag: string,
	distinctId: string,
	personProperties?: Record<string, string>,
): Promise<boolean> {
	const posthog = getClient();
	if (!posthog) return false;
	try {
		const enabled = await posthog.isFeatureEnabled(flag, distinctId, {
			personProperties,
			sendFeatureFlagEvents: false,
		});
		return enabled === true;
	} catch {
		return false;
	}
}

export function captureMainProcessEvent(
	event: string,
	properties: Record<string, string | number | boolean | null | undefined> = {},
): void {
	try {
		const posthog = getClient();
		if (!posthog) return;

		let distinctId = "desktop-main";
		let identityProps: { userId: string } | { demoUser: true } = {
			demoUser: true,
		};
		const identity = getCloudAuthIdentity();
		if (identity.signedIn && identity.userId) {
			distinctId = identity.userId;
			identityProps = { userId: identity.userId };
		}

		posthog.capture({
			distinctId,
			event,
			properties: { ...properties, ...identityProps, platform: "desktop" },
		});
	} catch {
		// analytics must never throw
	}
}
