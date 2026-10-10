const configuredApiBaseUrl = (process.env.NEXT_PUBLIC_API_URL ?? "").replace(
	/\/$/,
	"",
);

/**
 * Resolve the base URL for `/api/v1/*` requests.
 *
 * In development we return an empty string so the browser hits the Next.js
 * dev server (port 3000) and `src/app/api/v1/[...path]/route.ts` proxies the
 * request to the API (port 3001). This keeps requests same-origin, which is
 * required for CSRF (the token is HMAC'd against the session cookie that only
 * the Next dev server origin will set/send) and for cookie-based auth without
 * cross-origin quirks.
 *
 * In production the client uses the absolute `NEXT_PUBLIC_API_URL`.
 * On the server (SSR) we always use the absolute URL.
 */
function resolveApiBaseUrl(): string {
	if (typeof window !== "undefined" && process.env.NODE_ENV === "development") {
		return "";
	}
	return configuredApiBaseUrl;
}

export function toApiUrl(path: string): string {
	const normalizedPath = path.startsWith("/") ? path : `/${path}`;
	const baseUrl = resolveApiBaseUrl();
	return baseUrl ? `${baseUrl}${normalizedPath}` : normalizedPath;
}
