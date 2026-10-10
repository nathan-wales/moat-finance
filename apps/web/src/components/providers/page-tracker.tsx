"use client";

import { usePageTracking } from "~/lib/hooks/use-page-tracking";

/**
 * Client component that enables page tracking.
 * Include this in layouts where you want to track page views.
 */
export function PageTracker() {
	usePageTracking();
	return null;
}
