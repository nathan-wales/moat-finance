"use client";

import { useSession } from "next-auth/react";
import { useEffect, useRef } from "react";
import { capture } from "~/lib/analytics";
import {
	captureMarketingAttributionFromLocation,
	readStoredMarketingAttribution,
} from "~/lib/marketing-attribution";

const SIGNUP_EVENT_KEY = "moat_signup_attribution_tracked";

export function MarketingAttributionCapture() {
	const { data: session } = useSession();
	const capturedVisit = useRef(false);

	useEffect(() => {
		if (capturedVisit.current) return;
		capturedVisit.current = true;
		captureMarketingAttributionFromLocation();
	}, []);

	useEffect(() => {
		const userId = session?.user?.id;
		if (!session?.isNewUser || !userId) return;
		try {
			if (window.sessionStorage.getItem(SIGNUP_EVENT_KEY) === userId) return;
			window.sessionStorage.setItem(SIGNUP_EVENT_KEY, userId);
		} catch {
			return;
		}
		const attribution = readStoredMarketingAttribution();
		capture(
			"auth_signup_completed",
			{ userId },
			{
				first_channel: attribution?.first.channel ?? null,
				latest_channel: attribution?.latest.channel ?? null,
			},
		);
	}, [session]);

	return null;
}
