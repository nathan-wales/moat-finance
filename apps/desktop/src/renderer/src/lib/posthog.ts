import posthog from "posthog-js";

let initialized = false;

export function initPostHog(): void {
	if (initialized || typeof window === "undefined") return;

	const key = import.meta.env.VITE_POSTHOG_KEY;
	if (!key) {
		if (import.meta.env.DEV) {
			console.warn("PostHog key not set, skipping desktop analytics init");
		}
		return;
	}

	posthog.init(key, {
		api_host: import.meta.env.VITE_POSTHOG_HOST || "https://us.posthog.com",
		capture_pageview: false,
		capture_pageleave: false,
		persistence: "localStorage",
		autocapture: false,
		rageclick: false,
		capture_dead_clicks: false,
		capture_heatmaps: false,
		capture_performance: false,
		capture_exceptions: false,
		disable_session_recording: true,
		disable_surveys: true,
		disable_external_dependency_loading: true,
		enable_recording_console_log: false,
		property_denylist: [
			"$ip",
			"$current_url",
			"$pathname",
			"$referrer",
			"$referring_domain",
		],
	});

	initialized = true;
}

export function isPostHogInitialized(): boolean {
	return initialized;
}

export { posthog };
