/**
 * Vercel rewrites public URLs to `/api/...` (see vercel.json).
 * Strip that prefix so Express routes match the public path.
 */
export function stripVercelApiPrefix(url: string): string {
	if (!url.startsWith("/api")) return url;

	if (url === "/api" || url.startsWith("/api?")) {
		const rest = url.slice("/api".length);
		return rest.startsWith("?") ? `/${rest}` : "/";
	}

	if (url.startsWith("/api/")) {
		return url.slice("/api".length);
	}

	return url;
}
