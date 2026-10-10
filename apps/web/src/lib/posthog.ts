"use client";

import posthog from "posthog-js";

let initialized = false;

export function initPostHog() {
	if (initialized || typeof window === "undefined") return;

	const key = process.env.NEXT_PUBLIC_POSTHOG_KEY;
	if (!key) {
		// Skip initialization in development if key is not set
		if (process.env.NODE_ENV === "development") {
			console.warn("PostHog key not set, skipping initialization");
		}
		return;
	}

	posthog.init(key, {
		api_host: process.env.NEXT_PUBLIC_POSTHOG_HOST || "https://app.posthog.com",
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

export function isPostHogInitialized() {
	return initialized;
}

export { posthog };
