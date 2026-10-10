import {
	attributionFromCookie,
	attributionFromSearch,
	MARKETING_ATTRIBUTION_COOKIE,
	MARKETING_ATTRIBUTION_STORAGE_KEY,
	type MarketingAttribution,
	marketingAttributionSchema,
	mergeIncomingAttribution,
	serializeAttributionCookie,
} from "@moat/shared";

export function readStoredMarketingAttribution(): MarketingAttribution | null {
	if (typeof window === "undefined") return null;
	try {
		const raw = window.localStorage.getItem(MARKETING_ATTRIBUTION_STORAGE_KEY);
		if (!raw) return null;
		const parsed = marketingAttributionSchema.safeParse(JSON.parse(raw));
		return parsed.success ? parsed.data : null;
	} catch {
		return null;
	}
}

export function storeMarketingAttribution(
	attribution: MarketingAttribution,
): void {
	const cookieValue = serializeAttributionCookie(attribution);
	try {
		window.localStorage.setItem(
			MARKETING_ATTRIBUTION_STORAGE_KEY,
			JSON.stringify(attribution),
		);
	} catch {
		/* private mode */
	}
	if (!cookieValue) return;
	const secure = window.location.protocol === "https:" ? "; Secure" : "";
	const domain = window.location.hostname.endsWith("moatfinance.ai")
		? "; Domain=.moatfinance.ai"
		: "";
	// biome-ignore lint/suspicious/noDocumentCookie: attribution cookie must be readable on the next OAuth request
	document.cookie = `${MARKETING_ATTRIBUTION_COOKIE}=${encodeURIComponent(cookieValue)}; Path=/; Max-Age=7776000; SameSite=Lax${domain}${secure}`;
}

export function captureMarketingAttributionFromLocation(): MarketingAttribution | null {
	const incoming = attributionFromSearch(window.location.search);
	const cookieMatch = document.cookie
		.split("; ")
		.find((part) => part.startsWith(`${MARKETING_ATTRIBUTION_COOKIE}=`));
	const cookieValue = cookieMatch
		? decodeURIComponent(cookieMatch.split("=").slice(1).join("="))
		: null;
	const fromCookie = attributionFromCookie(cookieValue);
	const merged = mergeIncomingAttribution(
		mergeIncomingAttribution(readStoredMarketingAttribution(), fromCookie),
		incoming,
	);
	if (merged) storeMarketingAttribution(merged);
	return merged;
}
