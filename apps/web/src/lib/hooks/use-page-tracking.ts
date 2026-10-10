"use client";

import { usePathname } from "next/navigation";
import { useSession } from "next-auth/react";
import { useEffect } from "react";
import { identify, setAnalyticsIdentity, trackPageView } from "~/lib/analytics";
import { isPostHogInitialized } from "~/lib/posthog";

/**
 * Tracks page views on route changes.
 * Should be called in a layout that wraps all tracked pages.
 *
 * Events include:
 * - `path`: the current pathname
 * - `userId`: if the user is logged in
 * - `demoUser: true`: if the user is not logged in
 */
export function usePageTracking() {
	const pathname = usePathname();
	const { data: session, status } = useSession();

	useEffect(() => {
		if (!isPostHogInitialized()) return;

		const userId = session?.user?.id;
		if (userId) {
			setAnalyticsIdentity({ userId });
			identify(userId, session?.user?.email);
		} else {
			setAnalyticsIdentity({ demoUser: true });
		}
	}, [session]);

	// Track page views
	useEffect(() => {
		if (!isPostHogInitialized()) return;
		if (!pathname) return;
		// Wait for session to load before tracking
		if (status === "loading") return;

		const userId = session?.user?.id;
		trackPageView(pathname, userId ? { userId } : { demoUser: true });
	}, [pathname, session, status]);
}
